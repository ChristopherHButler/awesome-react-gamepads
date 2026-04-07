# awesome-react-gamepads

> 🎮 &nbsp; A react hook to use the browser [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API) in react applications.

<p align="center">
  <a href="https://badge.fury.io/js/awesome-react-gamepads">
    <img src="https://badge.fury.io/js/awesome-react-gamepads.svg" alt="npm version" height="18">
  </a>
  <a href="https://packagephobia.com/result?p=awesome-react-gamepads">
    <img src="https://packagephobia.com/badge?p=awesome-react-gamepads" alt="install size" >
  </a>
  <a href="https://github.com/ChristopherHButler/awesome-react-gamepads/blob/setup/LICENSE">
    <img src="https://img.shields.io/npm/l/awesome-react-gamepads.svg" alt="license">
  </a>
</p>
<br />

## Install

```sh
> npm install awesome-react-gamepads
```

<br />

## Features

- `useGamepads` — tracks all connected gamepads with a full callback and event API
- `useGamepad(index)` — single-controller variant for local multiplayer
- Per-button callbacks: `onA`, `onB`, `onX`, `onY`, etc.
- Button hold / long-press detection via `onGamepadButtonHold`
- Haptic/rumble support via the `rumble()` return value
- Polling rate control — use `requestAnimationFrame` (default) or a fixed interval
- Dead zone presets: `"none" | "small" | "medium" | "large"` or a raw number
- Konami code detection out of the box
- SSR / Next.js safe — no `window`/`navigator` access during server render
- ES modules, CommonJS, and UMD bundles

<br />

## Hook Usage

### useGamepads

Tracks all connected gamepads. Returns `{ gamepad, rumble }`.

```tsx
import { useGamepads } from 'awesome-react-gamepads';

const Controller = () => {
  const { gamepad, rumble } = useGamepads({
    onA: (button) => console.log('A pressed', button),
    onGamepadButtonHold: (button) => console.log(`${button.buttonName} held`),
    onKonamiSuccess: () => console.log('Konami!'),
  });

  return (
    <button onClick={() => rumble({ duration: 200, strongMagnitude: 0.8 })}>
      Rumble
    </button>
  );
};
```

### useGamepad(index)

Tracks a single gamepad by index. Useful for local multiplayer:

```tsx
import { useGamepad } from 'awesome-react-gamepads';

const Game = () => {
  const { gamepad: p1, rumble: rumble1 } = useGamepad(0, { onA: () => jump(1) });
  const { gamepad: p2, rumble: rumble2 } = useGamepad(1, { onA: () => jump(2) });
  // ...
};
```

### Using events

```tsx
import { useState, useEffect } from 'react';
import { useGamepads } from 'awesome-react-gamepads';

const Controller = () => {
  useGamepads();

  useEffect(() => {
    const handler = (e: CustomEvent) => console.log('button up', e.detail);
    document.addEventListener('gamepadbuttonup', handler);
    return () => document.removeEventListener('gamepadbuttonup', handler);
  }, []);

  return <div />;
};
```

<br />

### Props API

All props are optional.

#### deadZone

`number | "none" | "small" | "medium" | "large"`

Threshold below which axis values are rounded to 0. Presets: `none` = 0, `small` = 0.05, `medium` = 0.08 (default), `large` = 0.15.

#### stickThreshold

`number` — default `0.75`

Threshold above which directional stick callbacks (`onLeftStickRight`, etc.) fire.

#### holdThreshold

`number` — default `500` (ms)

How long a button must be held before `onGamepadButtonHold` fires.

#### controllerProfile

`"xbox" | "playstation" | "switch" | "generic"` — default `"xbox"`

Maps button names to the correct labels for the connected controller. Affects `ButtonDetails.buttonName` in all callbacks and the `buttonLabels` return value.

| Profile | Face buttons | Shoulders | Triggers | Back / Start |
|---|---|---|---|---|
| `xbox` | A, B, X, Y | LB, RB | LT, RT | Select, Start |
| `playstation` | Cross, Circle, Square, Triangle | L1, R1 | L2, R2 | Share, Options |
| `switch` | B, A, Y, X | L, R | ZL, ZR | Minus, Plus |
| `generic` | Button0–3 | Button4–5 | Button6–7 | Button8–9 |

Per-button callbacks (`onA`, `onB`, etc.) always refer to the same **physical button position** regardless of profile — `onA` fires for button index 0 (bottom face) on any controller. Use `buttonLabels` from the return value to display the correct label in your UI.

```tsx
const { buttonLabels } = useGamepads({ controllerProfile: 'playstation' });
<p>Press {buttonLabels.A} to jump</p>  // → "Press Cross to jump"
```

#### pollRate

`number` (ms) — default: use `requestAnimationFrame`

When set, polling uses `setInterval` at this interval instead of rAF. Useful for UI navigation that doesn't need 60fps.

---

#### Lifecycle callbacks

##### onConnect

`onConnect(gamepad: ReactGamepad)`
Fired when a gamepad connects.

##### onDisconnect

`onDisconnect(gamepad: ReactGamepad)`
Fired when a gamepad disconnects.

##### onUpdate

`onUpdate(gamepad: ReactGamepad)`
Fired on every poll cycle.

---

#### Generic button callbacks

##### onGamepadButtonDown

`onGamepadButtonDown(button: ButtonDetails)`
Fired on any button press.

##### onGamepadButtonUp

`onGamepadButtonUp(button: ButtonDetails)`
Fired on any button release.

##### onGamepadButtonChange

`onGamepadButtonChange(button: ButtonDetails)`
Fired on any button state change (down or up).

##### onGamepadButtonHold

`onGamepadButtonHold(button: ButtonDetails)`
Fired once per press when a button has been held longer than `holdThreshold`.

---

#### Per-button callbacks

Each fires on button-down for that specific button.

| Prop | Button |
|---|---|
| `onA` | A |
| `onB` | B |
| `onX` | X |
| `onY` | Y |
| `onLB` | Left bumper |
| `onRB` | Right bumper |
| `onLT` | Left trigger |
| `onRT` | Right trigger |
| `onSelect` | Select / Back |
| `onStart` | Start / Menu |
| `onLS` | Left stick click |
| `onRS` | Right stick click |
| `onDPadUp` | D-Pad Up |
| `onDPadDown` | D-Pad Down |
| `onDPadLeft` | D-Pad Left |
| `onDPadRight` | D-Pad Right |
| `onXBoxLogo` | Xbox / Guide button |

All have the signature `(button: ButtonDetails) => void`.

---

#### Axes callbacks

##### onGamepadAxesChange

`onGamepadAxesChange(axes: AxesDetails)`
Fired when any axis moves.

##### Left stick directional

`onLeftStickRight`, `onLeftStickLeft`, `onLeftStickUp`, `onLeftStickDown`

Each fires `(axes: AxesDetails)` when the stick crosses `stickThreshold`.

##### Right stick directional

`onRightStickRight`, `onRightStickLeft`, `onRightStickUp`, `onRightStickDown`

---

#### onKonamiSuccess

`onKonamiSuccess()`
Fired when the Konami code (↑↑↓↓←→←→BA) is entered.

---

### Return value

```ts
{
  gamepad: ReactGamepad | undefined;
  rumble: (options: RumbleOptions) => Promise<void>;
  profile: ControllerProfile;
  buttonLabels: Record<string, string>;
}
```

#### buttonLabels

Maps Xbox button names to the active profile's display names. `buttonLabels.A` returns `"Cross"` for PlayStation, `"B"` for Switch, `"A"` for Xbox.

#### rumble

Triggers haptic feedback via `GamepadHapticActuator.playEffect`. No-ops silently if the browser or controller does not support haptics.

```ts
interface RumbleOptions {
  duration: number;       // ms
  weakMagnitude?: number;   // 0–1, default 0.5
  strongMagnitude?: number; // 0–1, default 0.5
  startDelay?: number;    // ms, default 0
}
```

Example:

```tsx
const { rumble } = useGamepads();

// Short strong pulse on hit
rumble({ duration: 100, strongMagnitude: 1.0, weakMagnitude: 0.3 });

// Gentle continuous vibration
rumble({ duration: 500, strongMagnitude: 0.2, weakMagnitude: 0.2 });
```

---

### Events

Custom DOM events dispatched on `document`:

| Event | Fired when |
|---|---|
| `gamepadconnected` | Gamepad connects |
| `gamepaddisconnected` | Gamepad disconnects |
| `gamepadupdated` | Each poll cycle |
| `gamepadbuttondown` | Any button pressed |
| `gamepadbuttonup` | Any button released |
| `gamepadbuttonchange` | Any button state change |
| `axeschange` | Any axis moves |
| `leftStickXRight` | Left stick past threshold right |
| `leftStickXLeft` | Left stick past threshold left |
| `leftStickYUp` | Left stick past threshold up |
| `leftStickYDown` | Left stick past threshold down |
| `rightStickXRight` | Right stick past threshold right |
| `rightStickXLeft` | Right stick past threshold left |
| `rightStickYUp` | Right stick past threshold up |
| `rightStickYDown` | Right stick past threshold down |

All events include `detail: { gamepad: number, buttonDetails | axes }`.

---

## TypeScript Interfaces

### ButtonDetails

```ts
interface ButtonDetails {
  buttonIndex: number;
  buttonName: string;
  pressed: boolean;
  touched: boolean;
  value: string;
}
```

### AxesDetails

```ts
interface AxesDetails {
  axesIndex: number;
  axesName: string;
  value: number;
  previousValue: number;
}
```

### RumbleOptions

```ts
interface RumbleOptions {
  duration: number;
  weakMagnitude?: number;
  strongMagnitude?: number;
  startDelay?: number;
}
```

---

## XBox Controller Layout

| Button | Index |
|---|---|
| A | 0 |
| B | 1 |
| X | 2 |
| Y | 3 |
| LB | 4 |
| RB | 5 |
| LT | 6 |
| RT | 7 |
| Select | 8 |
| Start | 9 |
| LS (Left Stick Click) | 10 |
| RS (Right Stick Click) | 11 |
| DPadUp | 12 |
| DPadDown | 13 |
| DPadLeft | 14 |
| DPadRight | 15 |
| Xbox | 16 |

---

## Motivation

I was curious as to how I could use the Gamepad API in a react app and stumbled across [this blog post](https://whoisryosuke.com/blog/2020/adding-game-controller-input-to-react/) by [Ryosuke](https://github.com/whoisryosuke). He explained everything he did to build his library [react-gamepads](https://www.npmjs.com/package/react-gamepads) in extreme detail.

I really wanted to be able to detect a sequence of button presses (for example, the [Konami code](https://en.wikipedia.org/wiki/Konami_Code)). In order to do that I had to create an API that allowed me to fire on `onGamepadButtonUp` or `onGamepadButtonDown`.

## Contributing

Yes. Do it. All about that.

1. Fork the project
2. Create a feature branch (`git checkout -b f/amazingFeature`)
3. Commit your changes (`git commit -m 'added awesome sauce'`)
4. Push to the remote branch (`git push origin f/amazingFeature`)
5. Open a pull request.

#### Contributors: 1

- :monkey_face: Christopher Harold Butler ([ChristopherHButler](https://github.com/ChristopherHButler))

## License

Distributed under the MIT License. See LICENSE for more information.
<br />

## References

### Official Docs

- [MDN - Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API)
- [W3C - Gamepad](https://www.w3.org/TR/gamepad/)
- [caniuse.com/gamepad](https://caniuse.com/gamepad)

### Useful Resources

- [https://gamepad-tester.com/](https://gamepad-tester.com/)
- [https://www.javascripture.com/Gamepad](https://www.javascripture.com/Gamepad)
- [https://www.smashingmagazine.com/2015/11/gamepad-api-in-web-games/](https://www.smashingmagazine.com/2015/11/gamepad-api-in-web-games/)

### Existing Packages

- [https://www.npmjs.com/package/react-gamepad](https://www.npmjs.com/package/react-gamepad)
- [https://www.npmjs.com/package/react-gamepads](https://www.npmjs.com/package/react-gamepads)

<br />
