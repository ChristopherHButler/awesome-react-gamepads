# awesome-react-gamepads

> 🎮 &nbsp; A react hook, context and HOC to use the browser [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API) in react applications.

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

- A react hook and context to use the native browser Gamepad API in react applications.

- A React component to visualize button and axe interaction on the xbox gamepad.

- Support for using a callback on successful konami code entry from the gamepad.

- Supports ES modules (esm), CommonJS (cjs) and UMD modules. The default entry point is the esm module.

<br />

## Hook Usage

### Props API

#### deadZone

Threshold below which the axis values will be rounded to 0.0.
Default: 0.08

#### stickThreshold

Threshold above which `onUp`, `onDown`, `onLeft`, `onRight` are triggered for the left stick.
`Default: 0.75`

#### onConnect

`onConnect(gamepad: Gamepad)`
Fired when the gamepad connects. Will be triggered at least once after the Gamepad component is mounted.

#### onDisconnect

`onDisconnect(gamepad: Gamepad)`
Fired when the gamepad disconnects.

#### onUpdate

`onUpdate(gamepad: ReactGamepad)`
Fired whenever the gamepad is updated. This hook is setup to use the requestAnimationFrame and so it updates 60 times per second or every 0.0167s.

#### onGamepadButtonDown

`onGamepadButtonDown(button: ButtonDetails)`
Fired on (at the beginning of) a button press.

#### onGamepadButtonUp

`onGamepadButtonUp(button: ButtonDetails)`
Fired when a button press is released.

#### onGamepadButtonChange

`onGamepadButtonChange(button: ButtonDetails)`
Fired when there is a state change in the button. This could be either a button down or up event.

#### onGamepadAxesChange

`onGamepadAxesChange(axes: AxesDetails)`
Fired when there is a state change in the axes.

For individual button presses is it better to fire on button down, up or change? Will wait to implement these.

#### onA [HOLD]

`onA(button: ButtonDetails)`

#### onB [HOLD]

`onB(button: ButtonDetails)`

#### onX [HOLD]

`onX(button: ButtonDetails)`

#### onY [HOLD]

`onY(button: ButtonDetails)`

#### onStart [HOLD]

`onStart(button: ButtonDetails)`

#### onSelect [HOLD]

`onSelect(button: ButtonDetails)`

#### onLT [HOLD]

`onLT(button: ButtonDetails)`

#### onRT [HOLD]

`onRT(button: ButtonDetails)`

#### onLB [HOLD]

`onLB(button: ButtonDetails)`

#### onRB [HOLD]

`onRB(button: ButtonDetails)`

#### onLS [HOLD]

`onLS(button: ButtonDetails)`

#### onRS [HOLD]

`onRS(button: ButtonDetails)`

#### onDPadUp [HOLD]

`onDPadUp(button: ButtonDetails)`

#### onDPadDown [HOLD]

`onDPadDown(button: ButtonDetails)`

#### onDPadLeft [HOLD]

`onDPadLeft(button: ButtonDetails)`

#### onDPadRight [HOLD]

`onDPadRight(button: ButtonDetails)`

#### onXBoxLogo [HOLD]

`onXBoxLogo(button: ButtonDetails)`

#### onLeftStickRight

`onLeftStickRight`
`onLeftStickRight(axes: AxesDetails)`
fired when the left stick moves right.

#### onLeftStickLeft

`onLeftStickLeft`
`onLeftStickLeft(axes: AxesDetails)`

#### onLeftStickUp

`onLeftStickUp`
`onLeftStickUp(axes: AxesDetails)`

#### onLeftStickDown

`onLeftStickDown`
`onLeftStickDown(axes: AxesDetails)`

#### onRightStickRight

`onRightStickRight`
`onRightStickRight(axes: AxesDetails)`

#### onRightStickLeft

`onRightStickLeft`
`onRightStickLeft(axes: AxesDetails)`

#### onRightStickUp

`onRightStickUp`
`onRightStickUp(axes: AxesDetails)`

#### onRightStickDown

`onRightStickDown`
`onRightStickDown(axes: AxesDetails)`

#### onKonamiSuccess

`onKonamiSuccess()`
Fired when someone correctly enters to konami code.

### Events

#### gamepadconnected

`gamepadconnected`
Dispatched when the gamepad connects. Will be triggered at least once after the Gamepad component is mounted.

#### gamepaddisconnected

`gamepaddisconnected`
Dispatched when the gamepad disconnects.

#### gamepadupdated

`gamepadupdated`
Dispatched whenever the gamepad is updated. This hook is setup to use the requestAnimationFrame and so it updates 60 times per second or every 0.0167s.

#### gamepadbuttondown

`gamepadbuttondown`
Dispatched on (at the beginning of) a button press.

#### gamepadbuttonup

`gamepadbuttonup`
Dispatched when there is a state change in the button. This could be either a button down or up event.

#### gamepadbuttonchange

`gamepadbuttonchange`
Dispatched when there is a state change in the button. This could be either a button down or up event.

#### axeschange

`axeschange`
Dispatched when there is a state change in the axes.

#### leftStickXRight

`leftStickXRight`
fired when the left stick moves right.

#### leftStickXLeft

`leftStickXLeft`

#### leftStickYUp

`leftStickYUp`

#### leftStickYDown

`leftStickYDown`

#### rightStickXRight

`rightStickXRight`

#### rightStickXLeft

`rightStickXLeft`

#### rightStickYUp

`rightStickYUp`

#### rightStickYDown

`rightStickYDown`

### Examples

#### Example using callback props

```tsx
import useGamepads from 'awesome-react-gamepads';

interface IGamepads {
  [key: number]: Gamepad;
}

const Controller = () => {
  const [gamepad, setGamepad] = useState<Gamepad>({});
  const [gamepads, setGamepads] = useState<IGamepads>(null);

  useGamepads({
    // onConnect: (gamepad) => console.log('Gamepad Connected: ', gamepad),
    onUpdate: (gamepad) => setGamepads(gamepad),
    onGamepadButtonUp: (button) => onGamepadButtonUp(button),
    onKonamiSuccess: () => onKonamiSuccess(),
  });

  return <div>...</div>;
};
```

#### Example using events

```tsx
import { useState, useEffect } from 'react';
import useGamepads from 'awesome-react-gamepads';

interface IGamepads {
  [key: number]: Gamepad;
}

const Controller = () => {
  const [gamepad, setGamepad] = useState<Gamepad>({});
  const [gamepads, setGamepads] = useState<IGamepads>(null);

  const onEvtGamepadButtonUp = (e: CustomEvent) => {
    console.log('Event - onEvtGamepadButtonUp: ', e);
  };

  useEffect(() => {
    window.addEventListener('gamepadbuttonup', onEvtGamepadButtonUp);

    // cleanup this component
    return () => window.removeEventListener('gamepadbuttonup', onEvtGamepadButtonUp);
  }, []);

  return <div>...</div>;
};
```

## Context Usage

### API

[HOLD]

### Events

[HOLD]

### Examples

[HOLD]

## HOC Usage

### API

[HOLD]

### Events

[HOLD]

### Examples

[HOLD]

## Motivation

I was curious as to how I could use the Gamepad API in a react app and stumbled across [this blog post](https://whoisryosuke.com/blog/2020/adding-game-controller-input-to-react/) by [Ryosuke](https://github.com/whoisryosuke). He explained everything he did to build his library [react-gamepads](https://www.npmjs.com/package/react-gamepads) in extreme detail.

I really wanted to be able to detect a sequence of button presses though (for example, if someone entered the [konami code](https://en.wikipedia.org/wiki/Konami_Code)). In order to do that I had to create an API that allowed me to do something `onGamepadButtonUp` or `onGamepadButtonDown`.

## Contributing

Yes. Do it. All about that.

#### How to contribute

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

## Other APIs

### Gamepad

This is the Gamepad object of a Microsoft Xbox 360 controller. It has the following API:

| Property    | Description                                                                                                                          | Type                   | Access     | Default | Required |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ---------- | ------- | -------- |
| `id`        | This string contains identifying information about the gamepad.                                                                      | `string`               | `readonly` | null    | N/A      |
| `index`     | This is a unique auto-incremented integer for each gamepad.                                                                          | `number`               | `readonly` | null    | N/A      |
| `connected` | This is a boolean that indicates the gamepad’s connectivity.                                                                         | `boolean`              | `readonly` | null    | N/A      |
| `mapping`   | This string tells us whether the browser has remapped the device to a known layout                                                   | `string`               | `readonly` | null    | N/A      |
| `timestamp` | This increments when the device’s state changes. Some devices constantly poll, which means the timestamp is constantly incrementing. | `number`               | `readonly` | null    | N/A      |
| `axes`      | This is a collection of numbers that represent the state of each analogue stick or button.                                           | `Array<Number>`        | `readonly` | null    | N/A      |
| `buttons`   | This collection of objects represents the state of each button.                                                                      | `Array<GamepadButton>` | `readonly` | null    | N/A      |

### React Gamepad

This is a custom, extended Gamepad. It has the following _additional_ API:

| Property            | Description                                                                                                                                                                                    | Type                    | Access     | Default | Required |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------- | ------- | -------- |
| `vibrationActuator` | The GamepadHapticActuator interface of the Gamepad API represents hardware in the controller designed to provide haptic feedback to the user (if available), most commonly vibration hardware. | `GamepadHapticActuator` | `readonly` | null    | N/A      |

### ButtonDetails Interface

```ts
buttonIndex: number;
buttonName: string;
pressed: boolean;
touched: boolean;
value: string;
```

### AxesDetails Interface

```ts
interface AxesDetails {
  axesIndex: number;
  axesName: string;
  value: number;
  previousValue: number;
}
```

## XBox Controller Layout

| button    | button `.pressed` code and index                  |
| --------- | ------------------------------------------------- |
| A         | gamepad.buttons[0].pressed                        |
| B         | gamepad.buttons[1].pressed                        |
| X         | gamepad.buttons[2].pressed                        |
| Y         | gamepad.buttons[3].pressed                        |
| LB        | gamepad.buttons[4].pressed                        |
| RB        | gamepad.buttons[5].pressed                        |
| LT        | gamepad.buttons[6].pressed                        |
| RT        | gamepad.buttons[7].pressed                        |
| Select    | gamepad.buttons[8].pressed                        |
| Start     | gamepad.buttons[9].pressed                        |
| LS        | gamepad.buttons[10].pressed (Left Stick Pressed)  |
| RS        | gamepad.buttons[11].pressed (Right Stick Pressed) |
| DPadUp    | gamepad.buttons[12].pressed                       |
| DPadDown  | gamepad.buttons[13].pressed                       |
| DPadLeft  | gamepad.buttons[14].pressed                       |
| DPadRight | gamepad.buttons[15].pressed                       |
| Xbox      | gamepad.buttons[16].pressed                       |

## References

### Official Docs

- [MDN - Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API)
- [W3C - Gamepad](https://www.w3.org/TR/gamepad/)
- [https://caniuse.com/gamepad](https://caniuse.com/gamepad)
- []()

### Useful Blog Posts, etc.

#### Gamepad

- [https://gamepad-tester.com/](https://gamepad-tester.com/)
- [https://www.javascripture.com/Gamepad](https://www.javascripture.com/Gamepad)
- [https://www.smashingmagazine.com/2015/11/gamepad-api-in-web-games/](https://www.smashingmagazine.com/2015/11/gamepad-api-in-web-games/)
- [https://ui.dev/web-gamepad-api/](https://ui.dev/web-gamepad-api/)
- [https://www.developerdrive.com/how-to-enhance-html5-gaming-with-the-gamepad-api/](https://www.developerdrive.com/how-to-enhance-html5-gaming-with-the-gamepad-api/)

#### Events

- [https://javascript.info/dispatch-events](https://javascript.info/dispatch-events)
- [https://app.pluralsight.com/guides/event-listeners-in-react-components](https://app.pluralsight.com/guides/event-listeners-in-react-components)

### Existing Packages

- [https://www.npmjs.com/package/react-gamepad](https://www.npmjs.com/package/react-gamepad)
- [https://www.npmjs.com/package/react-gamepads](https://www.npmjs.com/package/react-gamepads)

<br />
