/**
 * Built-in melodies for Guitar Jam: public-domain tunes (composed before 1929).
 * Players can write their own in the song editor (see customSongs.ts).
 * Notes are written as "pitch:beats", e.g. "E4:1" or "C4:0.5". "R:1" is a rest.
 */

import type { ToneId } from './guitarSynth';

export type Genre = 'Kids' | 'Rock';

/** Display order of genre groups in the menu. */
export const GENRES: { id: Genre; label: string; emoji: string; tone: ToneId }[] = [
  { id: 'Kids', label: 'Kids', emoji: '🧸', tone: 'clean' },
  { id: 'Rock', label: 'Rock', emoji: '🤘', tone: 'rock' },
];

export interface Song {
  id: string;
  title: string;
  genre: Genre;
  /** Optional credit shown in the menu. */
  by?: string;
  /**
   * Optional fixed pitch per fret, low → high (5 entries). When set, a note's fret is
   * its position in this list instead of being worked out from the melody — used by
   * songs written in the editor, so the chart matches the grid exactly.
   */
  frets?: string[];
  /** Guitar tone; defaults to the genre's tone. */
  tone?: ToneId;
  /**
   * Timed notes instead of a melody string (pasted tabs). `t` is seconds from the
   * start of the song; `midi` holds every pitch played together (a chord).
   */
  events?: { t: number; midi: number[] }[];
  /** Imported Clone Hero/YARG chart (stored in this browser). */
  chartId?: string;
  /** Tempo in beats per minute. */
  bpm: number;
  /** Shown in the menu. */
  level: 'Kid' | 'Easy' | 'Medium';
  melody: string;
}

export const SONGS: Song[] = [
  {
    id: 'hot-cross-buns', genre: 'Kids', title: 'Hot Cross Buns', bpm: 90, level: 'Kid',
    melody: `
      E4:1 D4:1 C4:2  E4:1 D4:1 C4:2
      C4:0.5 C4:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D4:0.5 D4:0.5
      E4:1 D4:1 C4:2`,
  },
  {
    id: 'mary', genre: 'Kids', title: 'Mary Had a Little Lamb', bpm: 100, level: 'Kid',
    melody: `
      E4:1 D4:1 C4:1 D4:1 E4:1 E4:1 E4:2
      D4:1 D4:1 D4:2 E4:1 G4:1 G4:2
      E4:1 D4:1 C4:1 D4:1 E4:1 E4:1 E4:1 E4:1
      D4:1 D4:1 E4:1 D4:1 C4:4`,
  },
  {
    id: 'twinkle', genre: 'Kids', title: 'Twinkle Twinkle Little Star', bpm: 96, level: 'Kid',
    melody: `
      C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2
      F4:1 F4:1 E4:1 E4:1 D4:1 D4:1 C4:2
      G4:1 G4:1 F4:1 F4:1 E4:1 E4:1 D4:2
      G4:1 G4:1 F4:1 F4:1 E4:1 E4:1 D4:2
      C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2
      F4:1 F4:1 E4:1 E4:1 D4:1 D4:1 C4:2`,
  },
  {
    id: 'row-row', genre: 'Kids', title: 'Row, Row, Row Your Boat', bpm: 100, level: 'Easy',
    melody: `
      C4:1 C4:1 C4:0.75 D4:0.25 E4:1
      E4:0.75 D4:0.25 E4:0.75 F4:0.25 G4:2
      C5:0.33 C5:0.33 C5:0.34 G4:0.33 G4:0.33 G4:0.34
      E4:0.33 E4:0.33 E4:0.34 C4:0.33 C4:0.33 C4:0.34
      G4:0.75 F4:0.25 E4:0.75 D4:0.25 C4:2`,
  },
  {
    id: 'ode-to-joy', genre: 'Kids', title: 'Ode to Joy', bpm: 110, level: 'Easy',
    melody: `
      E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1
      C4:1 C4:1 D4:1 E4:1 E4:1.5 D4:0.5 D4:2
      E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1
      C4:1 C4:1 D4:1 E4:1 D4:1.5 C4:0.5 C4:2`,
  },
  {
    id: 'jingle-bells', genre: 'Kids', title: 'Jingle Bells', bpm: 120, level: 'Medium',
    melody: `
      E4:1 E4:1 E4:2  E4:1 E4:1 E4:2
      E4:1 G4:1 C4:1.5 D4:0.5 E4:4
      F4:1 F4:1 F4:1.5 F4:0.5 F4:1 E4:1 E4:1 E4:0.5 E4:0.5
      E4:1 D4:1 D4:1 E4:1 D4:2 G4:2
      E4:1 E4:1 E4:2  E4:1 E4:1 E4:2
      E4:1 G4:1 C4:1.5 D4:0.5 E4:4
      F4:1 F4:1 F4:1.5 F4:0.5 F4:1 E4:1 E4:1 E4:0.5 E4:0.5
      G4:1 G4:1 F4:1 D4:1 C4:4`,
  },
];

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#4" → MIDI note number. */
export function midi(pitch: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(pitch);
  if (!m) throw new Error(`Bad pitch ${pitch}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1]] + acc;
}

/** The tone a song plays with unless the player overrides it. */
export const toneOf = (song: Song): ToneId => song.tone ?? GENRES.find(g => g.id === song.genre)?.tone ?? 'clean';

export const freq = (midiNote: number) => 440 * Math.pow(2, (midiNote - 69) / 12);

export interface ChartNote {
  /** Seconds from song start. */
  t: number;
  lane: number;
  midi: number;
  /** Letter shown on the note, e.g. "E". */
  label: string;
  /** All pitches to sound when hit (a chord), if more than one. */
  chord?: number[];
}

/**
 * Turns a melody into a chart. Distinct pitches are spread across the available lanes
 * from low to high, so the shape of the tune is kept on the fretboard.
 * `minGap` (seconds) drops notes that follow the previous one too quickly.
 */
export function buildChart(song: Song, lanes: number, tempoScale = 1, minGap = 0, leadIn = 2): ChartNote[] {
  if (song.events) return eventChart(song.events, lanes, tempoScale, minGap, leadIn);
  const beat = 60 / (song.bpm * tempoScale);
  const events: { t: number; midi: number; label: string }[] = [];
  let t = leadIn;
  for (const token of song.melody.trim().split(/\s+/)) {
    const [pitch, beats] = token.split(':');
    const len = Number(beats) * beat;
    const prev = events[events.length - 1];
    // Thin out fast runs (kid mode) — keep the first note of each quick group.
    if (pitch !== 'R' && (!prev || t - prev.t >= minGap - 1e-6)) {
      events.push({ t, midi: midi(pitch), label: pitch.replace(/\d/, '') });
    }
    t += len;
  }
  if (song.frets) {
    const fretMidi = song.frets.map(midi);
    return events.map(e => {
      const row = Math.max(0, fretMidi.indexOf(e.midi));
      const lane = lanes >= song.frets!.length ? row : Math.floor((row * lanes) / song.frets!.length);
      return { t: e.t, lane, midi: e.midi, label: e.label };
    });
  }
  const pitches = [...new Set(events.map(e => e.midi))].sort((a, b) => a - b);
  const laneOf = (m: number) => {
    const i = pitches.indexOf(m);
    return pitches.length <= lanes ? i : Math.floor((i * lanes) / pitches.length);
  };
  return events.map(e => ({ t: e.t, lane: laneOf(e.midi), midi: e.midi, label: e.label }));
}

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Chart for timed events (pasted tabs): the top note of each chord picks the fret. */
function eventChart(events: { t: number; midi: number[] }[], lanes: number, tempoScale: number, minGap: number, leadIn: number): ChartNote[] {
  const kept: { t: number; midi: number[] }[] = [];
  for (const e of events) {
    const t = leadIn + e.t / tempoScale;
    const prev = kept[kept.length - 1];
    if (prev && t - prev.t < Math.max(minGap, 0.06)) continue; // too fast to play
    kept.push({ t, midi: e.midi });
  }
  const lead = (m: number[]) => m[m.length - 1];
  const pitches = [...new Set(kept.map(e => lead(e.midi)))].sort((a, b) => a - b);
  const laneOf = (m: number) => {
    const i = pitches.indexOf(m);
    return pitches.length <= lanes ? i : Math.floor((i * lanes) / pitches.length);
  };
  return kept.map(e => ({
    t: e.t,
    lane: laneOf(lead(e.midi)),
    midi: lead(e.midi),
    label: PITCH_NAMES[lead(e.midi) % 12],
    chord: e.midi.length > 1 ? e.midi : undefined,
  }));
}
