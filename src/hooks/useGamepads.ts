import { useState, useEffect, useRef, useCallback } from 'react';

import { XboxControllerMappings } from '../models/XboxControllerMappings';

import {
  // interfaces
  AxesDetails,
  ButtonDetails,
  ReactGamepad,

  // constants
  konamiCodeSequence,
} from '../constants';

const isBrowser = typeof window !== 'undefined';

interface UseGamepadsProps {
  deadZone?: number;
  stickThreshold?: number;

  onConnect?:(gamepad: ReactGamepad) => void;
  onDisconnect?:(gamepad: ReactGamepad) => void;
  onUpdate?:(gamepad: ReactGamepad) => void;

  onGamepadButtonDown?:(button: ButtonDetails) => void;
  onGamepadButtonUp?:(button: ButtonDetails) => void;
  onGamepadButtonChange?:(button: ButtonDetails) => void;

  onGamepadAxesChange?:(axes: AxesDetails) => void;

  onLeftStickRight?:(axes: AxesDetails) => void;
  onLeftStickLeft?:(axes: AxesDetails) => void;
  onLeftStickUp?:(axes: AxesDetails) => void;
  onLeftStickDown?:(axes: AxesDetails) => void;

  onRightStickRight?:(axes: AxesDetails) => void;
  onRightStickLeft?:(axes: AxesDetails) => void;
  onRightStickUp?:(axes: AxesDetails) => void;
  onRightStickDown?:(axes: AxesDetails) => void;

  onKonamiSuccess?:() => void;
}

export const useGamepads = (
  {
    stickThreshold = 0.75,
    deadZone = 0.08,

    onConnect = () => {},
    onDisconnect = () => {},
    onUpdate = () => {},

    onGamepadButtonDown = () => {},
    onGamepadButtonUp = () => {},
    onGamepadButtonChange = () => {},

    onGamepadAxesChange = () => {},

    onLeftStickRight = () => {},
    onLeftStickLeft = () => {},
    onLeftStickUp = () => {},
    onLeftStickDown = () => {},

    onRightStickRight = () => {},
    onRightStickLeft = () => {},
    onRightStickUp = () => {},
    onRightStickDown = () => {},

    onKonamiSuccess = () => {},

  }: UseGamepadsProps = {}
) => {

  const emptyButton = { pressed: false, touched: false, value: 0 };
  const INITIAL_GAMEPAD_STATE = {
    connected: false,
    id: '',
    index: 0,
    mapping: '',
    vibrationActuator: '',
    buttons: {
      A: { ...emptyButton },
      B: { ...emptyButton },
      X: { ...emptyButton },
      Y: { ...emptyButton },
      LB: { ...emptyButton },
      RB: { ...emptyButton },
      LT: { ...emptyButton },
      RT: { ...emptyButton },
      Select: { ...emptyButton },
      Start: { ...emptyButton },
      LS: { ...emptyButton },
      RS: { ...emptyButton },
      DPadUp: { ...emptyButton },
      DPadDown: { ...emptyButton },
      DPadLeft: { ...emptyButton },
      DPadRight: { ...emptyButton },
      Xbox: { ...emptyButton },
    },
    axes: {
      LeftStickX: 0.0,
      LeftStickY: 0.0,
      RightStickX: 0.0,
      RightStickY: 0.0,
      RightTrigger: 0.0,
      LeftTrigger: 0.0,
    },
  };

  const currentGamepadState = useRef<any>(INITIAL_GAMEPAD_STATE);
  const gamepads = useRef<any>();
  const gamepadList = useRef<any>();
  const requestRef = useRef<number>(0);
  const sequence = useRef<string[]>([]);

  const [gp, setGp] = useState();

  const addGamepad = useCallback((gamepad: any) => {
    currentGamepadState.current = {
      ...currentGamepadState.current,
      connected: gamepad.connected,
      id: gamepad.id,
      index: gamepad.index,
      mapping: gamepad.mapping,
      vibrationActuator: gamepad.vibrationActuator,
    };

    gamepads.current = {
      [gamepad.index]: { ...currentGamepadState.current },
    };

    setGp(currentGamepadState.current);

    if (isBrowser) {
      document.dispatchEvent(new CustomEvent('gamepadupdated', { bubbles: true, cancelable: false, detail: { gamepad: currentGamepadState.current } }));
    }
  }, []);

  // Check the sequence synchronously after each button-up — refs don't trigger
  // re-renders so a useEffect dependency on sequence.current would never fire.
  const updateSequence = useCallback((buttonDetails: ButtonDetails) => {
    const { buttonName } = buttonDetails;
    const next = [...sequence.current, buttonName];

    for (let i = 0; i < next.length; i++) {
      if (next[i] !== konamiCodeSequence[i]) {
        // Sequence broken. If this button starts a new attempt, keep it.
        sequence.current = buttonName === konamiCodeSequence[0] ? [buttonName] : [];
        return;
      }
    }

    sequence.current = next;

    if (next.length === konamiCodeSequence.length) {
      onKonamiSuccess();
      sequence.current = [];
    }
  }, [onKonamiSuccess]);

  const updateButton = useCallback((buttonIndex: number, buttonName: string, button: GamepadButton) => {
    if (currentGamepadState.current.buttons[buttonName] === undefined) return;

    const { pressed, touched, value } = button;

    if (currentGamepadState.current.buttons[buttonName].pressed !== pressed) {
      const buttonDetails: ButtonDetails = {
        buttonIndex,
        buttonName,
        pressed,
        touched,
        value: String(value),
      };

      if (isBrowser) {
        document.dispatchEvent(new CustomEvent('gamepadbuttonchange', { bubbles: true, cancelable: false, detail: { gamepad: currentGamepadState.current.index, buttonDetails } }));
      }
      onGamepadButtonChange(buttonDetails);

      if (pressed && !currentGamepadState.current.buttons[buttonName].pressed) {
        if (isBrowser) {
          document.dispatchEvent(new CustomEvent('gamepadbuttondown', { bubbles: true, cancelable: false, detail: { gamepad: currentGamepadState.current.index, buttonDetails } }));
        }
        onGamepadButtonDown(buttonDetails);
      } else if (!pressed && currentGamepadState.current.buttons[buttonName].pressed) {
        if (isBrowser) {
          document.dispatchEvent(new CustomEvent('gamepadbuttonup', { bubbles: true, cancelable: false, detail: { gamepad: currentGamepadState.current.index, buttonDetails } }));
        }
        updateSequence(buttonDetails);
        onGamepadButtonUp(buttonDetails);
      }
    }

    currentGamepadState.current = {
      ...currentGamepadState.current,
      buttons: {
        ...currentGamepadState.current.buttons,
        [buttonName]: button,
      },
    };
  }, [onGamepadButtonChange, onGamepadButtonDown, onGamepadButtonUp, updateSequence]);

  const updateAxes = useCallback((axesIndex: number, axesName: string, value: number) => {
    if (!axesName || value === undefined || value === null || isNaN(value)) return;

    const invert = axesName[0] === '-';
    let newValue = value * (invert ? -1 : 1);

    if (Math.abs(newValue) < deadZone) {
      newValue = 0;
    }

    if (invert) axesName = axesName.substr(1);

    if (currentGamepadState.current.axes[axesName] !== newValue) {
      const previousValue = currentGamepadState.current.axes[axesName];

      const axesDetails: AxesDetails = {
        axesIndex,
        axesName,
        value: newValue,
        previousValue,
      };

      if (isBrowser) {
        document.dispatchEvent(new CustomEvent('axeschange', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } }));
      }
      onGamepadAxesChange(axesDetails);

      if (axesName === 'LeftStickX') {
        if (previousValue <= stickThreshold && newValue > stickThreshold) {
          if (isBrowser) document.dispatchEvent(new CustomEvent('leftStickXRight', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } }));
          onLeftStickRight(axesDetails);
        }
        if (previousValue >= -stickThreshold && newValue < -stickThreshold) {
          if (isBrowser) document.dispatchEvent(new CustomEvent('leftStickXLeft', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } }));
          onLeftStickLeft(axesDetails);
        }
      }

      if (axesName === 'LeftStickY') {
        if (previousValue <= stickThreshold && newValue > stickThreshold) {
          if (isBrowser) document.dispatchEvent(new CustomEvent('leftStickYUp', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } }));
          onLeftStickUp(axesDetails);
        }
        if (previousValue >= -stickThreshold && newValue < -stickThreshold) {
          if (isBrowser) document.dispatchEvent(new CustomEvent('leftStickYDown', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } }));
          onLeftStickDown(axesDetails);
        }
      }

      if (axesName === 'RightStickX') {
        if (previousValue <= stickThreshold && newValue > stickThreshold) {
          if (isBrowser) document.dispatchEvent(new CustomEvent('rightStickXRight', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } }));
          onRightStickRight(axesDetails);
        }
        if (previousValue >= -stickThreshold && newValue < -stickThreshold) {
          if (isBrowser) document.dispatchEvent(new CustomEvent('rightStickXLeft', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } }));
          onRightStickLeft(axesDetails);
        }
      }

      if (axesName === 'RightStickY') {
        if (previousValue <= stickThreshold && newValue > stickThreshold) {
          if (isBrowser) document.dispatchEvent(new CustomEvent('rightStickYUp', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } }));
          onRightStickUp(axesDetails);
        }
        if (previousValue >= -stickThreshold && newValue < -stickThreshold) {
          if (isBrowser) document.dispatchEvent(new CustomEvent('rightStickYDown', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } }));
          onRightStickDown(axesDetails);
        }
      }
    }

    currentGamepadState.current = {
      ...currentGamepadState.current,
      axes: {
        ...currentGamepadState.current.axes,
        [axesName]: newValue,
      },
    };
  }, [deadZone, stickThreshold, onGamepadAxesChange, onLeftStickRight, onLeftStickLeft, onLeftStickUp, onLeftStickDown, onRightStickRight, onRightStickLeft, onRightStickUp, onRightStickDown]);

  const updateAllButtons = useCallback((gamepad: Gamepad) => {
    const { buttons } = gamepad;
    for (let i = 0; i < buttons.length; i++) {
      const buttonName = XboxControllerMappings.buttonIndexToName(i);
      updateButton(i, buttonName, buttons[i]);
    }
  }, [updateButton]);

  const updateAllAxes = useCallback((gamepad: Gamepad) => {
    const { axes } = gamepad;
    for (let i = 0; i < axes.length; i++) {
      const axesName = XboxControllerMappings.axesIndexToName(i);
      updateAxes(i, axesName, axes[i]);
    }
  }, [updateAxes]);

  const updateGamepad = useCallback((gamepad: Gamepad) => {
    updateAllButtons(gamepad);
    updateAllAxes(gamepad);
    addGamepad(gamepad);
    onUpdate(gamepads.current);
  }, [updateAllButtons, updateAllAxes, addGamepad, onUpdate]);

  const scanGamepads = () => {
    const detectedGamepads: (Gamepad | null)[] = isBrowser && navigator.getGamepads ? navigator.getGamepads() : [];

    for (const [key, gamepad] of Object.entries(detectedGamepads)) {
      if (!gamepadList.current && gamepad) {
        onConnect(gamepad);
      }

      if (gamepadList.current) {
        if (gamepadList.current[key] === null && gamepad !== null) {
          onConnect(gamepad);
        }
        if (gamepadList.current[key] !== null && !gamepad) {
          onDisconnect(gamepadList.current[key]);
        }
      }
    }

    gamepadList.current = detectedGamepads;
    return detectedGamepads;
  };

  const updateGamepads = useCallback(() => {
    const detectedGamepads = scanGamepads();

    for (let i = 0; i < detectedGamepads.length; i++) {
      const gamepad = detectedGamepads[i];
      if (gamepad) updateGamepad(gamepad);
    }
  }, [updateGamepad]);

  const connectGamepadHandler = useCallback((e: GamepadEvent) => {
    onConnect(e.gamepad);
    updateGamepad(e.gamepad);
  }, [updateGamepad, onConnect]);

  const disconnectGamepadHandler = useCallback((e: GamepadEvent) => {
    const gamepad = e.gamepad;
    currentGamepadState.current = { ...INITIAL_GAMEPAD_STATE };
    if (gamepad) delete gamepads.current[gamepad.index];
    onDisconnect(gamepad);
  }, [onDisconnect]);

  useEffect(() => {
    if (!isBrowser) return;
    window.addEventListener('gamepadconnected', connectGamepadHandler);
    return () => window.removeEventListener('gamepadconnected', connectGamepadHandler);
  }, [connectGamepadHandler]);

  useEffect(() => {
    if (!isBrowser) return;
    window.addEventListener('gamepaddisconnected', disconnectGamepadHandler);
    return () => window.removeEventListener('gamepaddisconnected', disconnectGamepadHandler);
  }, [disconnectGamepadHandler]);

  const onAnimationFrameUpdate = useCallback(() => {
    const haveEvents = isBrowser && 'ongamepadconnected' in window;
    if (!haveEvents) updateGamepads();
    requestRef.current = requestAnimationFrame(onAnimationFrameUpdate);
  }, [updateGamepads]);

  useEffect(() => {
    if (!isBrowser) return;
    requestRef.current = requestAnimationFrame(onAnimationFrameUpdate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [onAnimationFrameUpdate]);

  return gp;
};
