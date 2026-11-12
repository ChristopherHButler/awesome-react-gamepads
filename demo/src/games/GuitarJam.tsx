import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGamepads, type AxesDetails, type ButtonDetails } from 'awesome-react-gamepads';
import { SONGS, GENRES, buildChart, freq, toneOf, type ChartNote, type Song } from './songs';
import {
  loadMySongs, saveMySongs, gridToSong, newGridSong, type GridSong,
  loadTabSongs, saveTabSongs, tabToSong, newTabSong, type TabSong,
} from './customSongs';
import TabImporter from './TabImporter';
import {
  importChartFile, loadChartMetas, saveChartMetas, loadChartZip, deleteChartZip, parseChartZip,
  CHART_SOURCES, DIFFICULTIES, type ChartSongMeta, type Difficulty,
} from './chartImport';
import SongEditor from './SongEditor';
import { pluck, strumChord, bend, mute, twang, warm, audio, TONES, TONE_IDS, type ToneId, type Voice } from './guitarSynth';

/**
 * Guitar Jam — a small Guitar Hero-style game for checking a guitar controller,
 * playing real (public-domain) melodies with a plucked-string sound.
 *
 * Kid mode: 3 frets, slower, just press the fret (no strum), can't fail.
 * Normal:   5 frets, hold the fret and strum.
 * Menu:     strum up/down to pick a song, green or Start to play, red to switch mode.
 * Editor:   write your own songs on a step grid (SongEditor), saved under My songs.
 * Keyboard: A S D F G = frets, Space/Enter = strum, Q = star power, ↑/↓ = pick song.
 */

const W = 520;
const H = 640;
const STRIKE_Y = H - 90;
const LANES = [
  { name: 'GreenFret',  color: '#22c55e', key: 'KeyA' },
  { name: 'RedFret',    color: '#ef4444', key: 'KeyS' },
  { name: 'YellowFret', color: '#eab308', key: 'KeyD' },
  { name: 'BlueFret',   color: '#3b82f6', key: 'KeyF' },
  { name: 'OrangeFret', color: '#f97316', key: 'KeyG' },
];
const HIT_WINDOW = 0.17;     // default seconds either side of the line (built-in songs)
/** Timing window by level: easier levels forgive more. */
const WINDOWS: Record<string, number> = { kid: 0.22, easy: 0.2, medium: 0.18, hard: 0.16, expert: 0.14 };
/** Strumming a moment before landing the fret still counts within this (real) time. */
const FRET_GRACE_MS = 100;
const LATENCY_KEY = 'guitarJam.latencyMs';
const LATENCIES = [0, 50, 100, 150, 200, 250, 300];
const STRUM_DEBOUNCE = 0.07; // the strum bar can bounce up↔down on one flick

type Mode = 'kid' | 'normal';
const MODES: Record<Mode, { label: string; lanes: number; tempo: number; minGap: number; travel: number; hint: string; color: string }> = {
  kid:    { label: 'Kid mode', lanes: 3, tempo: 0.8, minGap: 0.35, travel: 2.6, hint: '3 frets · just press the fret · can’t fail', color: '#4ade80' },
  normal: { label: 'Normal',   lanes: 5, tempo: 1,   minGap: 0,    travel: 1.8, hint: '5 frets · hold fret + strum',               color: '#fbbf24' },
};

interface Note extends ChartNote { state: 'live' | 'hit' | 'miss'; /** Chart chords: every fret in the chord. */ frets?: number[] }
const LEAD = 2; // seconds before the first note
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }

const MISS_SOUND_KEY = 'guitarJam.missSound';
const TONE_KEY = 'guitarJam.tone';
const SPEED_KEY = 'guitarJam.speed';
const SPEEDS = [0.5, 0.6, 0.75, 0.85, 1, 1.1, 1.25];
function loadSpeed(): number {
  try { const v = Number(localStorage.getItem(SPEED_KEY)); return SPEEDS.includes(v) ? v : 1; } catch { return 1; }
}
function loadToneOverride(): ToneId | 'song' {
  try { const v = localStorage.getItem(TONE_KEY); return v && v in TONES ? (v as ToneId) : 'song'; } catch { return 'song'; }
}
function loadMissSound(): boolean {
  try { return localStorage.getItem(MISS_SOUND_KEY) !== 'off'; } catch { return true; }
}

const laneX = (lane: number, lanes: number) => W / 2 + (lane - (lanes - 1) / 2) * 92;

export default function GuitarJam() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'menu' | 'play' | 'done' | 'edit' | 'paste'>('menu');
  const [mode, setMode] = useState<Mode>('kid');
  const [songIdx, setSongIdx] = useState(0);
  const [result, setResult] = useState({ score: 0, hits: 0, total: 0, bestStreak: 0 });
  const [bests, setBests] = useState<Record<string, number>>({});
  const [mySongs, setMySongs] = useState<GridSong[]>(loadMySongs);
  const [editing, setEditing] = useState<GridSong | null>(null);
  const [tabSongs, setTabSongs] = useState<TabSong[]>(loadTabSongs);
  const [pasting, setPasting] = useState<TabSong | null>(null);
  const [chartMetas, setChartMetas] = useState<ChartSongMeta[]>(loadChartMetas);
  const [chartDiff, setChartDiff] = useState<Difficulty>(() => {
    try { const v = localStorage.getItem('guitarJam.chartDiff'); return (DIFFICULTIES as string[]).includes(v ?? '') ? (v as Difficulty) : 'medium'; } catch { return 'medium'; }
  });
  const chartDiffRef = useRef(chartDiff);
  chartDiffRef.current = chartDiff;
  const [chartStatus, setChartStatus] = useState('');
  const [dragOver, setDragOver] = useState(false);
  /** 'ready' = waiting for the player to press Start; 'paused' = paused mid-song. */
  const [pauseState, setPauseState] = useState<'ready' | 'paused' | null>(null);
  const [menuSel, setMenuSel] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const allSongs = useMemo<Song[]>(
    () => [
      ...SONGS, ...mySongs.map(gridToSong), ...tabSongs.map(tabToSong),
      ...chartMetas.map((c): Song => ({
        id: c.id, title: c.title, by: c.artist || 'Chart', genre: 'Rock', level: 'Medium', bpm: 120, melody: '', chartId: c.id,
      })),
    ],
    [mySongs, tabSongs, chartMetas],
  );
  const allSongsRef = useRef(allSongs);
  allSongsRef.current = allSongs;
  const [missSound, setMissSound] = useState(loadMissSound);
  const [toneOverride, setToneOverride] = useState<ToneId | 'song'>(loadToneOverride);
  const [speed, setSpeed] = useState(loadSpeed);
  const [latencyMs, setLatencyMs] = useState<number>(() => {
    try { const v = Number(localStorage.getItem(LATENCY_KEY)); return LATENCIES.includes(v) ? v : 0; } catch { return 0; }
  });
  const latencyRef = useRef(latencyMs);
  latencyRef.current = latencyMs;
  const chooseLatency = (v: number) => {
    setLatencyMs(v);
    try { localStorage.setItem(LATENCY_KEY, String(v)); } catch { /* ignore */ }
  };
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const chooseSpeed = (v: number) => {
    setSpeed(v);
    try { localStorage.setItem(SPEED_KEY, String(v)); } catch { /* ignore */ }
  };
  const toneOverrideRef = useRef(toneOverride);
  toneOverrideRef.current = toneOverride;
  const chooseTone = (v: ToneId | 'song') => {
    setToneOverride(v);
    try { localStorage.setItem(TONE_KEY, v); } catch { /* ignore */ }
    if (v !== 'song') pluck(freq(64), v, 0.7); // preview: an E
  };
  const missSoundRef = useRef(missSound);
  missSoundRef.current = missSound;
  const toggleMissSound = () => setMissSound(on => {
    try { localStorage.setItem(MISS_SOUND_KEY, on ? 'off' : 'on'); } catch { /* ignore */ }
    if (!on) twang(); // preview when switching on
    return !on;
  });

  // Live input + game state in refs so the render loop never restarts.
  const held = useRef<boolean[]>([false, false, false, false, false]);
  const whammy = useRef(0);
  const tiltBase = useRef<number | null>(null);
  const tilted = useRef(false);
  const lastStrum = useRef(-1);
  const voice = useRef<Voice | null>(null);
  const g = useRef({
    mode: 'kid' as Mode, song: SONGS[0] as Song, tone: 'clean' as ToneId, speed: 1, start: 0, end: 0, notes: [] as Note[], score: 0, streak: 0, bestStreak: 0,
    hits: 0, star: 0, starUntil: 0, flash: [0, 0, 0, 0, 0], sparks: [] as Spark[], missFlash: 0, msg: '', msgT: 0,
    /** Chart songs: the game clock follows the song audio. */
    clock: null as (() => number) | null,
    stems: [] as HTMLAudioElement[],
    guitarStem: null as HTMLAudioElement | null,
    /** Chart visuals drawn behind the highway. */
    bgImage: null as ImageBitmap | null,
    bgVideo: null as HTMLVideoElement | null,
    /** Pause / ready handling: while paused the clock is frozen at `frozenT`. */
    pausedAt: null as number | null,
    frozenT: 0,
    /** Hit window (song seconds) and whether extra held frets are forgiven. */
    window: HIT_WINDOW,
    lenient: true,
    /** Chart songs: audio starts when the count-in reaches the first beat. */
    main: null as HTMLAudioElement | null,
    audioStarted: false,
    playing: false,
    resync: false,
  });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const menuRef = useRef({ mode, songIdx });
  menuRef.current = { mode, songIdx };

  /** Per-song input state must not leak from the previous song (each song's clock starts at 0). */
  const resetInput = () => {
    if (pendingStrum.current) { window.clearTimeout(pendingStrum.current.timer); pendingStrum.current = null; }
    lastStrum.current = -Infinity;
    tiltBase.current = null;
    tilted.current = false;
  };

  const now = () => {
    const s = g.current;
    if (s.pausedAt !== null) return s.frozenT;
    return s.clock ? s.clock() : performance.now() / 1000 - s.start;
  };

  /** Freezes the song (and its audio). */
  const pause = (why: 'ready' | 'paused' = 'paused') => {
    const s = g.current;
    if (phaseRef.current !== 'play' || s.pausedAt !== null) return;
    s.frozenT = now();
    s.pausedAt = performance.now() / 1000;
    s.stems.forEach(el => el.pause());
    s.bgVideo?.pause();
    voice.current?.stop();
    setMenuSel(0);
    setPauseState(why);
  };
  /** Starts the song from the Ready screen, or resumes it after a pause. */
  const resume = () => {
    const s = g.current;
    if (phaseRef.current !== 'play' || s.pausedAt === null) return;
    s.start += performance.now() / 1000 - s.pausedAt; // the paused time doesn't count
    s.pausedAt = null;
    s.resync = true;
    if (s.audioStarted) {
      s.stems.forEach(el => el.play().catch(() => {}));
      s.bgVideo?.play().catch(() => {});
    }
    setPauseState(null);
  };
  const togglePause = () => (g.current.pausedAt === null ? pause() : resume());

  /** Stop and start the same song over from the Ready screen. */
  const restart = () => {
    const s = g.current;
    stopStems();
    const idx = allSongsRef.current.findIndex(x => x.id === s.song.id);
    start(s.mode, idx >= 0 ? idx : 0, s.song);
  };
  /** Leave the song without a score screen. */
  const quitToSongs = () => {
    stopStems();
    setPauseState(null);
    setPhase('menu');
  };
  const pauseStateRef = useRef(pauseState);
  pauseStateRef.current = pauseState;
  const menuSelRef = useRef(menuSel);
  menuSelRef.current = menuSel;
  const pauseMenu = (): { label: string; run: () => void }[] =>
    pauseStateRef.current === null ? [] : pauseStateRef.current === 'ready'
      ? [{ label: '▶ Start', run: resume }, { label: '← Back to songs', run: quitToSongs }]
      : [{ label: '▶ Resume', run: resume }, { label: '↺ Restart', run: restart }, { label: '← Quit to songs', run: quitToSongs }];
  const menuMove = (d: number) => { const n = pauseMenu().length; if (n) setMenuSel(i => (i + d + n) % n); };
  const menuSelect = () => { const items = pauseMenu(); items[Math.min(menuSelRef.current, items.length - 1)]?.run(); };
  const pauseRef = useRef({ pause, resume, togglePause, restart, menuMove, menuSelect });
  pauseRef.current = { pause, resume, togglePause, restart, menuMove, menuSelect };
  // Switching tabs or apps pauses the song.
  useEffect(() => {
    const onBlur = () => pauseRef.current.pause();
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);

  const stopStems = () => {
    for (const el of g.current.stems) { el.pause(); URL.revokeObjectURL(el.src); }
    if (g.current.bgVideo) { g.current.bgVideo.pause(); URL.revokeObjectURL(g.current.bgVideo.src); }
    g.current.stems = []; g.current.guitarStem = null; g.current.clock = null;
    g.current.bgVideo = null; g.current.bgImage = null;
  };
  useEffect(() => () => stopStems(), []); // leaving the page stops the music

  const start = useCallback((m: Mode, idx: number, songOverride?: Song) => {
    audio();
    const song = songOverride ?? allSongsRef.current[idx];
    if (!song) return;
    stopStems();
    if (song.chartId) { startChart(m, idx, song); return; }
    const { lanes, tempo, minGap } = MODES[m];
    const speed = speedRef.current;
    const notes: Note[] = buildChart(song, lanes, tempo * speed, minGap).map(n => ({ ...n, state: 'live' }));
    const tone = toneOverrideRef.current === 'song' ? toneOf(song) : toneOverrideRef.current;
    warm(notes.flatMap(n => (n.chord ?? [n.midi]).map(freq)), tone);
    const last = notes[notes.length - 1];
    g.current = {
      mode: m, song, tone, speed, start: performance.now() / 1000, end: (last?.t ?? 0) + 2.5, notes, score: 0, streak: 0,
      bestStreak: 0, hits: 0, star: 0, starUntil: 0, flash: [0, 0, 0, 0, 0], sparks: [], missFlash: 0,
      msg: song.title, msgT: 1.8, clock: null, stems: [], guitarStem: null, bgImage: null, bgVideo: null,
      pausedAt: performance.now() / 1000, frozenT: 0, main: null, audioStarted: false, playing: false, resync: false,
      window: m === 'kid' ? WINDOWS.kid : HIT_WINDOW, lenient: true,
    };
    resetInput();
    setMenuSel(0);
    setPauseState('ready');
    setMode(m);
    setSongIdx(idx);
    setPhase('play');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Starts an imported chart: real song audio, the chart's own notes. */
  const startChart = async (m: Mode, idx: number, song: Song) => {
    setChartStatus(`Loading “${song.title}”…`);
    try {
      const data = await loadChartZip(song.chartId!);
      if (!data) throw new Error('The chart file is missing from this browser — import it again.');
      const chart = await parseChartZip(data);
      // Kid mode plays the easiest part; Normal plays the chosen level (or the nearest one).
      const order: Difficulty[] = m === 'kid'
        ? ['easy', 'medium', 'hard', 'expert']
        : [chartDiffRef.current, ...DIFFICULTIES.filter(d => d !== chartDiffRef.current)];
      const diff = order.find(d => chart.parts[d]?.length)!;
      const { lanes, tempo } = MODES[m];
      const rate = tempo * speedRef.current;

      const notes: Note[] = [];
      let lastT = -1;
      for (const h of chart.parts[diff]!) {
        const t = LEAD + h.t + chart.offset;
        if (t - lastT < (m === 'kid' ? 0.35 : 0.04)) continue;
        lastT = t;
        const frets = [...new Set(h.frets.map(f => (lanes === 5 ? f : Math.min(2, f))))].sort((a, b) => a - b);
        notes.push({ t, lane: frets[frets.length - 1], midi: 0, label: '', frets, state: 'live' });
      }

      const stems = chart.audio.map(a => {
        const el = new Audio(URL.createObjectURL(new Blob([a.bytes as BlobPart])));
        el.dataset.name = a.name;
        el.preservesPitch = true;       // slower speed without lowering the pitch
        el.playbackRate = rate;
        return el;
      });
      await Promise.all(stems.map(el => new Promise<void>(res => {
        if (el.readyState >= 3) return res();
        el.oncanplaythrough = () => res();
        el.onerror = () => res();
      })));
      const main = stems.find(el => el.dataset.name!.startsWith('song.')) ?? stems[0];

      // Visuals: a background video plays muted alongside the music; otherwise a still image.
      let bgVideo: HTMLVideoElement | null = null;
      let bgImage: ImageBitmap | null = null;
      if (chart.video) {
        bgVideo = document.createElement('video');
        bgVideo.src = URL.createObjectURL(new Blob([chart.video.bytes as BlobPart]));
        bgVideo.muted = true; bgVideo.playsInline = true; bgVideo.loop = true;
        bgVideo.playbackRate = rate;
      } else if (chart.background ?? chart.album) {
        try { bgImage = await createImageBitmap(new Blob([(chart.background ?? chart.album)! as BlobPart])); } catch { /* not an image */ }
      }
      const guitarStem = stems.find(el => el.dataset.name!.startsWith('guitar.')) ?? null;

      // Clock: counts in for LEAD seconds, then follows the audio (smoothed between updates).
      // The game loop starts the audio when the count-in reaches the first beat.
      const perfStart = performance.now() / 1000;
      let lastCT = -1, lastPerf = 0;
      const clock = () => {
        const st = g.current;
        const p = performance.now() / 1000;
        if (!st.playing) return (p - st.start) * rate;
        const ct = main.currentTime;
        if (st.resync || ct !== lastCT) { lastCT = ct; lastPerf = p; st.resync = false; }
        // Bluetooth headphones play late: shift the game back so notes meet the line with the sound.
        return LEAD + ct + (p - lastPerf) * rate - (latencyRef.current / 1000) * rate;
      };

      const lastNote = notes[notes.length - 1]?.t ?? 0;
      g.current = {
        mode: m, song, tone: 'clean', speed: speedRef.current, start: perfStart,
        end: Math.max(lastNote + 3, LEAD + (Number.isFinite(main.duration) ? main.duration : 0) + 0.5),
        notes, score: 0, streak: 0, bestStreak: 0, hits: 0, star: 0, starUntil: 0, flash: [0, 0, 0, 0, 0],
        sparks: [], missFlash: 0, msg: `${song.title} · ${diff[0].toUpperCase()}${diff.slice(1)}`, msgT: 2,
        clock, stems, guitarStem, bgImage, bgVideo,
        pausedAt: perfStart, frozenT: 0, main, audioStarted: false, playing: false, resync: false,
        window: m === 'kid' ? WINDOWS.kid : WINDOWS[diff], lenient: m === 'kid' || diff === 'easy' || diff === 'medium',
      };
      resetInput();
      setMenuSel(0);
      setPauseState('ready');
      setChartStatus('');
      setMode(m);
      setSongIdx(idx);
      setPhase('play');
    } catch (e: any) {
      setChartStatus(`Couldn’t play that chart: ${e?.message ?? e}`);
    }
  };

  const endSongRef = useRef<() => void>(() => {});
  const endSong = () => {
    const s = g.current;
    stopStems();
    setResult({ score: s.score, hits: s.hits, total: s.notes.length, bestStreak: s.bestStreak });
    setPhase('done');
  };
  endSongRef.current = endSong;

  const multiplier = () => {
    const s = g.current;
    const base = Math.min(4, 1 + Math.floor(s.streak / 10));
    return now() < s.starUntil ? base * 2 : base;
  };

  const hitNote = (n: Note) => {
    const s = g.current;
    n.state = 'hit';
    s.streak++; s.hits++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    s.score += 50 * multiplier();
    s.flash[n.lane] = 0.25;
    if (s.streak % 10 === 0) { s.star = Math.min(1, s.star + 0.5); s.msg = `${s.streak} note streak!`; s.msgT = 1.2; }
    const lanes = MODES[s.mode].lanes;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220;
      s.sparks.push({ x: laneX(n.lane, lanes), y: STRIKE_Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 0.5, color: LANES[n.lane].color });
    }
    if (s.stems.length) {
      if (s.guitarStem) s.guitarStem.volume = 1; // you're playing: the guitar track is back
      for (const f of n.frets ?? []) s.flash[f] = 0.25;
      return;
    }
    voice.current?.stop();
    voice.current = n.chord ? strumChord(n.chord.map(freq), s.tone, 0.85) : pluck(freq(n.midi), s.tone, 0.8);
    bend(voice.current, whammy.current);
  };

  /** A note went by unplayed, or the wrong fret was strummed. */
  const missed = (wrongStrum: boolean) => {
    const s = g.current;
    if (s.guitarStem) s.guitarStem.volume = 0.1; // miss: the guitar drops out, like the real game
    if (missSoundRef.current) twang();
    else if (wrongStrum) mute();
    if (s.mode === 'kid') return; // no streak loss in kid mode
    s.streak = 0; s.missFlash = 0.25;
  };

  /** Does what's held match this note? Chords need their frets; easy levels forgive extra frets. */
  const matches = (n: Note): boolean => {
    const s = g.current;
    const heldLanes = held.current.map((h, i) => (h ? i : -1)).filter(i => i >= 0);
    const top = heldLanes.length ? heldLanes[heldLanes.length - 1] : -1;
    const frets = n.frets && n.frets.length ? n.frets : [n.lane];
    if (!frets.every(f => held.current[f])) return false;
    if (s.lenient) return true;                                   // right frets held — extras are fine
    if (frets.length > 1) return heldLanes.every(h => frets.includes(h) || h < frets[0]); // chord (+ lower anchors)
    return top === n.lane;                                        // single: highest held fret (anchoring)
  };
  const pendingStrum = useRef<{ note: Note; timer: number } | null>(null);

  const strum = useCallback(() => {
    if (phaseRef.current !== 'play' || g.current.pausedAt !== null) return;
    const s = g.current;
    if (s.mode === 'kid') return; // kid mode: frets only
    const t = now();
    if (t >= lastStrum.current && t - lastStrum.current < STRUM_DEBOUNCE) return;
    lastStrum.current = t;
    let target: Note | undefined;
    for (const n of s.notes) {
      if (n.state !== 'live' || Math.abs(n.t - t) > s.window) continue;
      if (!target || Math.abs(n.t - t) < Math.abs(target.t - t)) target = n;
    }
    if (!target) return; // strumming between notes is ignored
    if (matches(target)) { hitNote(target); return; }
    // Wrong frets right now — but players often strum a hair before the fret lands. Wait briefly.
    if (pendingStrum.current) window.clearTimeout(pendingStrum.current.timer);
    const note = target;
    const timer = window.setTimeout(() => {
      if (pendingStrum.current?.note === note) { pendingStrum.current = null; if (note.state === 'live') missed(true); }
    }, FRET_GRACE_MS);
    pendingStrum.current = { note, timer };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fret = useCallback((lane: number, down: boolean) => {
    held.current[lane] = down;
    if (!down || phaseRef.current !== 'play' || g.current.pausedAt !== null) return;
    const s = g.current;
    // A strum just happened and this fret completes it: count the hit.
    const p = pendingStrum.current;
    if (p && p.note.state === 'live' && matches(p.note)) {
      window.clearTimeout(p.timer);
      pendingStrum.current = null;
      hitNote(p.note);
      return;
    }
    if (s.mode !== 'kid') return;
    const t = now();
    let target: Note | undefined;
    for (const n of s.notes) {
      if (n.state !== 'live' || !(n.lane === lane || n.frets?.includes(lane)) || Math.abs(n.t - t) > s.window) continue;
      if (!target || Math.abs(n.t - t) < Math.abs(target.t - t)) target = n;
    }
    if (target) hitNote(target);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const starPower = useCallback(() => {
    if (phaseRef.current !== 'play') return;
    const s = g.current;
    if (s.star < 1) return;
    s.star = 0; s.starUntil = now() + 8; s.msg = 'STAR POWER!'; s.msgT = 1.5;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Menu navigation (works from the guitar alone) ───────────────────────────
  const inMenu = () => phaseRef.current === 'menu' || phaseRef.current === 'done';
  const moveSong = useCallback((dir: number) => {
    if (!inMenu()) return;
    const n = allSongsRef.current.length;
    setSongIdx(i => (i + dir + n) % n);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const startSelected = useCallback(() => {
    if (!inMenu()) return;
    start(menuRef.current.mode, menuRef.current.songIdx);
  }, [start]);
  const toggleMode = useCallback(() => {
    if (!inMenu()) return;
    setMode(m => (m === 'kid' ? 'normal' : 'kid'));
  }, []);

  // ── My songs ───────────────────────────────────────────────────────────────
  const upsertMySong = (song: GridSong): GridSong[] => {
    const exists = mySongs.some(x => x.id === song.id);
    const next = exists ? mySongs.map(x => (x.id === song.id ? song : x)) : [...mySongs, song];
    setMySongs(next);
    saveMySongs(next);
    return next;
  };
  const deleteMySong = (id: string) => {
    const next = mySongs.filter(x => x.id !== id);
    setMySongs(next);
    saveMySongs(next);
    setSongIdx(0);
  };
  const openEditor = (song: GridSong) => { setEditing(song); setPhase('edit'); };

  const upsertTabSong = (song: TabSong): TabSong[] => {
    const exists = tabSongs.some(x => x.id === song.id);
    const next = exists ? tabSongs.map(x => (x.id === song.id ? song : x)) : [...tabSongs, song];
    setTabSongs(next);
    if (!saveTabSongs(next)) window.alert('Couldn’t save — browser storage is full. The song will play but won’t be kept.');
    return next;
  };
  const deleteTabSong = (id: string) => {
    const next = tabSongs.filter(x => x.id !== id);
    setTabSongs(next);
    saveTabSongs(next);
    setSongIdx(0);
  };
  const openPaste = (song: TabSong) => { setPasting(song); setPhase('paste'); };

  const importChart = async (file: File) => {
    setChartStatus(`Importing ${file.name}…`);
    try {
      const meta = await importChartFile(file);
      let count = 0;
      setChartMetas(prev => {
        const next = [...prev, meta];
        saveChartMetas(next);
        count = next.length;
        return next;
      });
      setSongIdx(SONGS.length + mySongs.length + tabSongs.length + Math.max(0, count - 1));
      setChartStatus(`Added “${meta.title}”${meta.artist ? ` by ${meta.artist}` : ''} · ${meta.difficulties.join(', ')}${meta.hasGuitarStem ? ' · guitar drops out when you miss' : ''}`);
    } catch (e: any) {
      setChartStatus(`Couldn’t import ${file.name}: ${e?.message ?? e}`);
    }
  };
  /** Drag & drop: any .zip dropped on the menu is imported, one after another. */
  const importDropped = async (files: FileList | null) => {
    const zips = [...(files ?? [])].filter(f => /\.zip$/i.test(f.name));
    if (!zips.length) { setChartStatus('Couldn’t import: drop .zip chart files (choose “.zip” when downloading).'); return; }
    for (const f of zips) await importChart(f);
  };
  const deleteChart = (id: string) => {
    const next = chartMetas.filter(c => c.id !== id);
    setChartMetas(next);
    saveChartMetas(next);
    deleteChartZip(id).catch(() => {});
    setSongIdx(0);
  };
  const chooseChartDiff = (d: Difficulty) => {
    setChartDiff(d);
    try { localStorage.setItem('guitarJam.chartDiff', d); } catch { /* ignore */ }
  };

  // ── Guitar input via awesome-react-gamepads ────────────────────────────────
  const onButtonDown = useCallback((b: ButtonDetails) => {
    const lane = LANES.findIndex(l => l.name === b.buttonName);
    if (lane < 0 || phaseRef.current === 'edit' || phaseRef.current === 'paste') return;
    if (isPaused()) {
      held.current[lane] = true;
      if (lane === 0) pauseRef.current.menuSelect();   // green: select
      if (lane === 1) pauseRef.current.resume();       // red: back to the song
      return;
    }
    if (phaseRef.current !== 'play') {
      if (lane === 0) startSelected();
      if (lane === 1) toggleMode();
      return;
    }
    fret(lane, true);
  }, [fret, startSelected, toggleMode]);
  const onButtonUp = useCallback((b: ButtonDetails) => {
    const lane = LANES.findIndex(l => l.name === b.buttonName);
    if (lane >= 0) fret(lane, false);
  }, [fret]);
  const isPaused = () => phaseRef.current === 'play' && g.current.pausedAt !== null;
  const onStrumUp = useCallback(() => {
    if (isPaused()) pauseRef.current.menuMove(-1);
    else if (phaseRef.current === 'play') strum(); else moveSong(-1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strum, moveSong]);
  const onStrumDown = useCallback(() => {
    if (isPaused()) pauseRef.current.menuMove(1);
    else if (phaseRef.current === 'play') strum(); else moveSong(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strum, moveSong]);
  const onWhamBar = useCallback((a: AxesDetails) => {
    // Whammy rests at one end; map it to 0..1 regardless of direction.
    whammy.current = Math.min(1, Math.abs(a.value + 1) / 2);
    bend(voice.current, whammy.current);
  }, []);
  const onTilt = useCallback((a: AxesDetails) => {
    // The first reading is the guitar's resting position; tilting moves away from it.
    if (tiltBase.current === null) { tiltBase.current = a.value; return; }
    const isTilted = Math.abs(a.value - tiltBase.current) > 0.5;
    if (isTilted && !tilted.current) starPower();
    tilted.current = isTilted;
  }, [starPower]);

  const { gamepad } = useGamepads({
    controllerProfile: 'guitar',
    onGamepadButtonDown: onButtonDown,
    onGamepadButtonUp: onButtonUp,
    onStrumUp,
    onStrumDown,
    onStarPower: starPower,
    onStart: () => (phaseRef.current === 'play' ? pauseRef.current.togglePause() : startSelected()),
    onWhamBar,
    onTilt,
  });

  // ── Keyboard fallback ──────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const lane = LANES.findIndex(l => l.key === e.code);
      if (lane >= 0) { if (!e.repeat && phaseRef.current === 'play') fret(lane, true); return; }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (phaseRef.current === 'play') {
          if (g.current.pausedAt !== null) { if (!e.repeat) pauseRef.current.menuSelect(); }
          else if (!e.repeat) strum();
        } else if (inMenu()) startSelected();
      }
      if (e.code === 'ArrowUp' && inMenu()) { e.preventDefault(); moveSong(-1); }
      if (e.code === 'ArrowDown' && inMenu()) { e.preventDefault(); moveSong(1); }
      if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && phaseRef.current === 'play' && g.current.pausedAt !== null) {
        e.preventDefault(); pauseRef.current.menuMove(e.code === 'ArrowUp' ? -1 : 1);
      }
      if (e.code === 'KeyR' && phaseRef.current === 'play') pauseRef.current.restart();
      if (e.code === 'KeyQ') starPower();
      if (e.code === 'KeyP' && phaseRef.current === 'play') pauseRef.current.togglePause();
      if (e.code === 'Escape' && phaseRef.current === 'play') pauseRef.current.togglePause();
    };
    const up = (e: KeyboardEvent) => {
      const lane = LANES.findIndex(l => l.key === e.code);
      if (lane >= 0) fret(lane, false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [fret, strum, starPower, startSelected, moveSong]);

  // ── Game loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    let last = performance.now();
    const loop = (ms: number) => {
      const dt = Math.min(0.05, (ms - last) / 1000); last = ms;
      const s = g.current;
      const { lanes, travel, tempo } = MODES[s.mode];
      const song = s.song;
      const t = now();
      const starOn = t < s.starUntil;
      const paused = s.pausedAt !== null;

      if (!paused && s.main && !s.audioStarted && t >= LEAD) {
        s.audioStarted = true;
        // Follow the audio once it really plays; if the browser blocks it, keep counting on our own.
        s.main.addEventListener('playing', () => { s.playing = true; }, { once: true });
        s.stems.forEach(el => { el.currentTime = 0; el.play().catch(() => {}); });
        s.bgVideo?.play().catch(() => {});
      }

      // Misses
      if (!paused) for (const n of s.notes) {
        if (n.state === 'live' && t - n.t > s.window && pendingStrum.current?.note !== n) { n.state = 'miss'; missed(false); }
      }
      if (!paused && t > s.end) {
        stopStems();
        setResult({ score: s.score, hits: s.hits, total: s.notes.length, bestStreak: s.bestStreak });
        setBests(b => {
          const key = `${s.mode}:${song.id}`;
          return { ...b, [key]: Math.max(b[key] ?? 0, s.score) };
        });
        setPhase('done');
        return;
      }

      // Background + highway
      ctx.fillStyle = '#0b0b0f'; ctx.fillRect(0, 0, W, H);
      const bg = s.bgVideo && s.bgVideo.readyState >= 2 ? s.bgVideo : s.bgImage;
      if (bg) {
        // Cover the canvas, then darken so the notes stay readable.
        const bw = 'videoWidth' in bg ? bg.videoWidth : bg.width;
        const bh = 'videoHeight' in bg ? bg.videoHeight : bg.height;
        const k = Math.max(W / bw, H / bh);
        ctx.drawImage(bg, (W - bw * k) / 2, (H - bh * k) / 2, bw * k, bh * k);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
      }
      const hwLeft = laneX(0, lanes) - 52, hwRight = laneX(lanes - 1, lanes) + 52;
      const hw = ctx.createLinearGradient(0, 0, 0, H);
      hw.addColorStop(0, '#0b0b0f'); hw.addColorStop(1, starOn ? '#1e3a5f' : '#1c1c24');
      ctx.fillStyle = hw;
      ctx.globalAlpha = bg ? 0.82 : 1;
      ctx.fillRect(hwLeft, 0, hwRight - hwLeft, H);
      ctx.globalAlpha = 1;
      // Beat lines
      const beat = 60 / (song.bpm * tempo * s.speed);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2;
      const lead = 2;
      if (!s.clock) for (let b = Math.floor((t - lead) / beat); b < (t - lead + travel) / beat + 1; b++) {
        const y = STRIKE_Y - ((lead + b * beat - t) / travel) * STRIKE_Y;
        ctx.beginPath(); ctx.moveTo(hwLeft, y); ctx.lineTo(hwRight, y); ctx.stroke();
      }
      for (let i = 0; i < lanes; i++) {
        const x = laneX(i, lanes);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }

      // Strike line (wobbles with the whammy)
      const wob = whammy.current * 6 * Math.sin(ms / 40);
      for (let i = 0; i < lanes; i++) {
        const x = laneX(i, lanes);
        s.flash[i] = Math.max(0, s.flash[i] - dt);
        ctx.beginPath(); ctx.arc(x, STRIKE_Y + wob, 30, 0, Math.PI * 2);
        ctx.fillStyle = held.current[i] ? LANES[i].color : 'rgba(0,0,0,0.6)';
        ctx.fill();
        ctx.lineWidth = 5; ctx.strokeStyle = LANES[i].color; ctx.stroke();
        if (s.flash[i] > 0) {
          ctx.globalAlpha = s.flash[i] * 4;
          ctx.beginPath(); ctx.arc(x, STRIKE_Y, 44, 0, Math.PI * 2);
          ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1;
        }
      }

      // Notes, labelled with their letter so kids can learn them
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const n of s.notes) {
        if (n.state === 'hit') continue;
        const y = STRIKE_Y - ((n.t - t) / travel) * STRIKE_Y;
        if (y < -40 || y > H + 40) continue;
        ctx.globalAlpha = n.state === 'miss' ? 0.25 : 1;
        for (const lane of n.frets ?? [n.lane]) {   // chords draw a gem on every fret
          const x = laneX(lane, lanes);
          ctx.beginPath(); ctx.ellipse(x, y, 30, 18, 0, 0, Math.PI * 2);
          ctx.fillStyle = starOn ? '#7dd3fc' : LANES[lane].color; ctx.fill();
          ctx.beginPath(); ctx.ellipse(x, y - 2, 18, 11, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
          if (n.label) {
            ctx.font = '800 14px system-ui, sans-serif'; ctx.fillStyle = '#0b0b0f';
            ctx.fillText(n.label, x, y - 1);
          }
        }
        ctx.globalAlpha = 1;
      }
      ctx.textBaseline = 'alphabetic';

      // Sparks
      s.sparks = s.sparks.filter(p => (p.life -= dt) > 0);
      for (const p of s.sparks) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt;
        ctx.globalAlpha = p.life * 2; ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;

      if (s.missFlash > 0) {
        s.missFlash -= dt;
        ctx.fillStyle = `rgba(239,68,68,${s.missFlash})`; ctx.fillRect(0, 0, W, H);
      }

      // HUD
      ctx.font = '700 22px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
      ctx.fillText(String(s.score), 16, 34);
      ctx.font = '600 13px system-ui, sans-serif'; ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Streak ${s.streak}`, 16, 54);
      if (s.speed !== 1) { ctx.fillStyle = '#fbbf24'; ctx.fillText(`${Math.round(s.speed * 100)}% speed`, 16, 72); }
      ctx.textAlign = 'right'; ctx.font = '800 26px system-ui, sans-serif';
      ctx.fillStyle = starOn ? '#7dd3fc' : '#fbbf24';
      ctx.fillText(`${multiplier()}x`, W - 16, 36);
      ctx.fillStyle = '#252530'; ctx.fillRect(W - 116, 46, 100, 8);
      ctx.fillStyle = s.star >= 1 ? '#7dd3fc' : '#3b82f6'; ctx.fillRect(W - 116, 46, 100 * s.star, 8);
      if (s.star >= 1) {
        ctx.font = '600 11px system-ui, sans-serif'; ctx.fillStyle = '#7dd3fc';
        ctx.fillText('Tilt or Star Power!', W - 16, 70);
      }
      // Progress, like a video player: strip across the top + time played / total / left.
      const total = Math.max(1, s.end - LEAD);
      const elapsed = Math.min(total, Math.max(0, t - LEAD));
      const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, W, 6);
      ctx.fillStyle = starOn ? '#7dd3fc' : '#4ade80'; ctx.fillRect(0, 0, W * (elapsed / total), 6);
      ctx.textAlign = 'center'; ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      const label = `${fmt(elapsed)} / ${fmt(total)}  ·  -${fmt(total - elapsed)}`;
      const lw = ctx.measureText(label).width + 16;
      ctx.fillRect(W / 2 - lw / 2, 10, lw, 20);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(label, W / 2, 24);
      if (s.msgT > 0) {
        s.msgT -= dt;
        ctx.globalAlpha = Math.min(1, s.msgT * 2);
        ctx.textAlign = 'center'; ctx.font = '900 30px system-ui, sans-serif'; ctx.fillStyle = '#fff';
        ctx.fillText(s.msg, W / 2, H / 2 - 60);
        ctx.globalAlpha = 1;
      }

      if (paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
        const ready = t < 0.01;
        ctx.font = '900 34px system-ui, sans-serif';
        ctx.fillText(ready ? song.title : 'Paused', W / 2, H / 2 - 110);
        if (ready && song.by) {
          ctx.font = '600 15px system-ui, sans-serif'; ctx.fillStyle = '#cbd5e1';
          ctx.fillText(song.by, W / 2, H / 2 - 80);
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const pct = result.total ? Math.round((result.hits / result.total) * 100) : 0;
  const lastSong = g.current.song;

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        {gamepad ? `🎸 ${gamepad.id}` : 'No guitar detected — use the header button to connect over USB, or play with A S D F G + Space'}
      </div>

      {phase === 'play' && (
        <>
          <div style={{ position: 'relative', width: W, height: H }}>
            <canvas ref={canvasRef} style={{ width: W, height: H, borderRadius: 12, border: '1px solid var(--border)' }} />
            {pauseState && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 40 }}>
                {pauseMenu().map((item, i) => (
                  <button key={item.label} className={`rumble-btn${i === menuSel ? ' test' : ''}`}
                    onMouseEnter={() => setMenuSel(i)} onClick={item.run}
                    style={{ minWidth: 220, fontSize: 16, padding: '10px 18px' }}>
                    {item.label}
                  </button>
                ))}
                <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 8, textAlign: 'center', lineHeight: 1.6 }}>
                  Guitar: strum to choose · <b style={{ color: '#22c55e' }}>green</b> to select · <b style={{ color: '#ef4444' }}>red</b> or START to {pauseState === 'ready' ? 'start' : 'resume'}<br />
                  Keyboard: ↑ ↓ · Enter · Esc · R restart
                </div>
              </div>
            )}
          </div>
          {!pauseState && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="rumble-btn" onClick={() => pause()}>❚❚ Pause (Esc / START)</button>
              <button className="rumble-btn" onClick={restart}>↺ Restart (R)</button>
            </div>
          )}
        </>
      )}

      {phase === 'edit' && editing && (
        <SongEditor
          song={editing}
          onCancel={() => { setEditing(null); setPhase('menu'); }}
          onSave={song => {
            const next = upsertMySong(song);
            setSongIdx(SONGS.length + next.findIndex(x => x.id === song.id));
            setEditing(null); setPhase('menu');
          }}
          onPlay={song => {
            const next = upsertMySong(song);
            const idx = SONGS.length + next.findIndex(x => x.id === song.id);
            setEditing(null);
            start(mode, idx, gridToSong(song));
          }}
        />
      )}

      {phase === 'paste' && pasting && (
        <TabImporter
          song={pasting}
          onCancel={() => { setPasting(null); setPhase('menu'); }}
          onSave={song => {
            const next = upsertTabSong(song);
            setSongIdx(SONGS.length + mySongs.length + next.findIndex(x => x.id === song.id));
            setPasting(null); setPhase('menu');
          }}
          onPlay={song => {
            const next = upsertTabSong(song);
            const idx = SONGS.length + mySongs.length + next.findIndex(x => x.id === song.id);
            setPasting(null);
            start(mode, idx, tabToSong(song));
          }}
        />
      )}

      {(phase === 'menu' || phase === 'done') && (
        <div
          onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
          onDrop={e => { e.preventDefault(); setDragOver(false); importDropped(e.dataTransfer.files); }}
          style={{
            width: W, minHeight: H, position: 'relative',
            outline: dragOver ? '3px dashed var(--accent)' : undefined, outlineOffset: 4, borderRadius: 12,
          }}>
          {dragOver && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, borderRadius: 12, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, pointerEvents: 'none' }}>
              📦 Drop chart .zip files to import
            </div>
          )}
        <div style={{ width: W, minHeight: H, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>🎸</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {phase === 'done' ? (pct >= 80 ? 'You rock!' : 'Nice jam!') : 'Guitar Jam'}
          </div>
          {phase === 'done' && (
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-secondary)' }}>
              {lastSong.title}: {result.score} points · {result.hits}/{result.total} notes ({pct}%) · best streak {result.bestStreak}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {(Object.keys(MODES) as Mode[]).map(m => (
              <button key={m} className="rumble-btn" onClick={() => setMode(m)}
                style={{ minWidth: 150, borderColor: mode === m ? MODES[m].color : undefined, color: mode === m ? MODES[m].color : undefined }}>
                {MODES[m].label}
                <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginTop: 4 }}>{MODES[m].hint}</div>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              Guitar sound
              <select value={toneOverride} onChange={e => chooseTone(e.target.value as ToneId | 'song')}
                style={{ background: 'var(--surface-raised)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', fontSize: 13 }}>
                <option value="song">Song’s own sound</option>
                {TONE_IDS.map(id => <option key={id} value={id}>{TONES[id].label}</option>)}
              </select>
            </label>
            {chartMetas.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }} title="For imported charts in Normal mode (Kid mode always plays Easy)">
                Chart level
                <select value={chartDiff} onChange={e => chooseChartDiff(e.target.value as Difficulty)}
                  style={{ background: 'var(--surface-raised)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', fontSize: 13 }}>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
                </select>
              </label>
            )}
            {chartMetas.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}
                title="Bluetooth headphones and speakers play sound late. If you hit on the beat but still miss, raise this. AirPods: try 150–250 ms.">
                Audio delay fix
                <select value={latencyMs} onChange={e => chooseLatency(Number(e.target.value))}
                  style={{ background: 'var(--surface-raised)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', fontSize: 13 }}>
                  {LATENCIES.map(v => <option key={v} value={v}>{v === 0 ? 'Off (wired / Mac speakers)' : `${v} ms${v === 200 ? ' (AirPods)' : ''}`}</option>)}
                </select>
              </label>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              Speed
              <select value={speed} onChange={e => chooseSpeed(Number(e.target.value))}
                style={{ background: 'var(--surface-raised)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', fontSize: 13 }}>
                {SPEEDS.map(v => <option key={v} value={v}>{v === 1 ? '100% (normal)' : `${Math.round(v * 100)}%`}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={missSound} onChange={toggleMissSound} />
              Twang on missed notes
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            {GENRES.filter(genre => SONGS.some(x => x.genre === genre.id)).map(genre => (
              <div key={genre.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={groupHeader}>{genre.emoji} {genre.label}</div>
                {SONGS.map((song, i) => song.genre !== genre.id ? null : (
                  <SongRow key={song.id} song={song} selected={i === songIdx} best={bests[`${mode}:${song.id}`]}
                    color={MODES[mode].color} onPlay={() => start(mode, i)} onHover={() => setSongIdx(i)} />
                ))}
              </div>
            ))}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={groupHeader}>⭐ My songs</div>
              {mySongs.map((gs, j) => {
                const i = SONGS.length + j;
                const song = allSongs[i];
                return (
                  <SongRow key={gs.id} song={song} selected={i === songIdx} best={bests[`${mode}:${song.id}`]}
                    color={MODES[mode].color} onPlay={() => start(mode, i)} onHover={() => setSongIdx(i)}
                    onEdit={() => openEditor(gs)}
                    onDelete={() => { if (window.confirm(`Delete “${gs.title}”?`)) deleteMySong(gs.id); }} />
                );
              })}
              {tabSongs.map((ts, j) => {
                const i = SONGS.length + mySongs.length + j;
                const song = allSongs[i];
                return (
                  <SongRow key={ts.id} song={song} selected={i === songIdx} best={bests[`${mode}:${song.id}`]}
                    color={MODES[mode].color} onPlay={() => start(mode, i)} onHover={() => setSongIdx(i)}
                    onEdit={() => openPaste(ts)}
                    onDelete={() => { if (window.confirm(`Delete “${ts.title}”?`)) deleteTabSong(ts.id); }} />
                );
              })}
              {chartMetas.map((c, j) => {
                const i = SONGS.length + mySongs.length + tabSongs.length + j;
                const song = allSongs[i];
                return (
                  <SongRow key={c.id} song={song} cover={c.cover} selected={i === songIdx} best={bests[`${mode}:${song.id}`]}
                    color={MODES[mode].color} onPlay={() => start(mode, i)} onHover={() => setSongIdx(i)}
                    onDelete={() => { if (window.confirm(`Delete “${c.title}”?`)) deleteChart(c.id); }} />
                );
              })}
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="rumble-btn" onClick={() => fileInput.current?.click()} style={{ flex: 1, borderStyle: 'dashed', borderColor: 'var(--accent)' }}>
                  📦 Import chart (.zip) — or drag &amp; drop
                </button>
                <input ref={fileInput} type="file" multiple accept=".zip,application/zip" style={{ display: 'none' }}
                  onChange={e => { const files = e.target.files; importDropped(files).finally(() => { e.target.value = ''; }); }} />
              </div>
              {chartStatus && <div style={{ fontSize: 12, color: chartStatus.startsWith('Couldn') ? 'var(--danger)' : 'var(--green)', textAlign: 'left' }}>{chartStatus}</div>}
              <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'left', lineHeight: 1.7 }}>
                Get Clone Hero / YARG charts (download as <b>.zip</b>):{' '}
                {CHART_SOURCES.map((src, k) => (
                  <span key={src.url}>
                    {k > 0 && ' · '}
                    <a href={src.url} target="_blank" rel="noreferrer" title={src.note} style={{ color: 'var(--blue)' }}>{src.name}</a>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="rumble-btn" onClick={() => openEditor(newGridSong())} style={{ flex: 1, borderStyle: 'dashed' }}>
                  + Write a new song
                </button>
                <button className="rumble-btn" onClick={() => openPaste(newTabSong())} style={{ flex: 1, borderStyle: 'dashed' }}>
                  📋 Paste a tab
                </button>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            On the guitar: <b>strum</b> to pick a song, <b>green</b> or <b>Start</b> to play, <b>red</b> to switch mode.<br />
            Every 10-note streak fills star power — <b>tilt the guitar</b> or press <b>Star Power</b> for double points.<br />
            The <b>whammy bar</b> bends the note you just played.
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

const groupHeader: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--muted)', textAlign: 'left', marginTop: 6,
};

function SongRow({ song, cover, selected, best, color, onPlay, onHover, onEdit, onDelete }: {
  song: Song; cover?: string; selected: boolean; best?: number; color: string;
  onPlay: () => void; onHover: () => void; onEdit?: () => void; onDelete?: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }} onMouseEnter={onHover}>
      <button className="rumble-btn" onClick={onPlay}
        style={{
          flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left',
          borderColor: selected ? color : undefined, background: selected ? 'var(--accent-dim)' : undefined,
        }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cover && <img src={cover} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />}
          {selected ? '▶ ' : ''}{song.title}
          {song.by && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}> · {song.by}</span>}
        </span>
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}>
          {best ? `best ${best} · ` : ''}{song.level}
        </span>
      </button>
      {onEdit && <button className="rumble-btn" title="Edit" onClick={onEdit}>✎</button>}
      {onDelete && <button className="rumble-btn" title="Delete" onClick={onDelete}>✕</button>}
    </div>
  );
}
