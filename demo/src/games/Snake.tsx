import { useState, useEffect, useRef, useCallback } from 'react';
import { useGamepads } from 'awesome-react-gamepads';

const COLS = 20;
const ROWS = 20;

type Difficulty = 'easy' | 'medium' | 'hard';

const DIFF: Record<Difficulty, { label: string; tick: number; wrap: boolean; color: string; hint: string }> = {
  easy:   { label: 'Easy',   tick: 300, wrap: true,  color: '#4ade80', hint: 'Slow · Walls wrap around' },
  medium: { label: 'Medium', tick: 140, wrap: false, color: '#fbbf24', hint: 'Normal speed · Walls kill' },
  hard:   { label: 'Hard',   tick: 70,  wrap: false, color: '#f87171', hint: 'Fast · Walls kill' },
};

type Pos = { x: number; y: number };
type Dir = Pos;

const UP:    Dir = { x:  0, y: -1 };
const DOWN:  Dir = { x:  0, y:  1 };
const LEFT:  Dir = { x: -1, y:  0 };
const RIGHT: Dir = { x:  1, y:  0 };

function randomFood(snake: Pos[]): Pos {
  const occupied = new Set(snake.map(p => `${p.x},${p.y}`));
  let pos: Pos;
  do { pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
  while (occupied.has(`${pos.x},${pos.y}`));
  return pos;
}

function initState() {
  const snake: Pos[] = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  return { snake, food: randomFood(snake), dir: RIGHT, nextDir: RIGHT, score: 0, over: false };
}

export default function Snake() {
  const [state, setState]       = useState(initState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [started, setStarted]   = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [bests, setBests]       = useState<Record<Difficulty, number>>({ easy: 0, medium: 0, hard: 0 });

  // Track which difficulty was active when a game started (so best is credited correctly)
  const activeDiff = useRef<Difficulty>('medium');

  const startGame = useCallback((diff: Difficulty) => {
    activeDiff.current = diff;
    setDifficulty(diff);
    setState(initState());
    setStarted(true);
  }, []);

  // Record best on game over
  useEffect(() => {
    if (state.over) {
      const d = activeDiff.current;
      setBests(b => ({ ...b, [d]: Math.max(b[d], state.score) }));
    }
  }, [state.over]); // eslint-disable-line react-hooks/exhaustive-deps

  const queueDir = useCallback((d: Dir) => {
    const cur = stateRef.current.dir;
    if (d.x === -cur.x && d.y === -cur.y) return;
    setState(s => ({ ...s, nextDir: d }));
  }, []);

  useGamepads({
    onDPadUp:         () => queueDir(UP),
    onDPadDown:       () => queueDir(DOWN),
    onDPadLeft:       () => queueDir(LEFT),
    onDPadRight:      () => queueDir(RIGHT),
    onLeftStickUp:    () => queueDir(UP),
    onLeftStickDown:  () => queueDir(DOWN),
    onLeftStickLeft:  () => queueDir(LEFT),
    onLeftStickRight: () => queueDir(RIGHT),
    onStart: () => {
      if (stateRef.current.over || !started) startGame(difficulty);
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started && (e.key === 'Enter' || e.key === ' ')) { startGame(difficulty); return; }
      if (e.key === 'ArrowUp'    || e.key === 'w') queueDir(UP);
      if (e.key === 'ArrowDown'  || e.key === 's') queueDir(DOWN);
      if (e.key === 'ArrowLeft'  || e.key === 'a') queueDir(LEFT);
      if (e.key === 'ArrowRight' || e.key === 'd') queueDir(RIGHT);
      if ((e.key === 'Enter' || e.key === ' ') && stateRef.current.over) startGame(difficulty);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, difficulty, queueDir, startGame]);

  // Game tick — re-runs when difficulty changes so speed updates immediately
  useEffect(() => {
    if (!started || state.over) return;
    const { tick, wrap } = DIFF[difficulty];
    const id = setInterval(() => {
      setState(s => {
        if (s.over) return s;
        const dir = s.nextDir;
        let nx = s.snake[0].x + dir.x;
        let ny = s.snake[0].y + dir.y;

        if (wrap) {
          nx = (nx + COLS) % COLS;
          ny = (ny + ROWS) % ROWS;
        } else {
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return { ...s, over: true };
        }

        const head = { x: nx, y: ny };
        if (s.snake.some(p => p.x === head.x && p.y === head.y)) return { ...s, over: true };

        const ateFood = head.x === s.food.x && head.y === s.food.y;
        const newSnake = [head, ...s.snake.slice(0, ateFood ? undefined : -1)];
        return { ...s, dir, snake: newSnake, food: ateFood ? randomFood(newSnake) : s.food, score: ateFood ? s.score + 1 : s.score };
      });
    }, tick);
    return () => clearInterval(id);
  }, [started, state.over, difficulty]);

  const cells = Array.from({ length: ROWS * COLS }, (_, i) => {
    const x = i % COLS, y = Math.floor(i / COLS);
    if (state.snake[0].x === x && state.snake[0].y === y) return 'head';
    if (state.snake.some(p => p.x === x && p.y === y))    return 'body';
    if (state.food.x === x && state.food.y === y)         return 'food';
    return '';
  });

  const cfg = DIFF[difficulty];

  return (
    <div className="snake-wrap">
      <div className="snake-hud">
        <span>Score: <span className="snake-score">{state.score}</span></span>
        <span style={{ color: cfg.color, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em' }}>
          {cfg.label.toUpperCase()}
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>Best: {bests[difficulty]}</span>
      </div>

      <div className="snake-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 24px)` }}>
        {cells.map((cls, i) => (
          <div key={i} className={`snake-cell${cls ? ` ${cls}` : ''}`} />
        ))}
      </div>

      <div className="snake-hint">
        🎮 D-Pad / Left Stick &nbsp;|&nbsp; ⌨️ WASD / Arrow Keys &nbsp;|&nbsp; Start / Enter to restart
      </div>

      {!started && (
        <div className="overlay">
          <div style={{ fontSize: 48 }}>🐍</div>
          <h2>Snake</h2>
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '-4px 0 4px' }}>{cfg.hint}</p>
          <button className="btn" onClick={() => startGame(difficulty)}>Play</button>
        </div>
      )}

      {state.over && started && (
        <div className="overlay">
          <h2>Game Over</h2>
          <p style={{ color: 'var(--muted)' }}>
            Score: {state.score}
            {state.score > 0 && state.score >= bests[activeDiff.current] ? ' 🏆' : ''}
          </p>
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '-4px 0 4px' }}>{DIFF[difficulty].hint}</p>
          <button className="btn" onClick={() => startGame(difficulty)}>Play Again</button>
        </div>
      )}
    </div>
  );
}

function DifficultyPicker({ value, onChange }: { value: Difficulty; onChange: (d: Difficulty) => void }) {
  return (
    <div className="diff-row">
      {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
        <button
          key={d}
          className={`diff-btn${value === d ? ' selected' : ''}`}
          style={value === d ? { borderColor: DIFF[d].color, color: DIFF[d].color } : {}}
          onClick={() => onChange(d)}
        >
          {DIFF[d].label}
        </button>
      ))}
    </div>
  );
}
