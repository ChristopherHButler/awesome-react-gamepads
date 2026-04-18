const toc = [
  { id: 'overview',      label: 'Overview' },
  { id: 'installation',  label: 'Installation' },
  { id: 'quick-start',   label: 'Quick Start' },
  { id: 'use-gamepads',  label: 'useGamepads' },
  { id: 'use-gamepad',   label: 'useGamepad' },
  { id: 'use-sequence',  label: 'useGamepadSequence' },
  { id: 'context',       label: 'Context & HOC' },
  { id: 'profiles',      label: 'Controller Profiles' },
  { id: 'haptics',       label: 'Haptics' },
  { id: 'dead-zones',    label: 'Dead Zones' },
  { id: 'typescript',    label: 'TypeScript' },
  { id: 'compat',        label: 'Browser Compatibility' },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

export default function Docs() {
  return (
    <div className="docs-layout">
      {/* ── Content ── */}
      <div className="docs-content">

        {/* Overview */}
        <div className="docs-section" id="overview">
          <h1 className="docs-h1">awesome-react-gamepads</h1>
          <p className="docs-p">
            A zero-dependency React hook library wrapping the native browser{' '}
            <a href="https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API" target="_blank" rel="noreferrer">
              Gamepad API
            </a>
            . Connect any standard USB or Bluetooth gamepad and get real-time button, axis, and
            trigger data delivered through React callbacks, custom DOM events, or context.
          </p>
          <div className="callout">
            Supports Xbox, PlayStation, Nintendo Switch Pro, and generic controllers via built-in
            controller profiles with profile-aware button label mapping.
          </div>
        </div>

        {/* Installation */}
        <div className="docs-section" id="installation">
          <h2 className="docs-h2">Installation</h2>
          <pre className="code-block"><code>npm install awesome-react-gamepads</code></pre>
          <p className="docs-p">Peer dependencies:</p>
          <pre className="code-block"><code>{`"peerDependencies": {
  "react": ">=18",
  "react-dom": ">=18"
}`}</code></pre>
        </div>

        {/* Quick Start */}
        <div className="docs-section" id="quick-start">
          <h2 className="docs-h2">Quick Start</h2>
          <pre className="code-block"><code>{`import { useGamepads } from 'awesome-react-gamepads';

export function Game() {
  const { gamepad, buttonLabels } = useGamepads({
    onA: () => jump(),
    onGamepadAxesChange: (axes) => {
      if (axes.axesName === 'LeftStickX') moveX(axes.value);
    },
  });

  if (!gamepad?.connected) {
    return <p>Connect a gamepad to play</p>;
  }

  return (
    <div>
      <p>Press {buttonLabels.A} to jump</p>
    </div>
  );
}`}</code></pre>
        </div>

        {/* useGamepads */}
        <div className="docs-section" id="use-gamepads">
          <h2 className="docs-h2">useGamepads</h2>
          <p className="docs-p">
            The primary hook. Tracks the most recently active gamepad across all connected slots.
            Polls <code className="docs-inline-code">navigator.getGamepads()</code> via{' '}
            <code className="docs-inline-code">requestAnimationFrame</code> (or{' '}
            <code className="docs-inline-code">setInterval</code> when <code className="docs-inline-code">pollRate</code> is set).
          </p>
          <pre className="code-block"><code>{`import { useGamepads } from 'awesome-react-gamepads';

const { gamepad, rumble, profile, buttonLabels } = useGamepads(props?);`}</code></pre>

          <h3 className="docs-h3">Props</h3>
          <table className="props-table">
            <thead>
              <tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td>deadZone</td><td>number | DeadZonePreset</td><td>"medium"</td><td>Axis dead zone. Preset string or raw 0–1 number.</td></tr>
              <tr><td>stickThreshold</td><td>number</td><td>0.75</td><td>Axis value required to fire directional stick callbacks.</td></tr>
              <tr><td>holdThreshold</td><td>number</td><td>500</td><td>Milliseconds before <code className="docs-inline-code">onGamepadButtonHold</code> fires.</td></tr>
              <tr><td>pollRate</td><td>number</td><td>—</td><td>If set, uses <code className="docs-inline-code">setInterval</code> at this ms rate instead of rAF.</td></tr>
              <tr><td>controllerProfile</td><td>ControllerProfile</td><td>"xbox"</td><td>Active button naming profile.</td></tr>
              <tr><td>onConnect</td><td>(gp: ReactGamepad) =&gt; void</td><td>—</td><td>Fires when a gamepad is connected.</td></tr>
              <tr><td>onDisconnect</td><td>(gp: ReactGamepad) =&gt; void</td><td>—</td><td>Fires when a gamepad is disconnected.</td></tr>
              <tr><td>onUpdate</td><td>(gp: ReactGamepad) =&gt; void</td><td>—</td><td>Fires on every frame that has a state change.</td></tr>
              <tr><td>onGamepadButtonDown</td><td>(b: ButtonDetails) =&gt; void</td><td>—</td><td>Any button pressed.</td></tr>
              <tr><td>onGamepadButtonUp</td><td>(b: ButtonDetails) =&gt; void</td><td>—</td><td>Any button released.</td></tr>
              <tr><td>onGamepadButtonChange</td><td>(b: ButtonDetails) =&gt; void</td><td>—</td><td>Any button press state change.</td></tr>
              <tr><td>onGamepadButtonHold</td><td>(b: ButtonDetails) =&gt; void</td><td>—</td><td>Button held longer than <code className="docs-inline-code">holdThreshold</code>.</td></tr>
              <tr><td>onGamepadAxesChange</td><td>(a: AxesDetails) =&gt; void</td><td>—</td><td>Any axis value change.</td></tr>
              <tr><td>onA / onB / onX / onY</td><td>(b: ButtonDetails) =&gt; void</td><td>—</td><td>Per-button callbacks (fired on press down).</td></tr>
              <tr><td>onLB / onRB / onLT / onRT</td><td>(b: ButtonDetails) =&gt; void</td><td>—</td><td>Shoulder / trigger callbacks.</td></tr>
              <tr><td>onSelect / onStart</td><td>(b: ButtonDetails) =&gt; void</td><td>—</td><td>Menu button callbacks.</td></tr>
              <tr><td>onLS / onRS</td><td>(b: ButtonDetails) =&gt; void</td><td>—</td><td>Stick click callbacks.</td></tr>
              <tr><td>onDPadUp/Down/Left/Right</td><td>(b: ButtonDetails) =&gt; void</td><td>—</td><td>D-Pad directional callbacks.</td></tr>
              <tr><td>onXBoxLogo</td><td>(b: ButtonDetails) =&gt; void</td><td>—</td><td>Home / guide button callback.</td></tr>
              <tr><td>onLeftStickUp/Down/Left/Right</td><td>(a: AxesDetails) =&gt; void</td><td>—</td><td>Left stick directional callbacks (fires once when crossing <code className="docs-inline-code">stickThreshold</code>).</td></tr>
              <tr><td>onRightStickUp/Down/Left/Right</td><td>(a: AxesDetails) =&gt; void</td><td>—</td><td>Right stick directional callbacks.</td></tr>
              <tr><td>onKonamiSuccess</td><td>() =&gt; void</td><td>—</td><td>Fires when the Konami code sequence is completed.</td></tr>
            </tbody>
          </table>

          <h3 className="docs-h3">Return Value</h3>
          <table className="props-table">
            <thead>
              <tr><th>Property</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td>gamepad</td><td>ReactGamepad | undefined</td><td>Current gamepad state snapshot.</td></tr>
              <tr><td>rumble</td><td>(options: RumbleOptions) =&gt; Promise&lt;void&gt;</td><td>Trigger haptic feedback.</td></tr>
              <tr><td>profile</td><td>ControllerProfile</td><td>The active controller profile name.</td></tr>
              <tr><td>buttonLabels</td><td>Record&lt;string, string&gt;</td><td>Maps Xbox button names to the profile's display names.</td></tr>
            </tbody>
          </table>
        </div>

        {/* useGamepad */}
        <div className="docs-section" id="use-gamepad">
          <h2 className="docs-h2">useGamepad</h2>
          <p className="docs-p">
            Like <code className="docs-inline-code">useGamepads</code> but targets a single gamepad slot by index.
            Ideal for split-screen multiplayer where each player uses a specific controller.
          </p>
          <pre className="code-block"><code>{`import { useGamepad } from 'awesome-react-gamepads';

// Track gamepad at index 0 (Player 1)
const { gamepad } = useGamepad(0, props?);

// Multiplayer example
function MultiplayerGame() {
  const p1 = useGamepad(0, { onA: () => p1Jump() });
  const p2 = useGamepad(1, { onA: () => p2Jump() });

  return (
    <div>
      <Player data={p1.gamepad} label="P1" />
      <Player data={p2.gamepad} label="P2" />
    </div>
  );
}`}</code></pre>
          <p className="docs-p">
            Returns the same shape as <code className="docs-inline-code">useGamepads</code>:{' '}
            <code className="docs-inline-code">{'{ gamepad, rumble, profile, buttonLabels }'}</code>.
          </p>
        </div>

        {/* useGamepadSequence */}
        <div className="docs-section" id="use-sequence">
          <h2 className="docs-h2">useGamepadSequence</h2>
          <p className="docs-p">
            Detects an arbitrary button sequence and fires a callback when matched. Works standalone —
            no <code className="docs-inline-code">useGamepads</code> required in the same component.
            Supports button names, profile-specific names, or raw button indices.
          </p>
          <pre className="code-block"><code>{`import { useGamepadSequence } from 'awesome-react-gamepads';

// Konami code
const { reset } = useGamepadSequence(
  ['DPadUp','DPadUp','DPadDown','DPadDown',
   'DPadLeft','DPadRight','DPadLeft','DPadRight','B','A'],
  () => activateCheats(),
);

// Fighting game combo with 2-second input window
useGamepadSequence(
  ['DPadDown', 'DPadRight', 'A'],
  () => fireHadouken(),
  { timeout: 2000 },
);

// PlayStation button names
useGamepadSequence(
  ['Cross', 'Circle', 'Cross'],
  () => doCombo(),
  { controllerProfile: 'playstation' },
);

// Raw button indices
useGamepadSequence([0, 1, 0], () => doCombo());`}</code></pre>

          <h3 className="docs-h3">Parameters</h3>
          <table className="props-table">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td>sequence</td><td>(string | number)[]</td><td>Ordered list of button names or indices to match.</td></tr>
              <tr><td>callback</td><td>() =&gt; void</td><td>Fired when the full sequence is matched.</td></tr>
              <tr><td>options.timeout</td><td>number</td><td>Max ms between inputs before progress resets. Default: none.</td></tr>
              <tr><td>options.resetOnMiss</td><td>boolean</td><td>Reset progress on any wrong button. Default: false.</td></tr>
              <tr><td>options.controllerProfile</td><td>ControllerProfile</td><td>Profile for resolving button names. Default: "xbox".</td></tr>
            </tbody>
          </table>

          <h3 className="docs-h3">Return Value</h3>
          <table className="props-table">
            <thead>
              <tr><th>Property</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td>reset</td><td>() =&gt; void</td><td>Manually reset progress back to the beginning of the sequence.</td></tr>
            </tbody>
          </table>
        </div>

        {/* Context & HOC */}
        <div className="docs-section" id="context">
          <h2 className="docs-h2">Context &amp; HOC</h2>
          <p className="docs-p">
            Mount a single polling loop at the top of your tree and consume gamepad state anywhere
            without prop-drilling.
          </p>

          <h3 className="docs-h3">GamepadsProvider</h3>
          <p className="docs-p">
            Wrap your app (or a subtree) with <code className="docs-inline-code">GamepadsProvider</code>.
            It accepts all the same props as <code className="docs-inline-code">useGamepads</code>.
          </p>
          <pre className="code-block"><code>{`import { GamepadsProvider } from 'awesome-react-gamepads';

function App() {
  return (
    <GamepadsProvider controllerProfile="playstation" onA={() => jump()}>
      <Game />
    </GamepadsProvider>
  );
}`}</code></pre>

          <h3 className="docs-h3">useGamepadsContext</h3>
          <p className="docs-p">
            Reads the current gamepad state from the nearest{' '}
            <code className="docs-inline-code">GamepadsProvider</code>. Throws a descriptive error
            if used outside a provider.
          </p>
          <pre className="code-block"><code>{`import { useGamepadsContext } from 'awesome-react-gamepads';

function HUD() {
  const { gamepad, buttonLabels } = useGamepadsContext();
  return <p>Press {buttonLabels.A} to fire</p>;
}`}</code></pre>

          <h3 className="docs-h3">withGamepads (HOC)</h3>
          <p className="docs-p">
            Higher-order component that injects gamepad state from the nearest{' '}
            <code className="docs-inline-code">GamepadsProvider</code> as props. Useful for class
            components.
          </p>
          <pre className="code-block"><code>{`import { withGamepads, WithGamepadsProps } from 'awesome-react-gamepads';

interface Props extends WithGamepadsProps {
  playerName: string;
}

class PlayerHUD extends React.Component<Props> {
  render() {
    const { gamepad, buttonLabels, playerName } = this.props;
    return <p>{playerName}: press {buttonLabels.A} to jump</p>;
  }
}

export default withGamepads(PlayerHUD);

// Usage — GamepadsProvider must be an ancestor:
// <GamepadsProvider><PlayerHUD playerName="P1" /></GamepadsProvider>`}</code></pre>
        </div>

        {/* Controller Profiles */}
        <div className="docs-section" id="profiles">
          <h2 className="docs-h2">Controller Profiles</h2>
          <p className="docs-p">
            All four profiles share the same physical Standard Gamepad layout — only the displayed
            button names differ. Set <code className="docs-inline-code">controllerProfile</code> to
            match your players' hardware so callbacks and <code className="docs-inline-code">buttonLabels</code> use familiar names.
          </p>

          <h3 className="docs-h3">Available Profiles</h3>
          <table className="props-table">
            <thead>
              <tr><th>Value</th><th>Display Name</th><th>Face Buttons</th><th>Home Button</th></tr>
            </thead>
            <tbody>
              <tr><td>"xbox"</td><td>Xbox</td><td>A, B, X, Y</td><td>Xbox</td></tr>
              <tr><td>"playstation"</td><td>PlayStation</td><td>Cross, Circle, Square, Triangle</td><td>PS</td></tr>
              <tr><td>"switch"</td><td>Nintendo Switch</td><td>B, A, Y, X (positionally swapped)</td><td>Home</td></tr>
              <tr><td>"generic"</td><td>Generic</td><td>Button0–Button3</td><td>Button16</td></tr>
            </tbody>
          </table>

          <h3 className="docs-h3">Face Button Mapping by Index</h3>
          <table className="props-table">
            <thead>
              <tr><th>Index</th><th>Xbox</th><th>PlayStation</th><th>Switch</th><th>Generic</th></tr>
            </thead>
            <tbody>
              <tr><td>0</td><td>A</td><td>Cross</td><td>B</td><td>Button0</td></tr>
              <tr><td>1</td><td>B</td><td>Circle</td><td>A</td><td>Button1</td></tr>
              <tr><td>2</td><td>X</td><td>Square</td><td>Y</td><td>Button2</td></tr>
              <tr><td>3</td><td>Y</td><td>Triangle</td><td>X</td><td>Button3</td></tr>
              <tr><td>4</td><td>LB</td><td>L1</td><td>L</td><td>Button4</td></tr>
              <tr><td>5</td><td>RB</td><td>R1</td><td>R</td><td>Button5</td></tr>
              <tr><td>6</td><td>LT</td><td>L2</td><td>ZL</td><td>Button6</td></tr>
              <tr><td>7</td><td>RT</td><td>R2</td><td>ZR</td><td>Button7</td></tr>
              <tr><td>8</td><td>Select</td><td>Share</td><td>Minus</td><td>Button8</td></tr>
              <tr><td>9</td><td>Start</td><td>Options</td><td>Plus</td><td>Button9</td></tr>
              <tr><td>10</td><td>LS</td><td>L3</td><td>LS</td><td>Button10</td></tr>
              <tr><td>11</td><td>RS</td><td>R3</td><td>RS</td><td>Button11</td></tr>
            </tbody>
          </table>

          <h3 className="docs-h3">buttonLabels Example</h3>
          <pre className="code-block"><code>{`const { buttonLabels } = useGamepads({ controllerProfile: 'playstation' });

// buttonLabels maps Xbox names → active profile names:
// { A: 'Cross', B: 'Circle', X: 'Square', Y: 'Triangle',
//   LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', ... }

<button onClick={confirm}>{buttonLabels.A} to confirm</button>
// Renders: "Cross to confirm" on PlayStation, "A to confirm" on Xbox`}</code></pre>
        </div>

        {/* Haptics */}
        <div className="docs-section" id="haptics">
          <h2 className="docs-h2">Haptics</h2>
          <p className="docs-p">
            The <code className="docs-inline-code">rumble</code> function returned by all hooks
            triggers dual-motor haptic feedback using the browser's{' '}
            <code className="docs-inline-code">GamepadHapticActuator</code> API.
          </p>
          <pre className="code-block"><code>{`const { rumble } = useGamepads();

// Short strong pulse
await rumble({ duration: 200, strongMagnitude: 1.0, weakMagnitude: 0.3 });

// Long gentle rumble with a delay
await rumble({
  duration: 1000,
  weakMagnitude: 0.5,
  strongMagnitude: 0.2,
  startDelay: 100,
});`}</code></pre>

          <h3 className="docs-h3">RumbleOptions</h3>
          <table className="props-table">
            <thead>
              <tr><th>Option</th><th>Type</th><th>Default</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td>duration</td><td>number</td><td>required</td><td>Duration in milliseconds.</td></tr>
              <tr><td>weakMagnitude</td><td>number</td><td>0.5</td><td>High-frequency motor intensity (0–1). Feels like a buzz.</td></tr>
              <tr><td>strongMagnitude</td><td>number</td><td>0.5</td><td>Low-frequency motor intensity (0–1). Feels like a thump.</td></tr>
              <tr><td>startDelay</td><td>number</td><td>0</td><td>Delay in ms before the effect starts.</td></tr>
            </tbody>
          </table>
          <div className="callout">
            Haptics are silently skipped if the controller or browser does not support the
            Vibration API. As of 2024, Chrome and Edge support it; Firefox and Safari do not.
          </div>
        </div>

        {/* Dead Zones */}
        <div className="docs-section" id="dead-zones">
          <h2 className="docs-h2">Dead Zones</h2>
          <p className="docs-p">
            Axes with a value magnitude below the dead zone threshold are reported as{' '}
            <code className="docs-inline-code">0</code>, preventing drift from worn sticks.
            Pass either a preset string or a raw number (0–1) to{' '}
            <code className="docs-inline-code">deadZone</code>.
          </p>
          <table className="props-table">
            <thead>
              <tr><th>Preset</th><th>Value</th><th>Use case</th></tr>
            </thead>
            <tbody>
              <tr><td>"none"</td><td>0</td><td>No dead zone — every tiny movement is reported.</td></tr>
              <tr><td>"small"</td><td>0.05</td><td>Good for new controllers with minimal drift.</td></tr>
              <tr><td>"medium"</td><td>0.08</td><td>Default. Works well for most worn controllers.</td></tr>
              <tr><td>"large"</td><td>0.15</td><td>Older or heavily worn sticks.</td></tr>
            </tbody>
          </table>
          <pre className="code-block"><code>{`// Preset
const { gamepad } = useGamepads({ deadZone: 'large' });

// Custom numeric value
const { gamepad } = useGamepads({ deadZone: 0.12 });`}</code></pre>
        </div>

        {/* TypeScript */}
        <div className="docs-section" id="typescript">
          <h2 className="docs-h2">TypeScript</h2>
          <p className="docs-p">All types are exported from the main package entry point.</p>
          <table className="props-table">
            <thead>
              <tr><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td>ReactGamepad</td><td>Full gamepad state snapshot (connected, id, index, buttons, axes, mapping).</td></tr>
              <tr><td>ButtonDetails</td><td>{'{ buttonIndex: number, buttonName: string, pressed: boolean, touched: boolean, value: string }'}</td></tr>
              <tr><td>AxesDetails</td><td>{'{ axesIndex: number, axesName: string, value: number, previousValue: number }'}</td></tr>
              <tr><td>RumbleOptions</td><td>{'{ duration: number, weakMagnitude?: number, strongMagnitude?: number, startDelay?: number }'}</td></tr>
              <tr><td>ControllerProfile</td><td>'xbox' | 'playstation' | 'switch' | 'generic'</td></tr>
              <tr><td>UseGamepadsProps</td><td>Full props interface for useGamepads / useGamepad.</td></tr>
              <tr><td>UseGamepadsReturn</td><td>Return type of useGamepads / useGamepad.</td></tr>
              <tr><td>UseGamepadSequenceOptions</td><td>Options for useGamepadSequence.</td></tr>
              <tr><td>UseGamepadSequenceReturn</td><td>{'{ reset: () => void }'}</td></tr>
              <tr><td>WithGamepadsProps</td><td>Props injected by the withGamepads HOC (alias of UseGamepadsReturn).</td></tr>
            </tbody>
          </table>
          <pre className="code-block"><code>{`import type {
  ReactGamepad,
  ButtonDetails,
  AxesDetails,
  RumbleOptions,
  ControllerProfile,
  UseGamepadsProps,
  UseGamepadsReturn,
} from 'awesome-react-gamepads';`}</code></pre>
        </div>

        {/* Browser Compatibility */}
        <div className="docs-section" id="compat">
          <h2 className="docs-h2">Browser Compatibility</h2>
          <table className="compat-table">
            <thead>
              <tr><th>Browser</th><th>Gamepad API</th><th>Haptics</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Chrome 21+</td>
                <td><span className="badge-yes">Yes</span></td>
                <td><span className="badge-yes">Yes</span></td>
                <td>Full support including vibration actuator.</td>
              </tr>
              <tr>
                <td>Edge 12+</td>
                <td><span className="badge-yes">Yes</span></td>
                <td><span className="badge-yes">Yes</span></td>
                <td>Full support (Chromium-based).</td>
              </tr>
              <tr>
                <td>Firefox 29+</td>
                <td><span className="badge-yes">Yes</span></td>
                <td><span className="badge-no">No</span></td>
                <td>Gamepad input works. Haptics not supported.</td>
              </tr>
              <tr>
                <td>Safari 10.1+</td>
                <td><span className="badge-partial">Partial</span></td>
                <td><span className="badge-no">No</span></td>
                <td>Requires user gesture to activate. No haptics.</td>
              </tr>
              <tr>
                <td>iOS Safari</td>
                <td><span className="badge-partial">Partial</span></td>
                <td><span className="badge-no">No</span></td>
                <td>iOS 14.5+. MFi controllers only.</td>
              </tr>
            </tbody>
          </table>
          <div className="callout">
            The library gracefully handles missing APIs — if{' '}
            <code className="docs-inline-code">navigator.getGamepads</code> is unavailable (SSR,
            unsupported browser), all hooks return empty state and no errors are thrown.
          </div>
        </div>

      </div>

      {/* ── TOC ── */}
      <aside className="docs-toc">
        <div className="docs-toc-title">On this page</div>
        {toc.map((item) => (
          <a
            key={item.id}
            className="docs-toc-link"
            onClick={() => scrollTo(item.id)}
          >
            {item.label}
          </a>
        ))}
      </aside>
    </div>
  );
}
