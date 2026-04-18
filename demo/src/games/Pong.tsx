import { useEffect, useRef, useState } from 'react';
import { useGamepad } from 'awesome-react-gamepads';

const W = 800, H = 480;
const PADDLE_W = 12, PADDLE_H = 80;
const BALL_SIZE = 12;
const PADDLE_SPEED = 6;
const BALL_SPEED = 5;
const WIN_SCORE = 7;

function resetBall(dir: 1 | -1) {
  const angle = (Math.random() * 0.6 - 0.3); // ±~17°
  return {
    x: W / 2, y: H / 2,
    vx: Math.cos(angle) * BALL_SPEED * dir,
    vy: Math.sin(angle) * BALL_SPEED,
  };
}

export default function Pong() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Game state as refs (mutated in rAF loop, no React re-render per frame)
  const ball    = useRef(resetBall(1));
  const p1Y     = useRef(H / 2);
  const p2Y     = useRef(H / 2);
  const score   = useRef({ p1: 0, p2: 0 });
  const running = useRef(false);
  const winner  = useRef<string | null>(null);

  // Gamepad input refs
  const p1Input = useRef(0); // -1 up, 0 still, 1 down
  const p2Input = useRef(0);

  const [p1Connected, setP1Connected] = useState(false);
  const [p2Connected, setP2Connected] = useState(false);
  const [, forceRender] = useState(0);

  useGamepad(0, {
    onConnect:    () => setP1Connected(true),
    onDisconnect: () => setP1Connected(false),
    onGamepadAxesChange: (a) => {
      if (a.axesName === 'LeftStickY') p1Input.current = a.value;
    },
    onDPadUp:   () => { p1Input.current = -1; },
    onDPadDown: () => { p1Input.current =  1; },
    onGamepadButtonUp: (btn) => {
      if (btn.buttonName === 'DPadUp' || btn.buttonName === 'DPadDown') p1Input.current = 0;
    },
    onStart: () => startGame(),
  });

  useGamepad(1, {
    onConnect:    () => setP2Connected(true),
    onDisconnect: () => setP2Connected(false),
    onGamepadAxesChange: (a) => {
      if (a.axesName === 'LeftStickY') p2Input.current = a.value;
    },
    onDPadUp:   () => { p2Input.current = -1; },
    onDPadDown: () => { p2Input.current =  1; },
    onGamepadButtonUp: (btn) => {
      if (btn.buttonName === 'DPadUp' || btn.buttonName === 'DPadDown') p2Input.current = 0;
    },
    onStart: () => startGame(),
  });

  // Keyboard fallback
  useEffect(() => {
    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      keys.add(e.key);
      if (e.key === 'Enter' || e.key === ' ') startGame();
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key);
    const interval = setInterval(() => {
      p1Input.current = keys.has('w') ? -1 : keys.has('s') ? 1 : p1Input.current;
      p2Input.current = keys.has('ArrowUp') ? -1 : keys.has('ArrowDown') ? 1 : p2Input.current;
      // Release when both keys up
      if (!keys.has('w') && !keys.has('s') && !p1Connected) p1Input.current = 0;
      if (!keys.has('ArrowUp') && !keys.has('ArrowDown') && !p2Connected) p2Input.current = 0;
    }, 16);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); clearInterval(interval); };
  }, [p1Connected, p2Connected]);

  function startGame() {
    if (winner.current) {
      score.current = { p1: 0, p2: 0 };
      winner.current = null;
    }
    ball.current = resetBall(Math.random() > 0.5 ? 1 : -1);
    p1Y.current = H / 2;
    p2Y.current = H / 2;
    running.current = true;
    forceRender(n => n + 1);
  }

  // rAF game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;

    function update() {
      if (!running.current || winner.current) return;

      // Move paddles
      p1Y.current = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, p1Y.current + p1Input.current * PADDLE_SPEED));
      p2Y.current = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, p2Y.current + p2Input.current * PADDLE_SPEED));

      // Move ball
      const b = ball.current;
      b.x += b.vx;
      b.y += b.vy;

      // Wall bounce (top/bottom)
      if (b.y - BALL_SIZE / 2 < 0)     { b.y = BALL_SIZE / 2;     b.vy *= -1; }
      if (b.y + BALL_SIZE / 2 > H)     { b.y = H - BALL_SIZE / 2; b.vy *= -1; }

      // P1 paddle (left)
      const p1x = 30 + PADDLE_W;
      if (b.x - BALL_SIZE / 2 < p1x && b.x - BALL_SIZE / 2 > 30 && Math.abs(b.y - p1Y.current) < PADDLE_H / 2) {
        const rel = (b.y - p1Y.current) / (PADDLE_H / 2);
        const angle = rel * (Math.PI / 4);
        const speed = Math.min(Math.hypot(b.vx, b.vy) + 0.3, 10);
        b.vx =  Math.cos(angle) * speed;
        b.vy =  Math.sin(angle) * speed;
        b.x = p1x + BALL_SIZE / 2;
      }

      // P2 paddle (right)
      const p2x = W - 30 - PADDLE_W;
      if (b.x + BALL_SIZE / 2 > p2x && b.x + BALL_SIZE / 2 < W - 30 && Math.abs(b.y - p2Y.current) < PADDLE_H / 2) {
        const rel = (b.y - p2Y.current) / (PADDLE_H / 2);
        const angle = rel * (Math.PI / 4);
        const speed = Math.min(Math.hypot(b.vx, b.vy) + 0.3, 10);
        b.vx = -Math.cos(angle) * speed;
        b.vy =  Math.sin(angle) * speed;
        b.x = p2x - BALL_SIZE / 2;
      }

      // Score
      if (b.x < 0)  { score.current.p2++; ball.current = resetBall( 1); }
      if (b.x > W)  { score.current.p1++; ball.current = resetBall(-1); }

      if (score.current.p1 >= WIN_SCORE) { winner.current = 'Player 1'; running.current = false; forceRender(n => n + 1); }
      if (score.current.p2 >= WIN_SCORE) { winner.current = 'Player 2'; running.current = false; forceRender(n => n + 1); }
    }

    function draw() {
      // Background
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, W, H);

      // Centre line
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = '#252530';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.setLineDash([]);

      // Scores
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(score.current.p1), W / 4,     56);
      ctx.fillText(String(score.current.p2), W * 3 / 4, 56);

      // Player labels
      ctx.font = '12px system-ui';
      ctx.fillStyle = '#64748b';
      ctx.fillText('P1', W / 4,     76);
      ctx.fillText('P2', W * 3 / 4, 76);

      // Paddles
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(30,          p1Y.current - PADDLE_H / 2, PADDLE_W, PADDLE_H, 4);
      ctx.roundRect(W - 30 - PADDLE_W, p2Y.current - PADDLE_H / 2, PADDLE_W, PADDLE_H, 4);
      ctx.fill();

      // Ball
      const b = ball.current;
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.roundRect(b.x - BALL_SIZE / 2, b.y - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE, 3);
      ctx.fill();

      // Overlay messages
      if (!running.current && !winner.current) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 28px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Press Start / Enter / Space to play', W / 2, H / 2);
        ctx.font = '14px system-ui';
        ctx.fillStyle = '#64748b';
        ctx.fillText('P1: W/S or Left Stick    P2: ↑/↓ or Left Stick', W / 2, H / 2 + 36);
      }

      if (winner.current) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 40px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`${winner.current} wins!`, W / 2, H / 2 - 16);
        ctx.fillStyle = '#64748b';
        ctx.font = '16px system-ui';
        ctx.fillText('Press Start / Enter / Space to play again', W / 2, H / 2 + 24);
      }
    }

    function loop() {
      update();
      draw();
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pong-wrap">
      <div className="pong-players">
        <div className="pong-player">
          <div className={`dot${p1Connected ? ' on' : ''}`} />
          <span>P1 — {p1Connected ? 'Gamepad 0' : 'Keyboard W/S'}</span>
        </div>
        <div className="pong-player">
          <div className={`dot${p2Connected ? ' on' : ''}`} />
          <span>P2 — {p2Connected ? 'Gamepad 1' : 'Keyboard ↑/↓'}</span>
        </div>
      </div>

      <canvas ref={canvasRef} width={W} height={H} className="pong-canvas" />

      <div className="pong-hint">
        🎮 Left Stick / D-Pad to move &nbsp;·&nbsp; Start to begin
        <br />
        ⌨️ P1: W/S &nbsp;·&nbsp; P2: ↑/↓ &nbsp;·&nbsp; Enter/Space to begin
      </div>
    </div>
  );
}
