import { useCallback, useRef, useState } from 'react';
import { useGamepads, ControllerProfile, ControllerProfiles, type ButtonDetails, type AxesDetails, type RumbleOptions } from 'awesome-react-gamepads';

const RUMBLE_PRESETS: { label: string; options: RumbleOptions }[] = [
  { label: 'Soft',   options: { duration: 200,  weakMagnitude: 0.4, strongMagnitude: 0.1 } },
  { label: 'Strong', options: { duration: 400,  weakMagnitude: 0.5, strongMagnitude: 1.0 } },
  { label: 'Buzz',   options: { duration: 80,   weakMagnitude: 1.0, strongMagnitude: 0.0 } },
  { label: 'Long',   options: { duration: 1000, weakMagnitude: 0.4, strongMagnitude: 0.4 } },
];

const PROFILES: ControllerProfile[] = ['xbox', 'playstation', 'switch', 'generic'];

interface GPState {
  id: string;
  connected: boolean;
  buttons: Record<string, { pressed: boolean; touched: boolean; value: number }>;
  axes: Record<string, number>;
}

export default function Visualizer() {
  const [profile, setProfile] = useState<ControllerProfile>('xbox');
  const [connected, setConnected] = useState(false);
  const [gamepadId, setGamepadId] = useState('');
  const [verbose, setVerbose] = useState(false);

  // Use a ref so the stable callbacks below always see the latest value
  // without needing to be recreated (which would restart the rAF loop).
  const verboseRef = useRef(false);
  const syncVerbose = (next: boolean) => {
    verboseRef.current = next;
    setVerbose(next);
  };

  // ── Stable verbose callbacks ([] deps — read verboseRef at call time) ──────
  const onBtnDown = useCallback((btn: ButtonDetails) => {
    if (!verboseRef.current) return;
    console.log(
      `%c[gamepad] ▼ button down%c  ${btn.buttonName}  (index ${btn.buttonIndex}, value ${Number(btn.value).toFixed(3)})`,
      'color:#4ade80;font-weight:bold', 'color:inherit'
    );
  }, []);

  const onBtnUp = useCallback((btn: ButtonDetails) => {
    if (!verboseRef.current) return;
    console.log(
      `%c[gamepad] ▲ button up%c    ${btn.buttonName}  (index ${btn.buttonIndex})`,
      'color:#94a3b8;font-weight:bold', 'color:inherit'
    );
  }, []);

  const onAxesChange = useCallback((axes: AxesDetails) => {
    if (!verboseRef.current) return;
    console.log(
      `%c[gamepad] ↔ axis%c         ${axes.axesName.padEnd(14)}  ${axes.value.toFixed(4)}  (prev ${axes.previousValue.toFixed(4)})`,
      'color:#60a5fa;font-weight:bold', 'color:inherit'
    );
  }, []);

  const onConnect = useCallback((gp: any) => {
    setConnected(true);
    setGamepadId(gp.id ?? '');
    if (verboseRef.current) {
      console.log(
        `%c[gamepad] ✔ connected%c  "${gp.id}"  (index ${gp.index})`,
        'color:#4ade80;font-weight:bold', 'color:inherit'
      );
    }
  }, []);

  const onDisconnect = useCallback(() => {
    setConnected(false);
    setGamepadId('');
    if (verboseRef.current) {
      console.log('%c[gamepad] ✖ disconnected', 'color:#f87171;font-weight:bold');
    }
  }, []);

  const [rumbleDuration,  setRumbleDuration]  = useState(300);
  const [rumbleWeak,      setRumbleWeak]      = useState(0.5);
  const [rumbleStrong,    setRumbleStrong]    = useState(0.5);
  const [rumbleFiring,    setRumbleFiring]    = useState(false);

  const { gamepad, buttonLabels, rumble } = useGamepads({
    controllerProfile: profile,
    onConnect,
    onDisconnect,
    onGamepadButtonDown: onBtnDown,
    onGamepadButtonUp:   onBtnUp,
    onGamepadAxesChange: onAxesChange,
  });

  const gp   = gamepad as unknown as GPState | undefined;
  const btns = gp?.buttons ?? {};
  const axes = gp?.axes    ?? {} as Record<string, number>;

  const profileButtonNames = ControllerProfiles[profile].buttons.filter(Boolean);

  const ltName  = buttonLabels.LT ?? 'LT';
  const rtName  = buttonLabels.RT ?? 'RT';
  const ltValue = axes['LeftTrigger']  || btns[ltName]?.value  || 0;
  const rtValue = axes['RightTrigger'] || btns[rtName]?.value  || 0;

  function stickStyle(x: number, y: number) {
    const r = 28;
    return {
      left: `calc(50% + ${x * r}px)`,
      top:  `calc(50% - ${y * r}px)`,
    };
  }

  const fireRumble = async (options: RumbleOptions) => {
    setRumbleFiring(true);
    await rumble(options);
    setTimeout(() => setRumbleFiring(false), options.duration + (options.startDelay ?? 0));
  };

  const lx = axes['LeftStickX']  ?? 0;
  const ly = axes['LeftStickY']  ?? 0;
  const rx = axes['RightStickX'] ?? 0;
  const ry = axes['RightStickY'] ?? 0;

  return (
    <div>
      <div className="viz-header">
        <div className="viz-status">
          <div className={`viz-dot${connected ? ' connected' : ''}`} />
          <span>{connected ? gamepadId || 'Gamepad connected' : 'No gamepad detected'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className={`verbose-toggle${verbose ? ' on' : ''}`}
            onClick={() => {
              const next = !verbose;
              syncVerbose(next);
              console.log(
                next
                  ? '%c[gamepad] verbose mode ON — button/axis events will be logged below'
                  : '%c[gamepad] verbose mode OFF',
                `color:${next ? '#4ade80' : '#94a3b8'};font-weight:bold`
              );
            }}
          >
            {verbose ? '⬤ Verbose' : '○ Verbose'}
          </button>
          <select
            className="profile-select"
            value={profile}
            onChange={e => setProfile(e.target.value as ControllerProfile)}
          >
            {PROFILES.map(p => (
              <option key={p} value={p}>{ControllerProfiles[p].displayName}</option>
            ))}
          </select>
        </div>
      </div>

      {!connected && (
        <div className="connect-prompt">
          <div className="icon">🎮</div>
          <p>Connect a gamepad and press any button to get started.</p>
        </div>
      )}

      {connected && (
        <div className="viz-grid">

          {/* ── Buttons ───────────────────────────── */}
          <div className="card">
            <div className="card-title">Buttons</div>
            <div className="btn-grid">
              {profileButtonNames.map(name => (
                <div key={name} className={`btn-chip${btns[name]?.pressed ? ' pressed' : ''}`}>
                  {name}
                </div>
              ))}
            </div>
          </div>

          {/* ── Analog Sticks ─────────────────────── */}
          <div className="card">
            <div className="card-title">Analog Sticks</div>
            <div className="stick-wrap">
              <div className="stick">
                <div className="stick-field">
                  <div className="stick-dot" style={stickStyle(lx, ly)} />
                </div>
                <div className="stick-label">Left ({lx.toFixed(2)}, {ly.toFixed(2)})</div>
              </div>
              <div className="stick">
                <div className="stick-field">
                  <div className="stick-dot" style={stickStyle(rx, ry)} />
                </div>
                <div className="stick-label">Right ({rx.toFixed(2)}, {ry.toFixed(2)})</div>
              </div>
            </div>
          </div>

          {/* ── Triggers ──────────────────────────── */}
          <div className="card">
            <div className="card-title">Triggers</div>
            <div className="trigger-row">
              {[
                { label: ltName, value: ltValue },
                { label: rtName, value: rtValue },
              ].map(({ label, value }) => (
                <div key={label} className="trigger-item">
                  <span className="trigger-name">{label}</span>
                  <div className="trigger-track">
                    <div className="trigger-fill" style={{ width: `${value * 100}%` }} />
                  </div>
                  <span style={{ width: 36, textAlign: 'right', color: 'var(--muted)', fontSize: 11, fontFamily: 'monospace' }}>
                    {value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Raw Axes ──────────────────────────── */}
          <div className="card">
            <div className="card-title">Raw Axes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(axes).map(([name, val]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--muted)' }}>{name}</span>
                  <span style={{ fontFamily: 'monospace', color: Math.abs(val) > 0.01 ? 'var(--green)' : 'var(--muted)' }}>
                    {val.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Rumble ────────────────────────────────── */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-title">Rumble / Haptics</div>
            <div className="rumble-wrap">
              <div className="rumble-presets">
                {RUMBLE_PRESETS.map(({ label, options }) => (
                  <button
                    key={label}
                    className={`rumble-btn${rumbleFiring ? ' firing' : ''}`}
                    onClick={() => fireRumble(options)}
                    disabled={rumbleFiring}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="rumble-custom">
                <div className="rumble-row">
                  <span className="rumble-label">Duration</span>
                  <input type="range" min={50} max={2000} step={50} value={rumbleDuration}
                    onChange={e => setRumbleDuration(Number(e.target.value))} />
                  <span className="rumble-value">{rumbleDuration} ms</span>
                </div>
                <div className="rumble-row">
                  <span className="rumble-label">Weak</span>
                  <input type="range" min={0} max={1} step={0.05} value={rumbleWeak}
                    onChange={e => setRumbleWeak(Number(e.target.value))} />
                  <span className="rumble-value">{rumbleWeak.toFixed(2)}</span>
                </div>
                <div className="rumble-row">
                  <span className="rumble-label">Strong</span>
                  <input type="range" min={0} max={1} step={0.05} value={rumbleStrong}
                    onChange={e => setRumbleStrong(Number(e.target.value))} />
                  <span className="rumble-value">{rumbleStrong.toFixed(2)}</span>
                </div>
                <button
                  className={`rumble-btn test${rumbleFiring ? ' firing' : ''}`}
                  onClick={() => fireRumble({ duration: rumbleDuration, weakMagnitude: rumbleWeak, strongMagnitude: rumbleStrong })}
                  disabled={rumbleFiring}
                >
                  {rumbleFiring ? 'Rumbling…' : 'Test'}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
              Chrome / Edge only — silently no-ops on Firefox and Safari.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
