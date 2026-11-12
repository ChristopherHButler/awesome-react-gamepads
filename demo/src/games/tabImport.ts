/**
 * Reads a plain-text (ASCII) guitar tab that the player pastes in, e.g.
 *
 *   e|-----0-----|
 *   B|---1---1---|
 *   G|-2-------2-|
 *   D|-----------|
 *   A|-----------|
 *   E|-----------|
 *
 * Text tabs have no exact rhythm. Bar lines are the one reliable clue: every bar
 * lasts the same time. So each note's beat comes from where it sits inside its bar,
 * snapped to the nearest 16th note, and the player sets the tempo (BPM).
 */

export interface TabEvent {
  /** Position in beats from the start of the tab (quarter-note beats). */
  beat: number;
  /** MIDI pitches played together at this column (low → high). */
  midi: number[];
}

export interface ParsedTab {
  events: TabEvent[];
  /** Total length in beats. */
  beats: number;
  /** Bars found (0 means the tab had no bar lines and spacing was used instead). */
  bars: number;
  tuning: number[]; // MIDI per string, high → low
  tuningName: string;
  strings: number;
}

const STANDARD = [64, 59, 55, 50, 45, 40]; // e B G D A E
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Recognises a tab line and returns its string label (if any) and body. Lenient on
 * purpose: tabs copied from web pages carry repeat marks ("| x4"), technique letters
 * (PM, v, ~), odd dash characters and non-breaking spaces.
 */
function isTabLine(raw: string): RegExpMatchArray | null {
  const line = raw
    .replace(/[\u2010-\u2015\u2212\u2500]/g, '-') // en/em dashes, box-drawing → '-'
    .replace(/[\u00a0\u2007\u202f]/g, ' ');       // non-breaking spaces
  const m = /^\s*([A-Ga-g][#b]?)?\s*[|:]?(.*)$/.exec(line);
  if (!m) return null;
  let body = m[2];
  // Split off trailing text after the tab itself (repeat marks, comments).
  const end = Math.max(body.lastIndexOf('|'), body.lastIndexOf('-'));
  if (end < 0) return null;
  const tail = body.slice(end + 1);
  body = body.slice(0, end + 1);
  const dashes = body.match(/-/g)?.length ?? 0;
  if (dashes < 6 || dashes < body.replace(/\s/g, '').length * 0.4) return null;
  // Marker rows above the staff ("PM----|", "let ring") contain words, strings don't.
  if (/[A-Za-z]{2,}/.test(body)) return null;
  // A bare row of dashes is a separator, not a string: needs a label, a bar line or a fret.
  if (!m[1] && !/[|0-9]/.test(body)) return null;
  const out = [m[0], m[1], body, tail] as unknown as RegExpMatchArray;
  return out;
}

/** Reads a repeat count from text like "x3", "(x4)", "3x", "x 2", "repeat 2 times". */
export function repeatCount(text: string | undefined): number {
  if (!text) return 1;
  const m = /(?:^|[\s(\[])(?:x|×)\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:x|×)(?:\b|$)|repeat\D{0,10}(\d{1,2})/i.exec(text);
  const n = m ? Number(m[1] ?? m[2] ?? m[3]) : 1;
  return n >= 2 && n <= 16 ? n : 1;
}

/** How many lines look like tab — shown when nothing could be read. */
export function countTabLines(text: string): number {
  return text.split(/\r?\n/).filter(l => isTabLine(l)).length;
}

function labelPitchClass(label: string): number | null {
  const m = /^([A-Ga-g])([#b]?)$/.exec(label);
  if (!m) return null;
  return (LETTER[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
}

/** Works out string pitches from labels like "D A F C G D" (high→low); falls back to standard. */
function tuningFrom(labels: (string | undefined)[], strings: number): { tuning: number[]; name: string } {
  const pcs = labels.map(l => (l ? labelPitchClass(l) : null));
  if (strings !== 6 || pcs.some(p => p === null)) {
    const t = STANDARD.slice(0, strings);
    return { tuning: t, name: strings === 6 ? 'Standard (E A D G B e)' : `${strings} strings, standard` };
  }
  // Lowest string: the pitch with that letter closest to E2 (MIDI 40).
  const low = pcs[5]!;
  let lowMidi = 36 + ((low - 0 + 12) % 12);
  if (lowMidi - 40 > 6) lowMidi -= 12;
  if (40 - lowMidi > 6) lowMidi += 12;
  const tuning: number[] = new Array(6);
  tuning[5] = lowMidi;
  for (let i = 4; i >= 0; i--) {
    let m = tuning[i + 1] + 1;
    while (((m % 12) + 12) % 12 !== pcs[i]) m++;
    tuning[i] = m;
  }
  const same = tuning.every((m, i) => m === STANDARD[i]);
  const allDown = tuning.every((m, i) => m === STANDARD[i] - 1);
  const name = same ? 'Standard (E A D G B e)'
    : allDown ? 'Half step down (Eb)'
    : labels.slice().reverse().join(' ');
  return { tuning, name };
}

export function parseTab(text: string): ParsedTab {
  const lines = text.replace(/\t/g, '    ').split(/\r?\n/);
  const blocks: { labels: (string | undefined)[]; bodies: string[]; repeat: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const first = isTabLine(lines[i]);
    if (!first) continue;
    // Collect consecutive tab lines (a staff), typically 6.
    const staff: RegExpMatchArray[] = [first];
    let j = i + 1;
    while (j < lines.length && staff.length < 8) {
      const m = isTabLine(lines[j]);
      if (!m) break;
      staff.push(m);
      j++;
    }
    if (staff.length >= 4) {
      // More than 6 rows: keep the labelled ones if there are six (drops stray marker rows).
      const labelled = staff.filter(m => m[1]);
      const rows = staff.length > 6 && labelled.length >= 6 ? labelled.slice(0, 6) : staff.slice(-6);
      // Repeat mark: at the end of any string line, or on a short line right under the staff.
      const below = lines[j] && lines[j].trim().length <= 30 ? lines[j] : '';
      const repeat = Math.max(...rows.map(r => repeatCount(r[3])), repeatCount(below));
      blocks.push({ labels: rows.map(m => m[1]), bodies: rows.map(m => m[2]), repeat });
      i = j - 1;
    }
  }
  if (!blocks.length) return { events: [], beats: 0, bars: 0, tuning: STANDARD, tuningName: 'Standard (E A D G B e)', strings: 6 };

  const strings = Math.min(6, blocks[0].bodies.length);
  const { tuning, name } = tuningFrom(blocks[0].labels.slice(0, strings), strings);

  const BEATS_PER_BAR = 4;
  const SNAP = 4; // snap to 16th notes (4 per beat)
  const events: TabEvent[] = [];
  let beatBase = 0;
  let totalBars = 0;
  for (const block of blocks) {
    const bodies = block.bodies.slice(0, strings);
    const width = Math.max(...bodies.map(b => b.length));
    const isBar = (c: number) => bodies.filter(b => b[c] === '|').length >= Math.ceil(bodies.length / 2);

    // Bar boundaries: bar-line columns, plus the start and end of the staff.
    const lines: number[] = [];
    for (let c = 0; c < width; c++) if (isBar(c)) lines.push(c);
    const edges = [-1, ...lines, width].filter((c, i, a) => i === 0 || c - a[i - 1] > 2); // skip "||"
    const bars: { start: number; end: number }[] = [];
    for (let i = 0; i < edges.length - 1; i++) {
      const start = edges[i] + 1, end = edges[i + 1];
      if (end - start >= 3) bars.push({ start, end });
    }
    const hasBars = lines.length > 0 && bars.length > 0;

    // Notes per string (two-digit frets on different strings can't collide), merged into chords.
    const byCol = new Map<number, Set<number>>();
    bodies.forEach((body, si) => {
      for (let c = 0; c < body.length; c++) {
        if (!/[0-9]/.test(body[c])) continue;
        let fret = Number(body[c]);
        const start = c;
        if (/[0-9]/.test(body[c + 1] ?? '') && fret * 10 + Number(body[c + 1]) <= 24) {
          fret = fret * 10 + Number(body[c + 1]);
          c++;
        }
        const set = byCol.get(start) ?? new Set<number>();
        set.add(tuning[si] + fret);
        byCol.set(start, set);
      }
    });

    // Column → beat within this staff.
    // Tab writers use a fixed number of dashes per note value, so find that "cell"
    // size from the gaps between notes, then count how many cells fill each bar.
    const noteCols = [...byCol.keys()].sort((x, y) => x - y);
    const barOf = (col: number) => { const i = bars.findIndex(b => col < b.end); return i === -1 ? bars.length - 1 : i; };
    const gaps: number[] = [];
    for (let k = 1; k < noteCols.length; k++) {
      if (hasBars && barOf(noteCols[k]) !== barOf(noteCols[k - 1])) continue;
      const g = noteCols[k] - noteCols[k - 1];
      if (g > 0 && g <= 8) gaps.push(g);
    }
    const counts = new Map<number, number>();
    gaps.forEach(g => counts.set(g, (counts.get(g) ?? 0) + 1));
    const cell = [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0])[0]?.[0] ?? 2;
    // Leading dashes before the first note of a bar (writers are consistent within a staff).
    const lead = hasBars
      ? Math.min(...bars.map(bar => { const c = noteCols.find(n => n >= bar.start && n < bar.end); return c === undefined ? Infinity : c - bar.start; }).filter(Number.isFinite), 2)
      : 0;
    const GRIDS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32];
    const snapGrid = (raw: number) => GRIDS.reduce((best, n) => (Math.abs(n - raw) < Math.abs(best - raw) ? n : best), GRIDS[0]);

    // One time scale for the whole staff: bars are NOT stretched to fit, so a pickup or a
    // wider first bar doesn't change the speed of the notes around it. The typical bar
    // width tells how many grid cells make a bar of 4 beats.
    const contCol: number[] = [];
    let cc = 0;
    for (let c = 0; c <= width; c++) { contCol[c] = cc; if (c < width && !isBar(c)) cc++; }
    const widths = bars.map(b => b.end - b.start).sort((x, y) => x - y);
    const typical = widths.length ? widths[Math.floor(widths.length / 2)] : width;
    const beatPerCol = hasBars ? BEATS_PER_BAR / (snapGrid(typical / cell) * cell) : 0.25;
    const firstNote = noteCols.length ? contCol[noteCols[0]] : 0;
    const origin = Math.min(firstNote, 1); // one leading dash is normal, not a rest
    void lead;

    let staffBeats: number;
    const beatOf = (col: number): number => Math.max(0, (contCol[col] - origin) * beatPerCol);
    staffBeats = Math.max(0, (cc - origin) * beatPerCol);
    staffBeats = Math.round(staffBeats * SNAP) / SNAP;

    const staffEvents = [...byCol.entries()]
      .sort((x, y) => x[0] - y[0])
      .map(([col, set]) => ({ beat: Math.round(beatOf(col) * SNAP) / SNAP, midi: [...set].sort((x, y) => x - y) }));
    // Two notes snapped onto the same 16th: merge them.
    const merged: TabEvent[] = [];
    for (const e of staffEvents) {
      const last = merged[merged.length - 1];
      if (last && last.beat === e.beat) last.midi = [...new Set([...last.midi, ...e.midi])].sort((x, y) => x - y);
      else merged.push(e);
    }

    for (let r = 0; r < block.repeat; r++) {
      for (const e of merged) events.push({ beat: beatBase + e.beat, midi: e.midi });
      beatBase += staffBeats;
      totalBars += hasBars ? bars.length : 0;
    }
  }
  return { events, beats: beatBase, bars: totalBars, tuning, tuningName: name, strings };
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (m: number) => NAMES[((m % 12) + 12) % 12];

/** Tempo written in the tab text, e.g. "Tempo: 123", "123 bpm", "♩ = 96". */
export function findTempo(text: string): number | null {
  const m = /(?:tempo|bpm)\s*[:=]?\s*(\d{2,3})|(\d{2,3})\s*bpm|[♩♪]\s*=\s*(\d{2,3})/i.exec(text);
  const n = m ? Number(m[1] ?? m[2] ?? m[3]) : NaN;
  return n >= 40 && n <= 260 ? n : null;
}
