/**
 * Guitar synth for Guitar Jam.
 *
 * Strings are plucked with Karplus-Strong (a burst of noise circulating in a
 * delay line that loses its highs each round trip, like a real string). Each
 * tone preset then shapes that string: how bright the pick is, how long it
 * rings, power chords or single notes, overdrive, EQ, speaker cabinet, room
 * reverb and slapback echo. No samples needed.
 */

export type ToneId = 'clean' | 'acoustic' | 'blues' | 'southern' | 'funk' | 'punk' | 'rock';

interface ToneDef {
  label: string;
  hint: string;
  /** Pick brightness 0..1 (how much high end the initial noise burst keeps). */
  bright: number;
  /** Ring length: <1 rings longer, >1 dies faster. */
  damping: number;
  /** Frequency ratios played per note: [1] single note, [1, 1.5, 2] power chord. */
  chord: number[];
  /** Overdrive amount (0 = clean). */
  drive: number;
  /** Tone shaping before the overdrive, like an amp's input stage: cut lows (mud) and highs (fizz). */
  preHP?: number;
  preLP?: number;
  eq: { type: BiquadFilterType; f: number; q?: number; gain?: number }[];
  /** Speaker / pickup lowpass. */
  cab: number;
  level: number;
  reverb: number;
  slap: number;
  /** Seconds before the note is choked (funk/punk staccato); 0 = let ring. */
  choke: number;
}

export const TONES: Record<ToneId, ToneDef> = {
  clean: {
    label: 'Clean electric', hint: 'Bright and simple',
    bright: 0.5, damping: 1, chord: [1], drive: 0,
    eq: [{ type: 'peaking', f: 220, q: 0.9, gain: 4 }], cab: 4200, level: 0.9, reverb: 0.12, slap: 0, choke: 0,
  },
  acoustic: {
    label: 'Acoustic', hint: 'Steel-string, campfire',
    bright: 0.9, damping: 0.6, chord: [1], drive: 0,
    eq: [
      { type: 'peaking', f: 110, q: 1.2, gain: 5 },   // body resonance
      { type: 'peaking', f: 2800, q: 1, gain: 4 },    // string sparkle
      { type: 'peaking', f: 600, q: 1, gain: -3 },
    ],
    cab: 9000, level: 0.85, reverb: 0.22, slap: 0, choke: 0,
  },
  blues: {
    label: 'Blues', hint: 'Warm overdrive, mellow neck pickup',
    bright: 0.35, damping: 1.1, chord: [1], drive: 2.2, preHP: 80, preLP: 2500,
    eq: [{ type: 'peaking', f: 700, q: 0.8, gain: 3 }],
    cab: 2200, level: 0.4, reverb: 0.25, slap: 0, choke: 0,
  },
  southern: {
    label: 'Southern rock', hint: 'Gritty twang in a big room',
    bright: 0.6, damping: 1.2, chord: [1, 1.5], drive: 1.8, preHP: 90, preLP: 3800,
    eq: [{ type: 'peaking', f: 2300, q: 1.1, gain: 3 }, { type: 'peaking', f: 400, q: 1, gain: -2 }],
    cab: 4000, level: 0.42, reverb: 0.3, slap: 0.22, choke: 0,
  },
  funk: {
    label: 'Funk', hint: 'Snappy, clean and staccato',
    bright: 0.85, damping: 2.2, chord: [1], drive: 0,
    eq: [{ type: 'peaking', f: 1100, q: 2, gain: 7 }, { type: 'highpass', f: 160 }],
    cab: 6000, level: 0.95, reverb: 0.06, slap: 0, choke: 0.22,
  },
  punk: {
    label: 'Punk', hint: 'Fast, loud power chords',
    bright: 0.55, damping: 2, chord: [1, 1.5], drive: 5, preHP: 120, preLP: 3200,
    eq: [{ type: 'peaking', f: 800, q: 0.7, gain: -3 }, { type: 'peaking', f: 1800, q: 1, gain: 2 }],
    cab: 3000, level: 0.24, reverb: 0.05, slap: 0, choke: 0.35,
  },
  rock: {
    label: 'Hard rock', hint: 'Distorted power chords',
    bright: 0.45, damping: 1.8, chord: [1, 1.5], drive: 4.5, preHP: 110, preLP: 3000,
    eq: [{ type: 'peaking', f: 500, q: 0.8, gain: -2 }], cab: 2700, level: 0.26, reverb: 0.12, slap: 0, choke: 0,
  },
};

export const TONE_IDS = Object.keys(TONES) as ToneId[];

// ── Audio graph ──────────────────────────────────────────────────────────────
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbIn: GainNode | null = null;
const buses = new Map<ToneId, { input: GainNode; reverbSend: GainNode; slapSend: GainNode | null }>();
const cache = new Map<string, AudioBuffer>();

export function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    // Master: a gentle limiter so stacked chords never clip.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 6;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(comp).connect(ctx.destination);

    // Shared room reverb (synthetic impulse response: decaying stereo noise).
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    conv.buffer = ir;
    reverbIn = ctx.createGain();
    reverbIn.connect(conv).connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function bus(id: ToneId) {
  const existing = buses.get(id);
  if (existing) return existing;
  const ac = audio();
  const t = TONES[id];
  const input = ac.createGain();
  let node: AudioNode = input;

  if (t.drive > 0) {
    if (t.preHP) { const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = t.preHP; node.connect(hp); node = hp; }
    if (t.preLP) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = t.preLP; node.connect(lp); node = lp; }
    const pre = ac.createGain();
    pre.gain.value = t.drive;
    const shaper = ac.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(3 * x);
    }
    shaper.curve = curve;
    shaper.oversample = '4x';
    node.connect(pre).connect(shaper);
    node = shaper;
  }
  for (const f of t.eq) {
    const b = ac.createBiquadFilter();
    b.type = f.type; b.frequency.value = f.f;
    if (f.q !== undefined) b.Q.value = f.q;
    if (f.gain !== undefined) b.gain.value = f.gain;
    node.connect(b);
    node = b;
  }
  const cab = ac.createBiquadFilter();
  cab.type = 'lowpass'; cab.frequency.value = t.cab; cab.Q.value = 0.7;
  node.connect(cab);
  node = cab;
  if (t.drive > 0) {
    const cab2 = ac.createBiquadFilter();       // speakers roll off steeply: kill the fizz
    cab2.type = 'lowpass'; cab2.frequency.value = t.cab * 1.3; cab2.Q.value = 0.5;
    node.connect(cab2);
    node = cab2;
  }
  const level = ac.createGain();
  level.gain.value = t.level;
  node.connect(level).connect(master!);

  const reverbSend = ac.createGain();
  reverbSend.gain.value = t.reverb;
  level.connect(reverbSend).connect(reverbIn!);

  let slapSend: GainNode | null = null;
  if (t.slap > 0) {
    slapSend = ac.createGain();
    slapSend.gain.value = t.slap;
    const delay = ac.createDelay(1);
    delay.delayTime.value = 0.11;
    const fb = ac.createGain();
    fb.gain.value = 0.18;
    level.connect(slapSend).connect(delay).connect(master!);
    delay.connect(fb).connect(delay);
  }
  const made = { input, reverbSend, slapSend };
  buses.set(id, made);
  return made;
}

// ── Strings ──────────────────────────────────────────────────────────────────
function render(frequency: number, bright: number, damping: number): AudioBuffer {
  const ac = audio();
  const sr = ac.sampleRate;
  const buf = ac.createBuffer(1, Math.floor(sr * 2.4), sr);
  const y = buf.getChannelData(0);
  // The two-tap average below adds half a sample of delay; compensate for it.
  const P = sr / frequency - 0.5;
  const startAt = Math.ceil(P) + 1;

  // Pick: noise through a one-pole lowpass. Higher `bright` keeps more top end.
  let lp = 0;
  for (let i = 0; i < startAt; i++) {
    lp += bright * ((Math.random() * 2 - 1) - lp);
    y[i] = lp;
  }
  // Loss per round trip: lower notes ring longer; tone damping scales it.
  const baseLoss = 0.004 + Math.min(0.006, frequency / 200000);
  const decay = 1 - baseLoss * damping;
  for (let i = startAt; i < y.length; i++) {
    const pos = i - P;               // fractional read position keeps every note in tune
    const k = Math.floor(pos);
    const fr = pos - k;
    const d1 = y[k] * (1 - fr) + y[k + 1] * fr;
    const d2 = y[k - 1] * (1 - fr) + y[k] * fr;
    y[i] = decay * 0.5 * (d1 + d2);
  }
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < fade; i++) y[y.length - 1 - i] *= i / fade;
  return buf;
}

function buffer(frequency: number, bright = 0.5, damping = 1): AudioBuffer {
  const key = `${Math.round(frequency * 100)}:${bright}:${damping}`;
  let b = cache.get(key);
  if (!b) { b = render(frequency, bright, damping); cache.set(key, b); }
  return b;
}

/** Pre-renders a song's notes for a tone so the first hits don't stutter. */
export function warm(frequencies: number[], tone: ToneId = 'clean') {
  const t = TONES[tone];
  for (const f of new Set(frequencies)) for (const r of t.chord) buffer(f * r, t.bright, t.damping);
}

export interface Voice { sources: AudioBufferSourceNode[]; stop: () => void }

/** Plays a note in the given tone. Returns a voice that can be bent (whammy) or stopped. */
export function pluck(frequency: number, tone: ToneId = 'clean', volume = 0.8): Voice {
  const ac = audio();
  const t = TONES[tone];
  const g = ac.createGain();
  g.gain.value = volume;
  g.connect(bus(tone).input);
  const sources = t.chord.map(r => {
    const src = ac.createBufferSource();
    src.buffer = buffer(frequency * r, t.bright, t.damping);
    src.connect(g);
    src.start();
    return src;
  });
  const stop = (after = 0) => {
    const at = ac.currentTime + after;
    g.gain.setTargetAtTime(0, at, 0.03);
    sources.forEach(src => src.stop(at + 0.25));
  };
  if (t.choke > 0) stop(t.choke);
  return { sources, stop: () => stop() };
}

/** Plays several pitches together (a chord from a tab) through a tone's sound. */
export function strumChord(frequencies: number[], tone: ToneId = 'clean', volume = 0.8): Voice {
  if (frequencies.length === 1) return pluck(frequencies[0], tone, volume);
  const ac = audio();
  const t = TONES[tone];
  const g = ac.createGain();
  g.gain.value = volume / Math.sqrt(frequencies.length);
  g.connect(bus(tone).input);
  const sources = frequencies.map((f, i) => {
    const src = ac.createBufferSource();
    src.buffer = buffer(f, t.bright, t.damping);
    src.connect(g);
    src.start(ac.currentTime + i * 0.012); // a quick down-strum, low string first
    return src;
  });
  const stop = (after = 0) => {
    const at = ac.currentTime + after;
    g.gain.setTargetAtTime(0, at, 0.03);
    sources.forEach(src => src.stop(at + 0.25));
  };
  if (t.choke > 0) stop(t.choke + 0.05);
  return { sources, stop: () => stop() };
}

/** Bends a sounding voice: amount 0..1 → up to one semitone. */
export function bend(voice: Voice | null, amount: number) {
  if (!voice) return;
  const ac = audio();
  for (const src of voice.sources) {
    src.playbackRate.setTargetAtTime(Math.pow(2, amount / 12), ac.currentTime, 0.02);
  }
}

/** Muted "chk" for a wrong strum. */
export function mute() {
  const ac = audio();
  const len = Math.floor(ac.sampleRate * 0.06);
  const b = ac.createBuffer(1, len, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * 0.4;
  const src = ac.createBufferSource();
  const f = ac.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 900;
  src.buffer = b; src.connect(f).connect(master!); src.start();
}

let lastTwang = 0;

/**
 * Sour "twang" for a missed note: two slightly clashing low strings whose pitch
 * sags downward, like a string slipping out of tune. Rate-limited so a run of
 * misses doesn't pile up into a roar.
 */
export function twang() {
  const ac = audio();
  if (ac.currentTime - lastTwang < 0.12) return;
  lastTwang = ac.currentTime;
  const base = 98 + Math.random() * 30; // around G2–B2
  for (const ratio of [1, 1.06]) {      // ~a semitone apart → sour
    const src = ac.createBufferSource();
    src.buffer = buffer(base * ratio);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.55, ac.currentTime);
    g.gain.setTargetAtTime(0, ac.currentTime + 0.25, 0.08);
    src.playbackRate.setValueAtTime(1, ac.currentTime);
    src.playbackRate.exponentialRampToValueAtTime(0.82, ac.currentTime + 0.35);
    src.connect(g).connect(bus('clean').input);
    src.start();
    src.stop(ac.currentTime + 0.7);
  }
}
