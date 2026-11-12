import { useCallback, useEffect, useRef, useState } from 'react';
import { useGamepads, type ButtonDetails } from 'awesome-react-gamepads';
import { freq, midi, type Song } from './songs';
import {
  BEATS_PER_BAR, SCALES, STEPS_PER_BAR_OPTIONS, exportSong, importSong, scaleOf, totalSteps,
  type GridSong,
} from './customSongs';
import { pluck, audio, TONES, TONE_IDS, type ToneId, type Voice } from './guitarSynth';

/**
 * Step-sequencer song editor: 5 fret rows × steps, like a drum machine.
 *
 * Mouse: click a cell to place/remove a note.
 * Guitar: press a fret to write it at the cursor and move on; strum down = rest,
 *         strum up = back, Start = preview, Star Power = delete at cursor.
 * Keyboard: A S D F G write a note, ←/→ move, Backspace delete, Space preview.
 */

const FRETS = [
  { name: 'GreenFret',  color: '#22c55e', key: 'KeyA' },
  { name: 'RedFret',    color: '#ef4444', key: 'KeyS' },
  { name: 'YellowFret', color: '#eab308', key: 'KeyD' },
  { name: 'BlueFret',   color: '#3b82f6', key: 'KeyF' },
  { name: 'OrangeFret', color: '#f97316', key: 'KeyG' },
];
const CELL = 28;

interface Props {
  song: GridSong;
  onSave: (song: GridSong) => void;
  onPlay: (song: GridSong) => void;
  onCancel: () => void;
}

export default function SongEditor({ song, onSave, onPlay, onCancel }: Props) {
  const [g, setG] = useState<GridSong>(song);
  const [cursor, setCursor] = useState(0);
  const [playStep, setPlayStep] = useState<number | null>(null);
  const [shareText, setShareText] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState('');

  const gRef = useRef(g);
  gRef.current = g;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  const total = totalSteps(g);
  const scale = scaleOf(g);
  const tone: ToneId = g.tone ?? (g.genre === 'Rock' ? 'rock' : 'clean');

  const lastVoice = useRef<Voice | null>(null);
  const sound = useCallback((row: number) => {
    const cur = gRef.current;
    lastVoice.current?.stop();
    lastVoice.current = pluck(freq(midi(scaleOf(cur).frets[row])), cur.tone ?? (cur.genre === 'Rock' ? 'rock' : 'clean'), 0.7);
  }, []);

  const update = (patch: Partial<GridSong>) => setG(cur => ({ ...cur, ...patch }));

  const setNote = useCallback((step: number, row: number | null) => {
    setG(cur => {
      const notes = { ...cur.notes };
      if (row === null) delete notes[step]; else notes[step] = row;
      return { ...cur, notes };
    });
  }, []);

  const moveCursor = useCallback((delta: number) => {
    setCursor(c => Math.max(0, Math.min(totalSteps(gRef.current) - 1, c + delta)));
  }, []);

  /** Write a note at the cursor and advance — the fast way to enter a riff. */
  const writeAtCursor = useCallback((row: number) => {
    setNote(cursorRef.current, row);
    sound(row);
    moveCursor(1);
  }, [setNote, sound, moveCursor]);

  const deleteAtCursor = useCallback(() => setNote(cursorRef.current, null), [setNote]);

  // ── Preview playback ───────────────────────────────────────────────────────
  const playing = playStep !== null;
  const togglePreview = useCallback(() => {
    setPlayStep(p => (p === null ? 0 : null));
  }, []);

  useEffect(() => {
    if (!playing) return;
    audio();
    let step = 0;
    let timer = 0;
    const tick = () => {
      const cur = gRef.current;
      const n = totalSteps(cur);
      if (step >= n) step = 0; // loop
      setPlayStep(step);
      const row = cur.notes[step];
      if (row !== undefined) sound(row);
      step++;
      timer = window.setTimeout(tick, (60 / cur.bpm / cur.stepsPerBeat) * 1000);
    };
    tick();
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // ── Guitar input ───────────────────────────────────────────────────────────
  const onButtonDown = useCallback((b: ButtonDetails) => {
    const row = FRETS.findIndex(f => f.name === b.buttonName);
    if (row >= 0) writeAtCursor(row);
  }, [writeAtCursor]);

  useGamepads({
    controllerProfile: 'guitar',
    onGamepadButtonDown: onButtonDown,
    onStrumDown: () => moveCursor(1),
    onStrumUp: () => moveCursor(-1),
    onStart: togglePreview,
    onStarPower: deleteAtCursor,
  });

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const row = FRETS.findIndex(f => f.key === e.code);
      if (row >= 0) { e.preventDefault(); writeAtCursor(row); return; }
      if (e.code === 'ArrowRight') { e.preventDefault(); moveCursor(1); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); moveCursor(-1); }
      if (e.code === 'Backspace' || e.code === 'Delete') { e.preventDefault(); deleteAtCursor(); moveCursor(-1); }
      if (e.code === 'Space') { e.preventDefault(); togglePreview(); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [writeAtCursor, moveCursor, deleteAtCursor, togglePreview]);

  // ── Grid settings that reshape notes ─────────────────────────────────────
  const setStepsPerBeat = (spb: number) => {
    setG(cur => {
      const notes: Record<number, number> = {};
      for (const [step, row] of Object.entries(cur.notes)) {
        const ns = Math.round((Number(step) * spb) / cur.stepsPerBeat);
        if (notes[ns] === undefined) notes[ns] = row;
      }
      return { ...cur, stepsPerBeat: spb, notes };
    });
    setCursor(0);
  };
  const setBars = (bars: number) => {
    const b = Math.max(1, Math.min(16, bars));
    setG(cur => {
      const max = b * BEATS_PER_BAR * cur.stepsPerBeat;
      const notes = Object.fromEntries(Object.entries(cur.notes).filter(([s]) => Number(s) < max));
      return { ...cur, bars: b, notes };
    });
    setCursor(c => Math.min(c, b * BEATS_PER_BAR * gRef.current.stepsPerBeat - 1));
  };

  const noteCount = Object.keys(g.notes).length;
  const canSave = noteCount > 0;

  const doExport = async () => {
    const text = exportSong(g);
    setShareText(text);
    try { await navigator.clipboard.writeText(text); setMsg('Copied to clipboard — paste it anywhere to share.'); }
    catch { setMsg('Select the text below to copy it.'); }
  };
  const doImport = () => {
    const imported = importSong(importText);
    if (!imported) { setMsg('That doesn’t look like a Guitar Jam song.'); return; }
    setG({ ...imported, id: g.id });
    setImportOpen(false); setImportText(''); setMsg(`Imported “${imported.title}”.`);
  };

  const label = (text: string) => <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{text}</span>;
  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-raised)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '6px 8px', fontSize: 13,
  };

  return (
    <div style={{ width: '100%', maxWidth: 980, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>🎼 Song editor</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{noteCount} notes · {g.bars} bars · {Math.round(total / g.stepsPerBeat * 60 / g.bpm)}s</div>
      </div>

      {/* Settings */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <label>{label('Title')}
          <input style={{ ...inputStyle, width: 200 }} value={g.title} maxLength={40} onChange={e => update({ title: e.target.value })} />
        </label>
        <label>{label('Guitar sound')}
          <select style={inputStyle} value={tone} onChange={e => { update({ tone: e.target.value as ToneId }); pluck(freq(midi(scale.frets[0])), e.target.value as ToneId, 0.7); }}>
            {TONE_IDS.map(id => <option key={id} value={id}>{TONES[id].label} — {TONES[id].hint}</option>)}
          </select>
        </label>
        <label>{label('Notes')}
          <select style={inputStyle} value={g.scale} onChange={e => update({ scale: e.target.value })}>
            {SCALES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
        <label>{label(`Tempo: ${g.bpm} BPM`)}
          <input type="range" min={50} max={200} value={g.bpm} onChange={e => update({ bpm: Number(e.target.value) })} />
        </label>
        <label>{label('Grid')}
          <select style={inputStyle} value={g.stepsPerBeat} onChange={e => setStepsPerBeat(Number(e.target.value))}>
            {STEPS_PER_BAR_OPTIONS.map(x => <option key={x.stepsPerBeat} value={x.stepsPerBeat}>{x.label}</option>)}
          </select>
        </label>
        <div>{label('Bars')}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button className="rumble-btn" onClick={() => setBars(g.bars - 1)} disabled={g.bars <= 1}>−</button>
            <span style={{ minWidth: 20, textAlign: 'center' }}>{g.bars}</span>
            <button className="rumble-btn" onClick={() => setBars(g.bars + 1)} disabled={g.bars >= 16}>+</button>
          </div>
        </div>
        <label>{label('Level')}
          <select style={inputStyle} value={g.level} onChange={e => update({ level: e.target.value as Song['level'] })}>
            <option>Kid</option><option>Easy</option><option>Medium</option>
          </select>
        </label>
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: 10 }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 3 }}>
          {/* Beat numbers */}
          <div style={{ display: 'flex', gap: 2, marginLeft: 56 }}>
            {Array.from({ length: total }, (_, step) => (
              <div key={step} style={{ width: CELL, fontSize: 10, textAlign: 'center', color: step % g.stepsPerBeat === 0 ? 'var(--text-secondary)' : 'transparent' }}>
                {step % g.stepsPerBeat === 0 ? (Math.floor(step / g.stepsPerBeat) % BEATS_PER_BAR) + 1 : '·'}
              </div>
            ))}
          </div>
          {FRETS.map((fret, row) => (
            <div key={fret.name} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <div style={{ width: 52, marginRight: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: fret.color, display: 'inline-block' }} />
                {scale.frets[row].replace(/\d/, '')}
              </div>
              {Array.from({ length: total }, (_, step) => {
                const on = g.notes[step] === row;
                const barStart = step % (g.stepsPerBeat * BEATS_PER_BAR) === 0;
                const beatStart = step % g.stepsPerBeat === 0;
                const isCursor = step === cursor;
                const isPlay = step === playStep;
                return (
                  <div
                    key={step}
                    onMouseDown={() => {
                      setCursor(step);
                      if (on) setNote(step, null);
                      else { setNote(step, row); sound(row); }
                    }}
                    style={{
                      width: CELL, height: CELL, borderRadius: 6, cursor: 'pointer',
                      marginLeft: barStart && step > 0 ? 6 : 0,
                      background: on ? fret.color : isPlay ? 'rgba(255,255,255,0.18)' : beatStart ? 'var(--surface-raised)' : 'var(--border-subtle)',
                      boxShadow: on && isPlay ? `0 0 12px ${fret.color}` : undefined,
                      outline: isCursor ? '2px solid var(--text-secondary)' : undefined,
                      outlineOffset: -2,
                      transition: 'background 0.05s',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
        <b>Click</b> a square to add or remove a note. Fastest with the guitar: <b>press a fret</b> to write it at the cursor
        and move on, <b>strum down</b> for a rest, <b>strum up</b> to go back, <b>Star Power</b> deletes, <b>Start</b> previews.
        Keyboard: A S D F G, ← →, Backspace, Space. Sound: {TONES[tone].label.toLowerCase()}.
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button className="rumble-btn" onClick={togglePreview}>{playing ? '■ Stop' : '▶ Preview'}</button>
        <button className="rumble-btn" onClick={() => { setG(cur => ({ ...cur, notes: {} })); setCursor(0); }}>Clear</button>
        <button className="rumble-btn" onClick={doExport} disabled={!canSave}>Share…</button>
        <button className="rumble-btn" onClick={() => setImportOpen(o => !o)}>Import…</button>
        <div style={{ flex: 1 }} />
        <button className="rumble-btn" onClick={onCancel}>Cancel</button>
        <button className="rumble-btn" onClick={() => { setPlayStep(null); onSave(g); }} disabled={!canSave}>Save</button>
        <button className="rumble-btn test" onClick={() => { setPlayStep(null); onPlay(g); }} disabled={!canSave}>Save &amp; play</button>
      </div>

      {msg && <div style={{ fontSize: 12, color: 'var(--green)' }}>{msg}</div>}
      {shareText && (
        <textarea readOnly value={shareText} onFocus={e => e.currentTarget.select()}
          style={{ ...inputStyle, width: '100%', height: 70, fontFamily: 'monospace', fontSize: 11 }} />
      )}
      {importOpen && (
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste a guitarjam:… song here"
            style={{ ...inputStyle, flex: 1, height: 60, fontFamily: 'monospace', fontSize: 11 }} />
          <button className="rumble-btn" onClick={doImport} disabled={!importText.trim()}>Load</button>
        </div>
      )}
    </div>
  );
}
