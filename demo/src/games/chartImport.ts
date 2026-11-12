/**
 * Imports Clone Hero / YARG chart folders (.zip): notes.chart or notes.mid, the
 * song's audio stems and song.ini. Imported zips are kept in this browser
 * (IndexedDB) so they can be played again; nothing is uploaded anywhere.
 */
import { readZip } from './zip';
import { parseMidi } from './midi';

export type Difficulty = 'expert' | 'hard' | 'medium' | 'easy';
export const DIFFICULTIES: Difficulty[] = ['expert', 'hard', 'medium', 'easy'];

/** One strum: the time (song seconds) and frets (0 = green … 4 = orange). */
export interface ChartHit { t: number; frets: number[] }

export interface ChartData {
  title: string;
  artist: string;
  /** Seconds to shift notes by (song.ini delay / .chart Offset). */
  offset: number;
  parts: Partial<Record<Difficulty, ChartHit[]>>;
  /** Audio stems by file name, e.g. "song.ogg", "guitar.opus". */
  audio: { name: string; bytes: Uint8Array }[];
  /** Optional visuals that come with many charts. */
  album?: Uint8Array;
  background?: Uint8Array;
  video?: { name: string; bytes: Uint8Array };
}

export const CHART_SOURCES = [
  { name: 'Chorus Encore', url: 'https://www.enchor.us/', note: 'Reviewed charts — pick the .zip download' },
  { name: 'RhythmVerse', url: 'https://rhythmverse.co/', note: 'Huge library — choose Clone Hero/YARG versions' },
  { name: 'Custom Songs Central', url: 'https://customsongscentral.com/', note: 'Community charts and setlists' },
];

const AUDIO_EXT = /\.(ogg|opus|mp3|wav|m4a)$/;

export async function parseChartZip(data: ArrayBuffer): Promise<ChartData> {
  const files = await readZip(data);
  const ini = parseIni(files.get('song.ini'));
  const text = (b?: Uint8Array) => (b ? new TextDecoder().decode(b) : '');

  let parts: ChartData['parts'] = {};
  let chartOffset = 0;
  if (files.has('notes.chart')) {
    const res = parseDotChart(text(files.get('notes.chart')));
    parts = res.parts; chartOffset = res.offset;
  } else if (files.has('notes.mid')) {
    const b = files.get('notes.mid')!;
    parts = parseNotesMid(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  } else {
    throw new Error('No notes.chart or notes.mid in this zip — is it a Clone Hero/YARG chart?');
  }
  if (!Object.values(parts).some(p => p && p.length)) throw new Error('This chart has no guitar part.');

  const audio = [...files.entries()]
    .filter(([name]) => AUDIO_EXT.test(name) && !name.startsWith('preview'))
    .map(([name, bytes]) => ({ name, bytes }));
  if (!audio.length) throw new Error('No song audio in this zip.');

  const pick = (base: string, exts: string[]) => {
    for (const e of exts) { const b = files.get(`${base}.${e}`); if (b) return { name: `${base}.${e}`, bytes: b }; }
    return undefined;
  };
  const img = ['png', 'jpg', 'jpeg', 'webp'];
  return {
    album: pick('album', img)?.bytes,
    background: (pick('background', img) ?? [...files.entries()].map(([name, bytes]) => ({ name, bytes }))
      .find(f => /^background.*\.(png|jpe?g|webp)$/.test(f.name)))?.bytes,
    video: pick('video', ['webm', 'mp4']) ?? pick('background', ['webm', 'mp4']),
    title: ini.name || ini.title || 'Imported chart',
    artist: ini.artist || '',
    offset: (Number(ini.delay) || 0) / 1000 + chartOffset,
    parts,
    audio,
  };
}

function parseIni(bytes?: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  if (!bytes) return out;
  for (const line of new TextDecoder().decode(bytes).split(/\r?\n/)) {
    const m = /^\s*([^=;#[]+?)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

/** Groups single notes that start together into chords. */
function group(notes: { t: number; fret: number }[]): ChartHit[] {
  notes.sort((a, b) => a.t - b.t);
  const hits: ChartHit[] = [];
  for (const n of notes) {
    const last = hits[hits.length - 1];
    if (last && Math.abs(last.t - n.t) < 0.005) { if (!last.frets.includes(n.fret)) last.frets.push(n.fret); }
    else hits.push({ t: n.t, frets: [n.fret] });
  }
  hits.forEach(h => h.frets.sort((a, b) => a - b));
  return hits;
}

// ── notes.chart (text) ──────────────────────────────────────────────────────
function parseDotChart(src: string): { parts: ChartData['parts']; offset: number } {
  const sections = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    const head = /^\[(.+)\]$/.exec(line);
    if (head) { current = []; sections.set(head[1], current); continue; }
    if (current && line && line !== '{' && line !== '}') current.push(line);
  }
  const song = new Map<string, string>();
  for (const l of sections.get('Song') ?? []) {
    const m = /^(\w+)\s*=\s*"?(.*?)"?$/.exec(l);
    if (m) song.set(m[1], m[2]);
  }
  const resolution = Number(song.get('Resolution')) || 192;
  const offset = Number(song.get('Offset')) || 0;

  // Tempo map: "tick = B 120000" (BPM × 1000).
  const tempos = (sections.get('SyncTrack') ?? [])
    .map(l => /^(\d+)\s*=\s*B\s+(\d+)/.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map(m => ({ tick: Number(m[1]), bpm: Number(m[2]) / 1000 }))
    .sort((a, b) => a.tick - b.tick);
  if (!tempos.length || tempos[0].tick !== 0) tempos.unshift({ tick: 0, bpm: 120 });
  const segs: { tick: number; sec: number; spt: number }[] = [];
  for (const t of tempos) {
    const prev = segs[segs.length - 1];
    const sec = prev ? prev.sec + (t.tick - prev.tick) * prev.spt : 0;
    segs.push({ tick: t.tick, sec, spt: 60 / (t.bpm * resolution) });
  }
  const toSec = (tick: number) => {
    let s = segs[0];
    for (const seg of segs) { if (seg.tick <= tick) s = seg; else break; }
    return s.sec + (tick - s.tick) * s.spt;
  };

  const parts: ChartData['parts'] = {};
  const names: Record<Difficulty, string> = { expert: 'ExpertSingle', hard: 'HardSingle', medium: 'MediumSingle', easy: 'EasySingle' };
  for (const d of DIFFICULTIES) {
    const lines = sections.get(names[d]);
    if (!lines) continue;
    const notes: { t: number; fret: number }[] = [];
    for (const l of lines) {
      const m = /^(\d+)\s*=\s*N\s+(\d+)\s+\d+/.exec(l);
      if (!m) continue;
      const fret = Number(m[2]);
      if (fret <= 4) notes.push({ t: toSec(Number(m[1])), fret }); // 5/6 are flags, 7 is an open note
    }
    if (notes.length) parts[d] = group(notes);
  }
  return { parts, offset };
}

// ── notes.mid (Rock Band / Guitar Hero style MIDI) ──────────────────────────
function parseNotesMid(buf: ArrayBuffer): ChartData['parts'] {
  const midi = parseMidi(buf);
  const track =
    midi.tracks.find(t => /^part guitar$/i.test(t.name)) ??
    midi.tracks.find(t => /part guitar|t1 gems|guitar/i.test(t.name)) ??
    midi.tracks.find(t => t.notes.some(n => n.midi >= 96 && n.midi <= 100));
  if (!track) return {};
  // Each difficulty uses 5 consecutive MIDI notes for green … orange.
  const base: Record<Difficulty, number> = { expert: 96, hard: 84, medium: 72, easy: 60 };
  const parts: ChartData['parts'] = {};
  for (const d of DIFFICULTIES) {
    const notes = track.notes
      .filter(n => n.midi >= base[d] && n.midi <= base[d] + 4)
      .map(n => ({ t: n.t, fret: n.midi - base[d] }));
    if (notes.length) parts[d] = group(notes);
  }
  return parts;
}

// ── Library (this browser only) ─────────────────────────────────────────────
export interface ChartSongMeta {
  id: string;
  title: string;
  artist: string;
  difficulties: Difficulty[];
  hasGuitarStem: boolean;
  /** Small album-art thumbnail (data URL), if the chart has one. */
  cover?: string;
}

/** Shrinks album art to a small thumbnail for the song list. */
async function thumbnail(bytes: Uint8Array): Promise<string | undefined> {
  try {
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart]));
    const size = 96;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    c.getContext('2d')!.drawImage(bmp, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.8);
  } catch { return undefined; }
}

const META_KEY = 'guitarJam.charts';

export function loadChartMetas(): ChartSongMeta[] {
  try {
    const list = JSON.parse(localStorage.getItem(META_KEY) || '[]');
    return Array.isArray(list) ? list.filter((x: any) => x && typeof x.id === 'string') : [];
  } catch { return []; }
}
export function saveChartMetas(list: ChartSongMeta[]) {
  try { localStorage.setItem(META_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('guitarJam', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('charts');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction('charts', mode).objectStore('charts'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export const storeChartZip = (id: string, data: ArrayBuffer) => tx('readwrite', s => s.put(data, id));
export const loadChartZip = (id: string) => tx<ArrayBuffer | undefined>('readonly', s => s.get(id));
export const deleteChartZip = (id: string) => tx('readwrite', s => s.delete(id));

/** Imports a .zip the player picked; returns its library entry. */
export async function importChartFile(file: File): Promise<ChartSongMeta> {
  const data = await file.arrayBuffer();
  const chart = await parseChartZip(data);
  const id = `chart-${Date.now().toString(36)}`;
  await storeChartZip(id, data);
  return {
    id,
    title: chart.title,
    artist: chart.artist,
    difficulties: DIFFICULTIES.filter(d => chart.parts[d]?.length),
    hasGuitarStem: chart.audio.some(a => a.name.startsWith('guitar.')),
    cover: chart.album ? await thumbnail(chart.album) : undefined,
  };
}
