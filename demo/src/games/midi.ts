/**
 * Minimal Standard MIDI File reader (format 0 and 1) for Guitar Jam imports.
 * Returns tracks with note on/off pairs converted to seconds using the tempo map.
 */

export interface MidiNote { t: number; d: number; midi: number; vel: number }
export interface MidiTrack {
  index: number;
  name: string;
  channel: number;
  /** General MIDI program (instrument), -1 if unset. */
  program: number;
  isDrums: boolean;
  notes: MidiNote[];
}
export interface MidiSong { name: string; duration: number; tracks: MidiTrack[] }

interface RawEvent { tick: number; type: 'on' | 'off' | 'tempo' | 'program' | 'name'; ch?: number; a?: number; b?: number; tempo?: number; text?: string }

export function parseMidi(data: ArrayBuffer): MidiSong {
  const v = new DataView(data);
  let p = 0;
  const str = (n: number) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(v.getUint8(p + i)); p += n; return s; };
  const u32 = () => { const x = v.getUint32(p); p += 4; return x; };
  const u16 = () => { const x = v.getUint16(p); p += 2; return x; };
  const vlq = () => { let x = 0; for (;;) { const b = v.getUint8(p++); x = (x << 7) | (b & 0x7f); if (!(b & 0x80)) return x; } };

  if (str(4) !== 'MThd') throw new Error('Not a MIDI file');
  const hlen = u32();
  const format = u16(); const ntracks = u16(); const division = u16();
  p += hlen - 6;
  if (division & 0x8000) throw new Error('SMPTE-timed MIDI files are not supported');
  if (format > 1) throw new Error('MIDI format 2 is not supported');

  const rawTracks: RawEvent[][] = [];
  for (let t = 0; t < ntracks && p < v.byteLength; t++) {
    const id = str(4); const len = u32(); const end = p + len;
    if (id !== 'MTrk') { p = end; continue; }
    const events: RawEvent[] = [];
    let tick = 0; let status = 0;
    while (p < end) {
      tick += vlq();
      let b = v.getUint8(p);
      if (b & 0x80) { status = b; p++; } else { b = status; } // running status
      const type = status & 0xf0; const ch = status & 0x0f;
      if (status === 0xff) {
        const meta = v.getUint8(p++); const mlen = vlq();
        if (meta === 0x51) events.push({ tick, type: 'tempo', tempo: (v.getUint8(p) << 16) | (v.getUint8(p + 1) << 8) | v.getUint8(p + 2) });
        else if (meta === 0x03) { const s0 = p; events.push({ tick, type: 'name', text: str(mlen) }); p = s0; }
        p += mlen;
      } else if (status === 0xf0 || status === 0xf7) {
        p += vlq();
      } else if (type === 0x90 || type === 0x80) {
        const note = v.getUint8(p++); const vel = v.getUint8(p++);
        events.push({ tick, type: type === 0x90 && vel > 0 ? 'on' : 'off', ch, a: note, b: vel });
      } else if (type === 0xc0) {
        events.push({ tick, type: 'program', ch, a: v.getUint8(p++) });
      } else if (type === 0xd0) {
        p += 1;
      } else {
        p += 2; // 0xa0, 0xb0, 0xe0
      }
    }
    p = end;
    rawTracks.push(events);
  }

  // Tempo map (from all tracks; format 1 keeps it in track 0).
  const tempos = rawTracks.flat().filter(e => e.type === 'tempo').sort((a, b) => a.tick - b.tick);
  const segments: { tick: number; sec: number; spt: number }[] = [{ tick: 0, sec: 0, spt: 0.5 / division }];
  for (const e of tempos) {
    const last = segments[segments.length - 1];
    const sec = last.sec + (e.tick - last.tick) * last.spt;
    const spt = e.tempo! / 1e6 / division;
    if (e.tick === last.tick) { last.spt = spt; } else segments.push({ tick: e.tick, sec, spt });
  }
  const toSec = (tick: number) => {
    let s = segments[0];
    for (const seg of segments) { if (seg.tick <= tick) s = seg; else break; }
    return s.sec + (tick - s.tick) * s.spt;
  };

  let songName = '';
  const tracks: MidiTrack[] = [];
  rawTracks.forEach((events, ti) => {
    const name = events.find(e => e.type === 'name')?.text?.trim() ?? '';
    if (ti === 0 && name) songName = name;
    // Split by channel: a format-0 file puts every instrument in one track.
    const byCh = new Map<number, { notes: MidiNote[]; program: number }>();
    const open = new Map<string, { tick: number; vel: number }>();
    for (const e of events) {
      if (e.ch === undefined) continue;
      const entry = byCh.get(e.ch) ?? { notes: [], program: -1 };
      byCh.set(e.ch, entry);
      if (e.type === 'program') entry.program = e.a!;
      const key = `${e.ch}:${e.a}`;
      if (e.type === 'on') { open.set(key, { tick: e.tick, vel: e.b! }); }
      if (e.type === 'off') {
        const o = open.get(key);
        if (o) {
          const t = toSec(o.tick);
          entry.notes.push({ t, d: Math.max(0.05, toSec(e.tick) - t), midi: e.a!, vel: o.vel / 127 });
          open.delete(key);
        }
      }
    }
    for (const [ch, { notes, program }] of byCh) {
      if (!notes.length) continue;
      notes.sort((a, b) => a.t - b.t);
      tracks.push({
        index: tracks.length,
        name: name || instrumentName(program, ch),
        channel: ch, program, isDrums: ch === 9, notes,
      });
    }
  });

  const duration = Math.max(0, ...tracks.flatMap(t => t.notes.map(n => n.t + n.d)));
  return { name: songName, duration, tracks };
}

export function instrumentName(program: number, channel: number): string {
  if (channel === 9) return 'Drums';
  if (program < 0) return `Channel ${channel + 1}`;
  if (program >= 24 && program <= 31) return ['Nylon guitar', 'Steel guitar', 'Jazz guitar', 'Clean guitar', 'Muted guitar', 'Overdriven guitar', 'Distortion guitar', 'Guitar harmonics'][program - 24];
  if (program >= 32 && program <= 39) return 'Bass';
  if (program <= 7) return 'Piano';
  if (program >= 40 && program <= 55) return 'Strings';
  if (program >= 56 && program <= 63) return 'Brass';
  if (program >= 64 && program <= 79) return 'Woodwind';
  if (program >= 80 && program <= 95) return 'Synth';
  return `Instrument ${program}`;
}

/** Best guess at the lead guitar part: guitar programs first, then by note count. */
export function guessGuitarTrack(song: MidiSong): number {
  const melodic = song.tracks.filter(t => !t.isDrums);
  const score = (t: MidiTrack) =>
    (t.program >= 29 && t.program <= 30 ? 3000 : t.program >= 24 && t.program <= 31 ? 2000 : 0)
    + (/guitar|gtr|lead/i.test(t.name) ? 1500 : 0) - (/bass/i.test(t.name) || (t.program >= 32 && t.program <= 39) ? 5000 : 0)
    + t.notes.length;
  return (melodic.sort((a, b) => score(b) - score(a))[0] ?? song.tracks[0])?.index ?? 0;
}
