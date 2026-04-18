# awesome-react-gamepads

> React hooks for the browser Gamepad API — buttons, axes, rumble, sequences, and multiplayer out of the box.

[![npm version](https://badge.fury.io/js/awesome-react-gamepads.svg)](https://badge.fury.io/js/awesome-react-gamepads)
[![install size](https://packagephobia.com/badge?p=awesome-react-gamepads)](https://packagephobia.com/result?p=awesome-react-gamepads)
[![license](https://img.shields.io/npm/l/awesome-react-gamepads.svg)](https://github.com/ChristopherHButler/awesome-react-gamepads/blob/main/LICENSE)

`awesome-react-gamepads` is a lightweight React hook library that wraps the native browser [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API). It handles the polling loop, dead zones, button hold detection, haptics, controller profiles, and custom DOM events so you can focus on building your game or UI.

## Demo

**[Live demo →](https://awesome-react-gamepads-demo.vercel.app/)**

Connect a gamepad and explore the controller visualizer, docs, and playable games built with the library.

## Features

- `useGamepads` — track all connected gamepads with a full callback and event API
- `useGamepad(index)` — single-controller variant; use multiple instances for local multiplayer
- `useGamepadSequence` — detect arbitrary button combos or cheat codes (Konami, fighting-game specials, etc.)
- Context API — `GamepadsProvider`, `useGamepadsContext`, and `withGamepads` HOC; one polling loop, any depth
- Controller profiles — `xbox`, `playstation`, `switch`, `generic`; `buttonLabels` maps button names for your UI
- Haptics / rumble via `rumble()` with `duration`, `weakMagnitude`, `strongMagnitude`, `startDelay`
- Button hold / long-press detection via `onGamepadButtonHold`
- Dead zone presets (`"none"` | `"small"` | `"medium"` | `"large"`) or a raw number
- Configurable poll rate — `requestAnimationFrame` (default) or a fixed `setInterval` interval
- Konami code built-in via `onKonamiSuccess`
- SSR / Next.js safe — all `window` and `navigator` calls are guarded
- Ships as ESM, CommonJS, and UMD bundles with full TypeScript types

## Installation

```bash
npm install awesome-react-gamepads
```

**Peer dependencies:** React 16.8 or later.

## Quick Start

```tsx
import { useGamepads } from 'awesome-react-gamepads';

function Game() {
  const { gamepad, rumble } = useGamepads({
    onA: () => {
      jump();
      rumble({ duration: 80, strongMagnitude: 0.6 });
    },
  });

  return <p>{gamepad?.connected ? 'Controller connected' : 'No controller'}</p>;
}
```

## API

### `useGamepads(options?)`

Tracks all connected gamepads. Polls via `requestAnimationFrame` by default.

```tsx
import { useGamepads } from 'awesome-react-gamepads';

const { gamepad, rumble, profile, buttonLabels } = useGamepads(options);
```

#### Props (`UseGamepadsProps`)

All props are optional.

| Prop | Type | Default | Description |
|---|---|---|---|
| `deadZone` | `number \| "none" \| "small" \| "medium" \| "large"` | `"medium"` | Axis values below this threshold are clamped to 0. Presets: `none`=0, `small`=0.05, `medium`=0.08, `large`=0.15. |
| `stickThreshold` | `number` | `0.75` | Value above which directional stick callbacks (`onLeftStickRight`, etc.) fire. |
| `holdThreshold` | `number` (ms) | `500` | Duration a button must be held before `onGamepadButtonHold` fires. |
| `pollRate` | `number` (ms) | — | When set, uses `setInterval` at this interval instead of `requestAnimationFrame`. |
| `controllerProfile` | `ControllerProfile` | `"xbox"` | Active button-naming profile. Affects `ButtonDetails.buttonName` and `buttonLabels`. |
| `onConnect` | `(gamepad: ReactGamepad) => void` | — | Fired when a gamepad connects. |
| `onDisconnect` | `(gamepad: ReactGamepad) => void` | — | Fired when a gamepad disconnects. |
| `onUpdate` | `(gamepad: ReactGamepad) => void` | — | Fired on every poll cycle where state changed. |
| `onGamepadButtonDown` | `(button: ButtonDetails) => void` | — | Fired on any button press. |
| `onGamepadButtonUp` | `(button: ButtonDetails) => void` | — | Fired on any button release. |
| `onGamepadButtonChange` | `(button: ButtonDetails) => void` | — | Fired on any button state change (down or up). |
| `onGamepadButtonHold` | `(button: ButtonDetails) => void` | — | Fired once when a button has been held longer than `holdThreshold`. |
| `onA` | `(button: ButtonDetails) => void` | — | Bottom face button (index 0) pressed. |
| `onB` | `(button: ButtonDetails) => void` | — | Right face button (index 1) pressed. |
| `onX` | `(button: ButtonDetails) => void` | — | Left face button (index 2) pressed. |
| `onY` | `(button: ButtonDetails) => void` | — | Top face button (index 3) pressed. |
| `onLB` | `(button: ButtonDetails) => void` | — | Left shoulder (index 4) pressed. |
| `onRB` | `(button: ButtonDetails) => void` | — | Right shoulder (index 5) pressed. |
| `onLT` | `(button: ButtonDetails) => void` | — | Left trigger (index 6) pressed. |
| `onRT` | `(button: ButtonDetails) => void` | — | Right trigger (index 7) pressed. |
| `onSelect` | `(button: ButtonDetails) => void` | — | Back / Select button (index 8) pressed. |
| `onStart` | `(button: ButtonDetails) => void` | — | Start / Menu button (index 9) pressed. |
| `onLS` | `(button: ButtonDetails) => void` | — | Left stick click (index 10) pressed. |
| `onRS` | `(button: ButtonDetails) => void` | — | Right stick click (index 11) pressed. |
| `onDPadUp` | `(button: ButtonDetails) => void` | — | D-Pad Up (index 12) pressed. |
| `onDPadDown` | `(button: ButtonDetails) => void` | — | D-Pad Down (index 13) pressed. |
| `onDPadLeft` | `(button: ButtonDetails) => void` | — | D-Pad Left (index 14) pressed. |
| `onDPadRight` | `(button: ButtonDetails) => void` | — | D-Pad Right (index 15) pressed. |
| `onXBoxLogo` | `(button: ButtonDetails) => void` | — | Home / Guide button (index 16) pressed. |
| `onGamepadAxesChange` | `(axes: AxesDetails) => void` | — | Fired when any axis value changes. |
| `onLeftStickRight` | `(axes: AxesDetails) => void` | — | Left stick crosses `stickThreshold` rightward. |
| `onLeftStickLeft` | `(axes: AxesDetails) => void` | — | Left stick crosses `stickThreshold` leftward. |
| `onLeftStickUp` | `(axes: AxesDetails) => void` | — | Left stick crosses `stickThreshold` upward. |
| `onLeftStickDown` | `(axes: AxesDetails) => void` | — | Left stick crosses `stickThreshold` downward. |
| `onRightStickRight` | `(axes: AxesDetails) => void` | — | Right stick crosses `stickThreshold` rightward. |
| `onRightStickLeft` | `(axes: AxesDetails) => void` | — | Right stick crosses `stickThreshold` leftward. |
| `onRightStickUp` | `(axes: AxesDetails) => void` | — | Right stick crosses `stickThreshold` upward. |
| `onRightStickDown` | `(axes: AxesDetails) => void` | — | Right stick crosses `stickThreshold` downward. |
| `onKonamiSuccess` | `() => void` | — | Fired when the Konami code (↑↑↓↓←→←→BA) is entered. |

Per-button callbacks (`onA`, `onB`, etc.) always refer to the same **physical button position** regardless of the active profile — `onA` always fires for button index 0 (bottom face button). Use `buttonLabels` from the return value to display the profile-correct name in your UI.

#### Return value (`UseGamepadsReturn`)

| Field | Type | Description |
|---|---|---|
| `gamepad` | `ReactGamepad \| undefined` | Current state snapshot of the active gamepad. `undefined` before first connection. |
| `rumble` | `(options: RumbleOptions) => Promise<void>` | Trigger haptic feedback. No-ops silently if unsupported. |
| `profile` | `ControllerProfile` | The active controller profile (`"xbox"`, `"playstation"`, etc.). |
| `buttonLabels` | `Record<string, string>` | Maps Xbox button names to the active profile's display names. |

### `useGamepad(index, options?)`

Tracks a single gamepad by index. Accepts the same options as `useGamepads` and returns the same value. Useful for local multiplayer where each player needs an isolated hook.

```tsx
import { useGamepad } from 'awesome-react-gamepads';

function Game() {
  const { gamepad: p1, rumble: rumble1 } = useGamepad(0, {
    onA: () => jump(1),
    controllerProfile: 'xbox',
  });

  const { gamepad: p2, rumble: rumble2 } = useGamepad(1, {
    onA: () => jump(2),
    controllerProfile: 'playstation',
  });

  return (
    <>
      <p>P1: {p1?.connected ? 'ready' : 'disconnected'}</p>
      <p>P2: {p2?.connected ? 'ready' : 'disconnected'}</p>
    </>
  );
}
```

### `useGamepadSequence(sequence, callback, options?)`

Detects an arbitrary button sequence and fires `callback` when it is matched in order. Works standalone — no `useGamepads` call required in the same component.

Sequence items can be button names (`"A"`, `"Cross"`) or raw Standard Gamepad indices (`0`, `1`, `2`…).

```tsx
import { useGamepadSequence } from 'awesome-react-gamepads';

// Konami code
useGamepadSequence(
  ['DPadUp','DPadUp','DPadDown','DPadDown','DPadLeft','DPadRight','DPadLeft','DPadRight','B','A'],
  () => activateCheats(),
);

// Fighting-game special with a 2-second input window between presses
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

// Raw indices
useGamepadSequence([0, 1, 0], () => doSomething());
```

#### Options (`UseGamepadSequenceOptions`)

| Option | Type | Default | Description |
|---|---|---|---|
| `timeout` | `number` (ms) | `0` | Maximum time allowed between consecutive inputs before progress resets. `0` means no limit. |
| `resetOnMiss` | `boolean` | `true` | Reset progress when a wrong button is pressed. |
| `controllerProfile` | `ControllerProfile` | `"xbox"` | Profile used to resolve button names in the sequence. |

#### Return value (`UseGamepadSequenceReturn`)

| Field | Type | Description |
|---|---|---|
| `reset` | `() => void` | Manually reset sequence progress back to the beginning. |

### Context API

Mount a single `GamepadsProvider` at the top of your tree. All descendants can read the gamepad state with `useGamepadsContext()` without prop-drilling, and without starting extra polling loops.

`GamepadsProvider` accepts all the same props as `useGamepads`, including all callbacks.

```tsx
import { GamepadsProvider, useGamepadsContext } from 'awesome-react-gamepads';

function App() {
  return (
    <GamepadsProvider controllerProfile="playstation" onA={() => jump()}>
      <Game />
    </GamepadsProvider>
  );
}

function HUD() {
  const { gamepad, buttonLabels, rumble } = useGamepadsContext();
  return (
    <div>
      <p>Press {buttonLabels.A} to fire</p>
      <button onClick={() => rumble({ duration: 200, strongMagnitude: 0.8 })}>
        Rumble
      </button>
    </div>
  );
}
```

`useGamepadsContext()` throws a descriptive error when called outside a `<GamepadsProvider>`.

#### `withGamepads(Component)`

HOC for class components (or any component that cannot call hooks directly). Requires a `GamepadsProvider` ancestor. The injected props match `UseGamepadsReturn`.

```tsx
import { withGamepads, WithGamepadsProps, GamepadsProvider } from 'awesome-react-gamepads';

interface OwnProps {
  playerName: string;
}

class PlayerHUD extends React.Component<OwnProps & WithGamepadsProps> {
  render() {
    const { playerName, gamepad, buttonLabels } = this.props;
    return <p>{playerName}: press {buttonLabels.A} to jump</p>;
  }
}

export default withGamepads(PlayerHUD);

// In App (GamepadsProvider must be an ancestor):
// <GamepadsProvider><PlayerHUD playerName="P1" /></GamepadsProvider>
```

## Controller Profiles

Pass `controllerProfile` to any hook or the `GamepadsProvider` to switch button naming conventions. The underlying physical layout (Standard Gamepad indices) is the same across all profiles — only the names change.

| Profile | Face buttons | Shoulders | Triggers | Back / Start | Home |
|---|---|---|---|---|---|
| `xbox` | A, B, X, Y | LB, RB | LT, RT | Select, Start | Xbox |
| `playstation` | Cross, Circle, Square, Triangle | L1, R1 | L2, R2 | Share, Options | PS |
| `switch` | B, A, Y, X | L, R | ZL, ZR | Minus, Plus | Home |
| `generic` | Button0–3 | Button4–5 | Button6–7 | Button8–9 | Button16 |

The `buttonLabels` field on the return value maps Xbox names to the active profile's names. Use it to render the correct label in your UI without hardcoding profile-specific strings:

```tsx
const { buttonLabels } = useGamepads({ controllerProfile: 'playstation' });

<p>Press {buttonLabels.A} to confirm</p>   // → "Press Cross to confirm"
<p>Press {buttonLabels.LB} to sprint</p>   // → "Press L1 to sprint"
```

Per-button callbacks (`onA`, `onB`, `onX`, `onY`, etc.) are always named after the Xbox layout and map to the same physical button index on every profile. `onA` fires for button index 0 regardless of whether the connected controller calls it "A", "Cross", or "B".

## Haptics / Rumble

The `rumble` function returned by any hook triggers haptic feedback via `GamepadHapticActuator.playEffect('dual-rumble', …)`.

```tsx
interface RumbleOptions {
  duration: number;        // milliseconds
  weakMagnitude?: number;  // 0–1, default 0.5  (high-frequency motor)
  strongMagnitude?: number;// 0–1, default 0.5  (low-frequency motor)
  startDelay?: number;     // milliseconds, default 0
}
```

```tsx
const { rumble } = useGamepads();

// Sharp hit feedback
rumble({ duration: 100, strongMagnitude: 1.0, weakMagnitude: 0.3 });

// Gentle continuous vibration
rumble({ duration: 500, strongMagnitude: 0.2, weakMagnitude: 0.2 });

// Delayed secondary pulse
rumble({ duration: 150, strongMagnitude: 0.8, startDelay: 200 });
```

`rumble` is an async function that resolves when the effect completes. It catches and silently discards any error so it is always safe to call. If the browser or controller does not support haptics, it is a no-op.

**Browser support:** Chrome and Edge support dual-rumble. Firefox and Safari do not expose the haptics API — `rumble` silently does nothing on those browsers.

## Dead Zones

The `deadZone` option clamps small axis values to zero, preventing stick drift from triggering callbacks.

| Preset | Value |
|---|---|
| `"none"` | 0 |
| `"small"` | 0.05 |
| `"medium"` | 0.08 (default) |
| `"large"` | 0.15 |

A raw number is also accepted for precise control:

```tsx
useGamepads({ deadZone: 0.12 });
```

## Custom DOM Events

Every hook also dispatches custom events on `document` so non-React code can react to gamepad input. All events bubble and include a `detail` object.

| Event | Fired when | `detail` shape |
|---|---|---|
| `gamepadupdated` | Each poll cycle where state changed | `{ gamepad }` |
| `gamepadbuttondown` | Any button pressed | `{ gamepad: number, buttonDetails: ButtonDetails }` |
| `gamepadbuttonup` | Any button released | `{ gamepad: number, buttonDetails: ButtonDetails }` |
| `gamepadbuttonchange` | Any button state change | `{ gamepad: number, buttonDetails: ButtonDetails }` |
| `axeschange` | Any axis value changes | `{ gamepad: number, axes: AxesDetails }` |
| `leftStickXRight` | Left stick crosses threshold rightward | `{ gamepad: number, axes: AxesDetails }` |
| `leftStickXLeft` | Left stick crosses threshold leftward | `{ gamepad: number, axes: AxesDetails }` |
| `leftStickYUp` | Left stick crosses threshold upward | `{ gamepad: number, axes: AxesDetails }` |
| `leftStickYDown` | Left stick crosses threshold downward | `{ gamepad: number, axes: AxesDetails }` |
| `rightStickXRight` | Right stick crosses threshold rightward | `{ gamepad: number, axes: AxesDetails }` |
| `rightStickXLeft` | Right stick crosses threshold leftward | `{ gamepad: number, axes: AxesDetails }` |
| `rightStickYUp` | Right stick crosses threshold upward | `{ gamepad: number, axes: AxesDetails }` |
| `rightStickYDown` | Right stick crosses threshold downward | `{ gamepad: number, axes: AxesDetails }` |

```tsx
useEffect(() => {
  const handler = (e: CustomEvent) => console.log('button pressed', e.detail.buttonDetails);
  document.addEventListener('gamepadbuttondown', handler as EventListener);
  return () => document.removeEventListener('gamepadbuttondown', handler as EventListener);
}, []);
```

## TypeScript

All types are exported from the package root.

```ts
import type {
  UseGamepadsProps,
  UseGamepadsReturn,
  UseGamepadSequenceOptions,
  UseGamepadSequenceReturn,
  ButtonDetails,
  AxesDetails,
  ReactGamepad,
  RumbleOptions,
  ControllerProfile,
  WithGamepadsProps,
} from 'awesome-react-gamepads';
```

### `ButtonDetails`

Passed to all button callbacks.

```ts
interface ButtonDetails {
  buttonIndex: number;   // Standard Gamepad button index (0–16)
  buttonName: string;    // Profile-specific name, e.g. "A", "Cross", "B"
  pressed: boolean;
  touched: boolean;
  value: string;         // Analog value as a string (useful for triggers)
}
```

### `AxesDetails`

Passed to all axes callbacks.

```ts
interface AxesDetails {
  axesIndex: number;     // Standard Gamepad axes index
  axesName: string;      // One of: LeftStickX, LeftStickY, RightStickX, RightStickY, LeftTrigger, RightTrigger
  value: number;         // Current value after dead zone applied
  previousValue: number; // Value on the previous poll
}
```

Valid `axesName` values: `LeftStickX`, `LeftStickY`, `RightStickX`, `RightStickY`, `LeftTrigger`, `RightTrigger`.

### `ControllerProfile`

```ts
type ControllerProfile = 'xbox' | 'playstation' | 'switch' | 'generic';
```

## Browser Compatibility

| Browser | Support | Notes |
|---|---|---|
| Chrome | Full | Gamepad API and haptics both supported |
| Edge | Full | Gamepad API and haptics both supported |
| Firefox | Partial | Gamepad API supported; haptics API not available — `rumble` is a no-op |
| Safari | Partial | Gamepad API support is limited; haptics not available — `rumble` is a no-op |

`rumble` catches all errors internally and never throws, so it is safe to call on any browser without wrapping in a try/catch.

## SSR / Next.js

All accesses to `window`, `navigator`, and `document` are guarded with `typeof window !== 'undefined'` checks. The hooks return immediately during server-side rendering without starting any polling loop and without throwing, making them safe in Next.js App Router and Pages Router server components or pages with SSR enabled.

## License

MIT
