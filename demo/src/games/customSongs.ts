/**
 * Songs written in the Guitar Jam editor: a step grid of 5 frets, saved in the browser.
 */
import type { Genre, Song } from './songs';
import type { ToneId } from './guitarSynth';
import { parseTab } from './tabImport';

/** Five pitches per scale, low → high, one per fret (green → orange). */
export const SCALES: { id: string; label: string; frets: string[] }[] = [
  { id: 'c-major-penta',  label: 'C major pentatonic (bright)', frets: ['C4', 'D4', 'E4', 'G4', 'A4'] },
  { id: 'g-major-penta',  label: 'G major pentatonic',          frets: ['G3', 'A3', 'B3', 'D4', 'E4'] },
  { id: 'a-minor-penta',  label: 'A minor pentatonic (bluesy)', frets: ['A3', 'C4', 'D4', 'E4', 'G4'] },
  { id: 'e-minor-penta',  label: 'E minor pentatonic (rock)',   frets: ['E3', 'G3', 'A3', 'B3', 'D4'] },
  { id: 'e-low-riff',     label: 'Low E riff (heavy)',          frets: ['E2', 'G2', 'A2', 'A#2', 'B2'] },
];

export const STEPS_PER_BAR_OPTIONS = [
  { stepsPerBeat: 1, label: 'Quarter notes' },
  { stepsPerBeat: 2, label: 'Eighth notes' },
  { stepsPerBeat: 4, label: 'Sixteenth notes' },
];

export interface GridSong {
  id: string;
  title: string;
  genre: Genre;
  level: Song['level'];
  /** Guitar tone (older saved songs may not have one). */
  tone?: ToneId;
  bpm: number;
  scale: string;
  stepsPerBeat: number;
  bars: number;
  /** step index → fret row (0 = green … 4 = orange). One note per step. */
  notes: Record<number, number>;
}

export const BEATS_PER_BAR = 4;

export const totalSteps = (g: GridSong) => g.bars * BEATS_PER_BAR * g.stepsPerBeat;

export function scaleOf(g: GridSong) {
  return SCALES.find(s => s.id === g.scale) ?? SCALES[0];
}

export function newGridSong(): GridSong {
  return {
    id: `my-${Date.now().toString(36)}`,
    title: 'My song',
    genre: 'Kids',
    level: 'Kid',
    tone: 'clean',
    bpm: 100,
    scale: SCALES[0].id,
    stepsPerBeat: 2,
    bars: 4,
    notes: {},
  };
}

/** Converts a grid to the same melody text format the built-in songs use. */
export function gridToSong(g: GridSong): Song {
  const frets = scaleOf(g).frets;
  const total = totalSteps(g);
  const steps = Object.keys(g.notes).map(Number).filter(s => s < total).sort((a, b) => a - b);
  const beats = (n: number) => +(n / g.stepsPerBeat).toFixed(4);
  const tokens: string[] = [];
  if (steps.length && steps[0] > 0) tokens.push(`R:${beats(steps[0])}`);
  steps.forEach((step, i) => {
    const next = steps[i + 1] ?? total;
    tokens.push(`${frets[g.notes[step]]}:${beats(next - step)}`);
  });
  if (!tokens.length) tokens.push(`R:${BEATS_PER_BAR}`);
  return {
    id: g.id,
    title: g.title || 'Untitled',
    genre: g.genre,
    level: g.level,
    bpm: g.bpm,
    tone: g.tone ?? (g.genre === 'Rock' ? 'rock' : 'clean'),
    frets,
    melody: tokens.join(' '),
  };
}

// ── Storage ──────────────────────────────────────────────────────────────────
const KEY = 'guitarJam.mySongs';

export function loadMySongs(): GridSong[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(isGridSong) : [];
  } catch {
    return [];
  }
}

export function saveMySongs(list: GridSong[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}

export function isGridSong(x: any): x is GridSong {
  return x && typeof x === 'object' && typeof x.title === 'string' && typeof x.bpm === 'number'
    && typeof x.bars === 'number' && typeof x.stepsPerBeat === 'number' && x.notes && typeof x.notes === 'object';
}

/** Share format: a short text line anyone can paste into Import. */
export function exportSong(g: GridSong): string {
  return 'guitarjam:' + btoa(unescape(encodeURIComponent(JSON.stringify(g))));
}

export function importSong(text: string): GridSong | null {
  try {
    const trimmed = text.trim();
    const json = trimmed.startsWith('guitarjam:')
      ? decodeURIComponent(escape(atob(trimmed.slice('guitarjam:'.length))))
      : trimmed;
    const g = JSON.parse(json);
    if (!isGridSong(g)) return null;
    return { ...g, id: `my-${Date.now().toString(36)}` };
  } catch {
    return null;
  }
}

// ── Pasted tabs ──────────────────────────────────────────────────────────────
export interface TabSong {
  id: string;
  title: string;
  tone: ToneId;
  /** Tempo in BPM — text tabs don't say, so the player sets it. */
  bpm: number;
  /** @deprecated older saves; converted to bpm on load. */
  secPerCol?: number;
  /** The pasted tab text, kept so speed can be re-tuned later. Stays in this browser. */
  text: string;
}

export function newTabSong(): TabSong {
  return { id: `tab-${Date.now().toString(36)}`, title: '', tone: 'rock', bpm: 120, text: '' };
}

export function tabToSong(ts: TabSong): Song {
  const parsed = parseTab(ts.text);
  return {
    id: ts.id,
    title: ts.title || 'Pasted tab',
    genre: 'Rock',
    level: 'Medium',
    bpm: ts.bpm,
    melody: '',
    tone: ts.tone,
    by: 'Pasted tab',
    events: parsed.events.map(e => ({ t: (e.beat * 60) / ts.bpm, midi: e.midi })),
  };
}

const TAB_KEY = 'guitarJam.tabSongs';

export function loadTabSongs(): TabSong[] {
  try {
    const list = JSON.parse(localStorage.getItem(TAB_KEY) || '[]');
    if (!Array.isArray(list)) return [];
    return list
      .filter((x: any) => x && typeof x.text === 'string')
      .map((x: any) => ({ ...x, bpm: typeof x.bpm === 'number' ? x.bpm : 120 }));
  } catch { return []; }
}

export function saveTabSongs(list: TabSong[]): boolean {
  try { localStorage.setItem(TAB_KEY, JSON.stringify(list)); return true; } catch { return false; }
}
