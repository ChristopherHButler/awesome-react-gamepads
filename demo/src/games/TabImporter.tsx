import { useEffect, useMemo, useRef, useState } from 'react';
import { parseTab, noteName, countTabLines, findTempo } from './tabImport';
import { type TabSong } from './customSongs';
import { strumChord, audio, TONES, TONE_IDS, type ToneId, type Voice } from './guitarSynth';
import { freq } from './songs';

/**
 * "Paste a tab": the player copies a plain-text guitar tab from wherever they read it
 * and pastes it here. It stays in their browser.
 */

interface Props {
  song: TabSong;
  onSave: (song: TabSong) => void;
  onPlay: (song: TabSong) => void;
  onCancel: () => void;
}

export default function TabImporter({ song, onSave, onPlay, onCancel }: Props) {
  const [s, setS] = useState<TabSong>(song);
  const [previewing, setPreviewing] = useState(false);
  const timers = useRef<number[]>([]);
  const voice = useRef<Voice | null>(null);
  const parsed = useMemo(() => parseTab(s.text), [s.text]);
  const update = (patch: Partial<TabSong>) => setS(cur => ({ ...cur, ...patch }));

  const secPerBeat = 60 / s.bpm;
  const length = parsed.beats * secPerBeat;
  const taps = useRef<number[]>([]);
  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter(t => now - t < 3000), now].slice(-8);
    if (taps.current.length >= 3) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      const avg = gaps.reduce((x, y) => x + y, 0) / gaps.length;
      update({ bpm: Math.max(40, Math.min(260, Math.round(60000 / avg))) });
    }
  };
  const chords = parsed.events.filter(e => e.midi.length > 1).length;

  const stopPreview = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    voice.current?.stop(); voice.current = null;
    setPreviewing(false);
  };
  useEffect(() => stopPreview, []);

  const preview = () => {
    if (previewing) { stopPreview(); return; }
    audio();
    setPreviewing(true);
    const first = parsed.events[0]?.beat ?? 0;
    const firstBit = parsed.events.filter(e => (e.beat - first) * secPerBeat < 10); // first ~10 s
    for (const e of firstBit) {
      timers.current.push(setTimeout(() => {
        voice.current?.stop();          // stop the last note, like a player moving to the next one
        voice.current = strumChord(e.midi.map(freq), s.tone, 0.8);
      }, (e.beat - first) * secPerBeat * 1000) as unknown as number);
    }
    const end = firstBit.length ? (firstBit[firstBit.length - 1].beat - first) * secPerBeat * 1000 + 800 : 0;
    timers.current.push(setTimeout(() => setPreviewing(false), end) as unknown as number);
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-raised)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '6px 8px', fontSize: 13,
  };
  const label = (text: string) => <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{text}</span>;
  const ok = parsed.events.length > 0;
  const named = { ...s, title: s.title.trim() || 'Pasted tab' };

  return (
    <div style={{ width: '100%', maxWidth: 980, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>📋 Paste a tab</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Copy a plain-text guitar tab (the <code>e|---0---|</code> kind) and paste it below — intro text, lyrics and chord
        names are ignored. Notes are timed by where they sit between bar lines; set the tempo (or tap it) until the preview sounds right.
        The tab stays in this browser.
      </div>

      <textarea value={s.text} spellCheck={false}
        onChange={e => {
          const text = e.target.value;
          // Use the tempo written in the tab, if there is one — no tapping needed.
          const bpm = !s.text.trim() ? findTempo(text) : null;
          update(bpm ? { text, bpm } : { text });
        }}
        placeholder={'e|-----------------|\nB|-----------------|\nG|-----------------|\nD|-------2---------|\nA|---3-----3---5---|\nE|-0-----------0---|'}
        style={{ ...inputStyle, width: '100%', height: 260, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, lineHeight: 1.35, whiteSpace: 'pre', overflow: 'auto' }} />

      <div style={{ fontSize: 12, color: ok ? 'var(--green)' : 'var(--muted)' }}>
        {ok
          ? `Found ${parsed.events.length} notes${chords ? ` (${chords} chords)` : ''} in ${parsed.bars ? `${parsed.bars} bars (timed by bar lines)` : 'a tab with no bar lines (timed by spacing)'} · ${parsed.tuningName} · about ${Math.floor(length / 60)}:${String(Math.round(length % 60)).padStart(2, '0')} long · starts ${parsed.events.slice(0, 6).map(e => e.midi.map(noteName).join('+')).join(' ')}…`
          : !s.text.trim() ? 'Waiting for a tab…'
          : countTabLines(s.text) === 0
            ? 'No tab lines found — it needs the six e|B|G|D|A|E lines with dashes and fret numbers. If you copied from a page that shows the tab as an image or player, there’s no text to read.'
            : `Found ${countTabLines(s.text)} lines that look like tab, but no fret numbers in groups of 4–6 strings.`}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <label>{label('Title')}
          <input style={{ ...inputStyle, width: 220 }} value={s.title} maxLength={60} placeholder="Song name" onChange={e => update({ title: e.target.value })} />
        </label>
        <label>{label('Guitar sound')}
          <select style={inputStyle} value={s.tone} onChange={e => update({ tone: e.target.value as ToneId })}>
            {TONE_IDS.map(id => <option key={id} value={id}>{TONES[id].label} — {TONES[id].hint}</option>)}
          </select>
        </label>
        <label>{label(`Tempo: ${s.bpm} BPM`)}
          <input type="range" min={40} max={260} step={1} value={s.bpm}
            onChange={e => update({ bpm: Number(e.target.value) })} style={{ width: 200 }} />
        </label>
        <button className="rumble-btn" onClick={tap} title="Tap along to the beat (quarter notes) to set the tempo">Tap tempo</button>
        <button className="rumble-btn" onClick={preview} disabled={!ok}>{previewing ? '■ Stop' : '▶ Preview 10 s'}</button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }} />
        <button className="rumble-btn" onClick={() => { stopPreview(); onCancel(); }}>Cancel</button>
        <button className="rumble-btn" onClick={() => { stopPreview(); onSave(named); }} disabled={!ok}>Save to My songs</button>
        <button className="rumble-btn test" onClick={() => { stopPreview(); onPlay(named); }} disabled={!ok}>Save &amp; play</button>
      </div>
    </div>
  );
}
