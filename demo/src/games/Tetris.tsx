import { useCallback, useEffect, useRef, useState } from 'react';
import { useGamepads, type ButtonDetails, type AxesDetails } from 'awesome-react-gamepads';

const COLS = 10;
const ROWS = 20;
const CELL = 34;

type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
type Board = (string | null)[][];

const COLORS: Record<PieceType, string> = {
  I: '#00bcd4', O: '#fdd835', T: '#9c27b0',
  S: '#4caf50', Z: '#f44336', J: '#2196f3', L: '#ff9800',
};

// [rotation][cell] = [row, col] within bounding box
const SHAPES: Record<PieceType, [number, number][][]> = {
  I: [
    [[1,0],[1,1],[1,2],[1,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,1],[1,1],[2,1],[3,1]],
  ],
  O: [
    [[0,1],[0,2],[1,1],[1,2]],
    [[0,1],[0,2],[1,1],[1,2]],
    [[0,1],[0,2],[1,1],[1,2]],
    [[0,1],[0,2],[1,1],[1,2]],
  ],
  T: [
    [[0,1],[1,0],[1,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,1]],
    [[1,0],[1,1],[1,2],[2,1]],
    [[0,1],[1,0],[1,1],[2,1]],
  ],
  S: [
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,1],[1,2],[2,0],[2,1]],
    [[0,0],[1,0],[1,1],[2,1]],
  ],
  Z: [
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,2],[1,1],[1,2],[2,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[0,1],[1,0],[1,1],[2,0]],
  ],
  J: [
    [[0,0],[1,0],[1,1],[1,2]],
    [[0,1],[0,2],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,0],[2,1]],
  ],
  L: [
    [[0,2],[1,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[1,2],[2,0]],
    [[0,0],[0,1],[1,1],[2,1]],
  ],
};

const ALL_TYPES = Object.keys(SHAPES) as PieceType[];

interface Piece { type: PieceType; rot: number; x: number; y: number; }

interface GS {
  started: boolean; over: boolean; paused: boolean;
  board: Board; piece: Piece; next: PieceType;
  score: number; lines: number; level: number;
}

const randType = (): PieceType => ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)];

// O spawns at y=0 (fully visible); others at y=-1 (top row hidden, standard Tetris)
function spawnPiece(t: PieceType): Piece {
  return { type: t, rot: 0, x: 3, y: t === 'O' ? 0 : -1 };
}

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null));
}

function initGS(): GS {
  return {
    started: false, over: false, paused: false,
    board: emptyBoard(), piece: spawnPiece(randType()), next: randType(),
    score: 0, lines: 0, level: 1,
  };
}

function valid(board: Board, p: Piece, dx = 0, dy = 0, dr = 0): boolean {
  const rot = ((p.rot + dr) % 4 + 4) % 4;
  for (const [r, c] of SHAPES[p.type][rot]) {
    const nx = p.x + c + dx, ny = p.y + r + dy;
    if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
    if (ny >= 0 && board[ny][nx] !== null) return false;
  }
  return true;
}

function ghostDy(board: Board, p: Piece): number {
  let d = 0; while (valid(board, p, 0, d + 1)) d++; return d;
}

function placePiece(board: Board, p: Piece): Board {
  const b = board.map(r => [...r]);
  for (const [r, c] of SHAPES[p.type][p.rot]) {
    const br = p.y + r, bc = p.x + c;
    if (br >= 0 && br < ROWS) b[br][bc] = COLORS[p.type];
  }
  return b;
}

function sweepLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter(row => row.some(c => c === null));
  const cleared = ROWS - kept.length;
  return {
    board: [...Array.from({ length: cleared }, () => Array<string | null>(COLS).fill(null)), ...kept],
    cleared,
  };
}

const LINE_POINTS = [0, 100, 300, 500, 800];
const dropMs = (level: number) => Math.max(50, 800 - (level - 1) * 75);

function drawCell(ctx: CanvasRenderingContext2D, col: number, row: number, color: string) {
  const x = col * CELL, y = row * CELL;
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + 1, y + 1, CELL - 2, 3);
  ctx.fillRect(x + 1, y + 1, 3, CELL - 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 1, y + CELL - 4, CELL - 2, 3);
  ctx.fillRect(x + CELL - 4, y + 1, 3, CELL - 2);
}

export default function Tetris() {
  const boardCanvas = useRef<HTMLCanvasElement>(null);
  const nextCanvas  = useRef<HTMLCanvasElement>(null);
  const [gs, setGs] = useState<GS>(initGS);
  const gsRef = useRef(gs); gsRef.current = gs;

  const rumbleRef = useRef<(o: { duration: number; strongMagnitude?: number; weakMagnitude?: number }) => Promise<void>>(
    () => Promise.resolve()
  );
  const pendingRumble = useRef(0);

  // ── Lock helper ─────────────────────────────────────────────────────────────
  const doLock = useCallback((g: GS, p: Piece, bonus = 0): GS => {
    const locked = placePiece(g.board, p);
    const { board, cleared } = sweepLines(locked);
    if (cleared > 0) pendingRumble.current = cleared;
    const newLines = g.lines + cleared;
    const newLevel = Math.floor(newLines / 10) + 1;
    const newScore = g.score + bonus + (LINE_POINTS[Math.min(cleared, 4)] ?? 0) * g.level;
    const nextPiece = spawnPiece(g.next);
    return {
      ...g, board, piece: nextPiece, next: randType(),
      score: newScore, lines: newLines, level: newLevel,
      over: !valid(board, nextPiece), paused: false,
    };
  }, []);

  // ── Actions (all stable — deps are [] or [doLock] which is stable) ──────────
  const moveH = useCallback((dx: number) => {
    setGs(g => (!g.started || g.over || g.paused) ? g
      : valid(g.board, g.piece, dx) ? { ...g, piece: { ...g.piece, x: g.piece.x + dx } } : g);
  }, []);

  const rotate = useCallback(() => {
    setGs(g => {
      if (!g.started || g.over || g.paused) return g;
      for (const dx of [0, 1, -1, 2, -2]) {
        if (valid(g.board, g.piece, dx, 0, 1))
          return { ...g, piece: { ...g.piece, rot: (g.piece.rot + 1) % 4, x: g.piece.x + dx } };
      }
      return g;
    });
  }, []);

  const softDrop = useCallback(() => {
    setGs(g => {
      if (!g.started || g.over || g.paused) return g;
      return valid(g.board, g.piece, 0, 1)
        ? { ...g, piece: { ...g.piece, y: g.piece.y + 1 }, score: g.score + 1 }
        : doLock(g, g.piece);
    });
  }, [doLock]);

  const hardDrop = useCallback(() => {
    setGs(g => {
      if (!g.started || g.over || g.paused) return g;
      const dy = ghostDy(g.board, g.piece);
      return doLock(g, { ...g.piece, y: g.piece.y + dy }, dy * 2);
    });
  }, [doLock]);

  const togglePause = useCallback(() => {
    setGs(g => (!g.started || g.over) ? g : { ...g, paused: !g.paused });
  }, []);

  const startGame = useCallback(() => setGs({ ...initGS(), started: true }), []);

  // ── Rumble after line clear ──────────────────────────────────────────────────
  useEffect(() => {
    if (pendingRumble.current > 0) {
      const c = pendingRumble.current;
      pendingRumble.current = 0;
      rumbleRef.current({
        duration: c === 4 ? 700 : 250,
        strongMagnitude: Math.min(1, c * 0.25),
        weakMagnitude: 0.3,
      });
    }
  }, [gs]);

  // ── Soft-drop repeat (DAS for gamepad down) ──────────────────────────────────
  const sdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSoftDropRepeat = useCallback(() => {
    if (sdTimer.current) return;
    softDrop();
    sdTimer.current = setInterval(softDrop, 50);
  }, [softDrop]);

  const stopSoftDropRepeat = useCallback(() => {
    if (sdTimer.current) { clearInterval(sdTimer.current); sdTimer.current = null; }
  }, []);

  useEffect(() => () => stopSoftDropRepeat(), [stopSoftDropRepeat]);

  // ── Gamepad (stable callbacks so they don't restart the rAF poll loop) ───────
  const gpL      = useCallback(() => moveH(-1),           [moveH]);
  const gpR      = useCallback(() => moveH(1),            [moveH]);
  const gpD      = useCallback(() => startSoftDropRepeat(), [startSoftDropRepeat]);
  const gpU      = useCallback(() => rotate(),            [rotate]);
  const gpA      = useCallback(() => rotate(),            [rotate]);
  const gpB      = useCallback(() => hardDrop(),          [hardDrop]);
  const gpStart  = useCallback(() => {
    if (!gsRef.current.started || gsRef.current.over) startGame();
    else togglePause();
  }, [startGame, togglePause]);

  // Stop repeat when D-pad down is released
  const gpBtnUp = useCallback((btn: ButtonDetails) => {
    if (btn.buttonName === 'DPadDown') stopSoftDropRepeat();
  }, [stopSoftDropRepeat]);

  // Left stick Y: start repeat when pushed down, stop when released
  const gpAxes = useCallback((axes: AxesDetails) => {
    if (axes.axesName !== 'LeftStickY') return;
    // Hook stores +1=up, so negative = stick pushed down
    if (axes.value < -0.5) startSoftDropRepeat();
    else stopSoftDropRepeat();
  }, [startSoftDropRepeat, stopSoftDropRepeat]);

  const { rumble } = useGamepads({
    onDPadLeft: gpL, onDPadRight: gpR, onDPadDown: gpD, onDPadUp: gpU,
    onA: gpA, onB: gpB, onStart: gpStart,
    onGamepadButtonUp: gpBtnUp,
    onGamepadAxesChange: gpAxes,
  });
  useEffect(() => { rumbleRef.current = rumble; }, [rumble]);

  // ── Gravity ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gs.started || gs.over || gs.paused) return;
    const id = setInterval(() => {
      setGs(g => {
        if (!g.started || g.over || g.paused) return g;
        return valid(g.board, g.piece, 0, 1)
          ? { ...g, piece: { ...g.piece, y: g.piece.y + 1 } }
          : doLock(g, g.piece);
      });
    }, dropMs(gs.level));
    return () => clearInterval(id);
  }, [gs.started, gs.over, gs.paused, gs.level, doLock]);

  // ── Keyboard with DAS ────────────────────────────────────────────────────────
  useEffect(() => {
    const timers: Record<string, ReturnType<typeof setTimeout>>  = {};
    const ivals:  Record<string, ReturnType<typeof setInterval>> = {};
    const ACTS: Record<string, () => void> = {
      ArrowLeft: () => moveH(-1), ArrowRight: () => moveH(1),
      ArrowDown: softDrop, ArrowUp: rotate,
      z: rotate, Z: rotate,
      ' ': hardDrop,
      p: togglePause, P: togglePause, Escape: togglePause,
      Enter: () => { if (!gsRef.current.started || gsRef.current.over) startGame(); else togglePause(); },
    };
    const DAS_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown']);

    function onDown(e: KeyboardEvent) {
      if (e.repeat) return;
      const act = ACTS[e.key]; if (!act) return;
      if (['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' '].includes(e.key)) e.preventDefault();
      act();
      if (DAS_KEYS.has(e.key)) {
        timers[e.key] = setTimeout(() => { ivals[e.key] = setInterval(act, 50); }, 170);
      }
    }
    function onUp(e: KeyboardEvent) {
      clearTimeout(timers[e.key]); clearInterval(ivals[e.key]);
      delete timers[e.key]; delete ivals[e.key];
    }
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      Object.values(timers).forEach(clearTimeout);
      Object.values(ivals).forEach(clearInterval);
    };
  }, [moveH, rotate, softDrop, hardDrop, togglePause, startGame]);

  // ── Draw board ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const cv = boardCanvas.current; if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const W = COLS * CELL, H = ROWS * CELL;

    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#16161e'; ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL + 0.5, 0); ctx.lineTo(c * CELL + 0.5, H); ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL + 0.5); ctx.lineTo(W, r * CELL + 0.5); ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (gs.board[r][c]) drawCell(ctx, c, r, gs.board[r][c]!);

    if (gs.started && !gs.over) {
      const dy = ghostDy(gs.board, gs.piece);
      ctx.globalAlpha = 0.2;
      for (const [r, c] of SHAPES[gs.piece.type][gs.piece.rot]) {
        const gr = gs.piece.y + r + dy, gc = gs.piece.x + c;
        if (gr >= 0) drawCell(ctx, gc, gr, COLORS[gs.piece.type]);
      }
      ctx.globalAlpha = 1;
      for (const [r, c] of SHAPES[gs.piece.type][gs.piece.rot]) {
        const pr = gs.piece.y + r, pc = gs.piece.x + c;
        if (pr >= 0) drawCell(ctx, pc, pr, COLORS[gs.piece.type]);
      }
    }

    if (!gs.started || gs.over || gs.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (!gs.started) {
        ctx.font = 'bold 36px system-ui'; ctx.fillStyle = '#e2e8f0';
        ctx.fillText('TETRIS', W / 2, H / 2 - 24);
        ctx.font = '15px system-ui'; ctx.fillStyle = '#64748b';
        ctx.fillText('Press Enter or click Play', W / 2, H / 2 + 18);
      } else if (gs.over) {
        ctx.font = 'bold 32px system-ui'; ctx.fillStyle = '#f87171';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 24);
        ctx.font = '15px system-ui'; ctx.fillStyle = '#64748b';
        ctx.fillText('Enter or Start to restart', W / 2, H / 2 + 18);
      } else {
        ctx.font = 'bold 32px system-ui'; ctx.fillStyle = '#e2e8f0';
        ctx.fillText('PAUSED', W / 2, H / 2 - 12);
        ctx.font = '15px system-ui'; ctx.fillStyle = '#64748b';
        ctx.fillText('P / Esc / Start to resume', W / 2, H / 2 + 20);
      }
    }
  }, [gs]);

  // ── Draw next piece preview ───────────────────────────────────────────────────
  useEffect(() => {
    const cv = nextCanvas.current; if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (gs.started && !gs.over) {
      for (const [r, c] of SHAPES[gs.next][0])
        drawCell(ctx, c, r, COLORS[gs.next]);
    }
  }, [gs.started, gs.over, gs.next]);

  return (
    <div className="tetris-wrap">
      <canvas ref={boardCanvas} width={COLS * CELL} height={ROWS * CELL} className="tetris-board" />
      <div className="tetris-side">
        <div className="tetris-panel">
          <div className="tetris-label">NEXT</div>
          <canvas ref={nextCanvas} width={4 * CELL} height={4 * CELL} className="tetris-next" />
        </div>
        <div className="tetris-panel">
          <div className="tetris-label">SCORE</div>
          <div className="tetris-val">{gs.score.toLocaleString()}</div>
        </div>
        <div className="tetris-panel">
          <div className="tetris-label">LINES</div>
          <div className="tetris-val">{gs.lines}</div>
        </div>
        <div className="tetris-panel">
          <div className="tetris-label">LEVEL</div>
          <div className="tetris-val">{gs.level}</div>
        </div>
        {(!gs.started || gs.over) && (
          <button className="btn" onClick={startGame}>
            {gs.over ? 'Restart' : 'Play'}
          </button>
        )}
        {gs.started && !gs.over && (
          <button
            className="btn"
            style={{ background: 'var(--border)', color: 'var(--text)' }}
            onClick={togglePause}
          >
            {gs.paused ? 'Resume' : 'Pause'}
          </button>
        )}
        <div className="tetris-hint">
          <div>↑ / A — Rotate</div>
          <div>← → — Move</div>
          <div>↓ — Soft drop</div>
          <div>Space / B — Hard drop</div>
          <div>P / Esc / Start — Pause</div>
        </div>
      </div>
    </div>
  );
}
