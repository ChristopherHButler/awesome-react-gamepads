import { useEffect, useRef, useState } from 'react';

interface RawButton { pressed: boolean; touched: boolean; value: number; }
interface RawGamepad { index: number; id: string; mapping: string; buttons: RawButton[]; axes: number[]; }

function snapshot(gp: Gamepad): RawGamepad {
  return {
    index: gp.index,
    id: gp.id,
    mapping: gp.mapping,
    buttons: Array.from(gp.buttons).map(b => ({ pressed: b.pressed, touched: b.touched, value: b.value })),
    axes: Array.from(gp.axes),
  };
}

export default function Inspector() {
  const [gamepads, setGamepads] = useState<RawGamepad[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    function poll() {
      const live = navigator.getGamepads ? navigator.getGamepads() : [];
      const snapped: RawGamepad[] = [];
      for (const gp of live) {
        if (gp) snapped.push(snapshot(gp));
      }
      setGamepads(snapped);
      rafRef.current = requestAnimationFrame(poll);
    }
    rafRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  if (gamepads.length === 0) {
    return (
      <div className="connect-prompt">
        <div className="icon">🔍</div>
        <p>Connect a controller and press any button to see raw indices. Use this to verify guitar mappings on your OS/browser.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {gamepads.map(gp => (
        <div key={gp.index}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Controller {gp.index}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              <span style={{ color: 'var(--muted)', marginRight: 8 }}>id</span>
              <span style={{ fontFamily: 'monospace' }}>{gp.id}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--muted)', marginRight: 8 }}>mapping</span>
              <span style={{ fontFamily: 'monospace' }}>{gp.mapping || '(none — non-standard)'}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <div className="card-title">Buttons ({gp.buttons.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {gp.buttons.map((btn, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '4px 8px',
                      borderRadius: 6,
                      background: btn.pressed ? 'var(--accent-dim)' : 'transparent',
                      transition: 'background 0.05s',
                    }}
                  >
                    <span style={{ width: 28, fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                      [{i}]
                    </span>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${btn.value * 100}%`, transition: 'width 0.05s' }} />
                    </div>
                    <span style={{ width: 40, fontFamily: 'monospace', fontSize: 11, textAlign: 'right', color: btn.pressed ? 'var(--accent)' : 'var(--muted)' }}>
                      {btn.value.toFixed(2)}
                    </span>
                    {btn.pressed && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', width: 20 }}>ON</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Axes ({gp.axes.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {gp.axes.map((val, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 28, fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                      [{i}]
                    </span>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)', position: 'relative', overflow: 'visible' }}>
                      <div style={{
                        position: 'absolute',
                        height: '100%',
                        borderRadius: 2,
                        background: Math.abs(val) > 0.05 ? 'var(--blue)' : 'var(--border)',
                        left: val >= 0 ? '50%' : `${(0.5 + val / 2) * 100}%`,
                        width: `${Math.abs(val) * 50}%`,
                        transition: 'left 0.05s, width 0.05s',
                      }} />
                    </div>
                    <span style={{ width: 52, fontFamily: 'monospace', fontSize: 11, textAlign: 'right', color: Math.abs(val) > 0.05 ? 'var(--blue)' : 'var(--muted)' }}>
                      {val.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
