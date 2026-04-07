import { useState, useEffect, useRef, useCallback, useDebugValue } from 'react';

import { XboxControllerMappings } from '../models/XboxControllerMappings';

import {
  AxesDetails,
  ButtonDetails,
  ReactGamepad,
  RumbleOptions,
  konamiCodeSequence,
} from '../constants';

import { UseGamepadsProps, UseGamepadsReturn } from './useGamepads';

const isBrowser = typeof window !== 'undefined';

const DEAD_ZONE_PRESETS = {
  none: 0,
  small: 0.05,
  medium: 0.08,
  large: 0.15,
};

const NOOP = () => {};

/**
 * useGamepad — tracks a single gamepad by index. Useful for local multiplayer
 * where each player has their own hook instance:
 *
 * ```tsx
 * const { gamepad: p1 } = useGamepad(0, { onA: () => jump() });
 * const { gamepad: p2 } = useGamepad(1, { onA: () => jump() });
 * ```
 */
export const useGamepad = (
  index: number,
  {
    deadZone: deadZoneOption = 'medium',
    stickThreshold = 0.75,
    holdThreshold = 500,
    pollRate,

    onConnect = NOOP,
    onDisconnect = NOOP,
    onUpdate = NOOP,

    onGamepadButtonDown = NOOP,
    onGamepadButtonUp = NOOP,
    onGamepadButtonChange = NOOP,
    onGamepadButtonHold = NOOP,

    onA = NOOP,
    onB = NOOP,
    onX = NOOP,
    onY = NOOP,
    onLB = NOOP,
    onRB = NOOP,
    onLT = NOOP,
    onRT = NOOP,
    onSelect = NOOP,
    onStart = NOOP,
    onLS = NOOP,
    onRS = NOOP,
    onDPadUp = NOOP,
    onDPadDown = NOOP,
    onDPadLeft = NOOP,
    onDPadRight = NOOP,
    onXBoxLogo = NOOP,

    onGamepadAxesChange = NOOP,

    onLeftStickRight = NOOP,
    onLeftStickLeft = NOOP,
    onLeftStickUp = NOOP,
    onLeftStickDown = NOOP,

    onRightStickRight = NOOP,
    onRightStickLeft = NOOP,
    onRightStickUp = NOOP,
    onRightStickDown = NOOP,

    onKonamiSuccess = NOOP,
  }: UseGamepadsProps = {}
): UseGamepadsReturn => {

  const deadZone = typeof deadZoneOption === 'string'
    ? DEAD_ZONE_PRESETS[deadZoneOption]
    : deadZoneOption;

  const emptyButton = { pressed: false, touched: false, value: 0 };
  const INITIAL_GAMEPAD_STATE = {
    connected: false,
    id: '',
    index,
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
  const rawGamepadRef = useRef<Gamepad | null>(null);
  const requestRef = useRef<number>(0);
  const sequence = useRef<string[]>([]);
  const pressedAt = useRef<Record<string, number>>({});
  const holdFired = useRef<Record<string, boolean>>({});

  const [gp, setGp] = useState<ReactGamepad | undefined>(undefined);

  useDebugValue(gp, (g) => g ? `Gamepad[${index}]: ${g.id}` : `No gamepad at index ${index}`);

  const perButtonCallbacks = useRef<Record<string, (b: ButtonDetails) => void>>({});
  useEffect(() => {
    perButtonCallbacks.current = {
      A: onA, B: onB, X: onX, Y: onY,
      LB: onLB, RB: onRB, LT: onLT, RT: onRT,
      Select: onSelect, Start: onStart, LS: onLS, RS: onRS,
      DPadUp: onDPadUp, DPadDown: onDPadDown, DPadLeft: onDPadLeft, DPadRight: onDPadRight,
      Xbox: onXBoxLogo,
    };
  }, [onA, onB, onX, onY, onLB, onRB, onLT, onRT, onSelect, onStart, onLS, onRS, onDPadUp, onDPadDown, onDPadLeft, onDPadRight, onXBoxLogo]);

  const addGamepad = useCallback((gamepad: any) => {
    currentGamepadState.current = {
      ...currentGamepadState.current,
      connected: gamepad.connected,
      id: gamepad.id,
      index: gamepad.index,
      mapping: gamepad.mapping,
      vibrationActuator: gamepad.vibrationActuator,
    };
    setGp(currentGamepadState.current);
    if (isBrowser) {
      document.dispatchEvent(new CustomEvent('gamepadupdated', { bubbles: true, cancelable: false, detail: { gamepad: currentGamepadState.current } }));
    }
  }, []);

  const updateSequence = useCallback((buttonDetails: ButtonDetails) => {
    const { buttonName } = buttonDetails;
    const next = [...sequence.current, buttonName];

    for (let i = 0; i < next.length; i++) {
      if (next[i] !== konamiCodeSequence[i]) {
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
    const wasPressed = currentGamepadState.current.buttons[buttonName].pressed;

    if (wasPressed !== pressed) {
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

      if (pressed && !wasPressed) {
        if (isBrowser) {
          document.dispatchEvent(new CustomEvent('gamepadbuttondown', { bubbles: true, cancelable: false, detail: { gamepad: currentGamepadState.current.index, buttonDetails } }));
        }
        onGamepadButtonDown(buttonDetails);
        perButtonCallbacks.current[buttonName]?.(buttonDetails);
        pressedAt.current[buttonName] = Date.now();
        holdFired.current[buttonName] = false;
      } else if (!pressed && wasPressed) {
        if (isBrowser) {
          document.dispatchEvent(new CustomEvent('gamepadbuttonup', { bubbles: true, cancelable: false, detail: { gamepad: currentGamepadState.current.index, buttonDetails } }));
        }
        updateSequence(buttonDetails);
        onGamepadButtonUp(buttonDetails);
        delete pressedAt.current[buttonName];
        delete holdFired.current[buttonName];
      }
    }

    if (pressed && pressedAt.current[buttonName] !== undefined && !holdFired.current[buttonName]) {
      const elapsed = Date.now() - pressedAt.current[buttonName];
      if (elapsed >= holdThreshold) {
        holdFired.current[buttonName] = true;
        onGamepadButtonHold({ buttonIndex, buttonName, pressed, touched, value: String(value) });
      }
    }

    currentGamepadState.current = {
      ...currentGamepadState.current,
      buttons: {
        ...currentGamepadState.current.buttons,
        [buttonName]: button,
      },
    };
  }, [holdThreshold, onGamepadButtonChange, onGamepadButtonDown, onGamepadButtonUp, onGamepadButtonHold, updateSequence]);

  const updateAxes = useCallback((axesIndex: number, axesName: string, value: number) => {
    if (!axesName || value === undefined || value === null || isNaN(value)) return;

    const invert = axesName[0] === '-';
    let newValue = value * (invert ? -1 : 1);
    if (Math.abs(newValue) < deadZone) newValue = 0;
    if (invert) axesName = axesName.substr(1);

    if (currentGamepadState.current.axes[axesName] !== newValue) {
      const previousValue = currentGamepadState.current.axes[axesName];
      const axesDetails: AxesDetails = { axesIndex, axesName, value: newValue, previousValue };

      if (isBrowser) {
        document.dispatchEvent(new CustomEvent('axeschange', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } }));
      }
      onGamepadAxesChange(axesDetails);

      if (axesName === 'LeftStickX') {
        if (previousValue <= stickThreshold && newValue > stickThreshold) { if (isBrowser) document.dispatchEvent(new CustomEvent('leftStickXRight', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } })); onLeftStickRight(axesDetails); }
        if (previousValue >= -stickThreshold && newValue < -stickThreshold) { if (isBrowser) document.dispatchEvent(new CustomEvent('leftStickXLeft', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } })); onLeftStickLeft(axesDetails); }
      }
      if (axesName === 'LeftStickY') {
        if (previousValue <= stickThreshold && newValue > stickThreshold) { if (isBrowser) document.dispatchEvent(new CustomEvent('leftStickYUp', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } })); onLeftStickUp(axesDetails); }
        if (previousValue >= -stickThreshold && newValue < -stickThreshold) { if (isBrowser) document.dispatchEvent(new CustomEvent('leftStickYDown', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } })); onLeftStickDown(axesDetails); }
      }
      if (axesName === 'RightStickX') {
        if (previousValue <= stickThreshold && newValue > stickThreshold) { if (isBrowser) document.dispatchEvent(new CustomEvent('rightStickXRight', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } })); onRightStickRight(axesDetails); }
        if (previousValue >= -stickThreshold && newValue < -stickThreshold) { if (isBrowser) document.dispatchEvent(new CustomEvent('rightStickXLeft', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } })); onRightStickLeft(axesDetails); }
      }
      if (axesName === 'RightStickY') {
        if (previousValue <= stickThreshold && newValue > stickThreshold) { if (isBrowser) document.dispatchEvent(new CustomEvent('rightStickYUp', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } })); onRightStickUp(axesDetails); }
        if (previousValue >= -stickThreshold && newValue < -stickThreshold) { if (isBrowser) document.dispatchEvent(new CustomEvent('rightStickYDown', { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: axesDetails } })); onRightStickDown(axesDetails); }
      }
    }

    currentGamepadState.current = {
      ...currentGamepadState.current,
      axes: { ...currentGamepadState.current.axes, [axesName]: newValue },
    };
  }, [deadZone, stickThreshold, onGamepadAxesChange, onLeftStickRight, onLeftStickLeft, onLeftStickUp, onLeftStickDown, onRightStickRight, onRightStickLeft, onRightStickUp, onRightStickDown]);

  const updateGamepad = useCallback((gamepad: Gamepad) => {
    rawGamepadRef.current = gamepad;
    const { buttons, axes } = gamepad;
    for (let i = 0; i < buttons.length; i++) {
      updateButton(i, XboxControllerMappings.buttonIndexToName(i), buttons[i]);
    }
    for (let i = 0; i < axes.length; i++) {
      updateAxes(i, XboxControllerMappings.axesIndexToName(i), axes[i]);
    }
    addGamepad(gamepad);
    onUpdate(currentGamepadState.current);
  }, [updateButton, updateAxes, addGamepad, onUpdate]);

  const pollGamepad = useCallback(() => {
    if (!isBrowser || !navigator.getGamepads) return;
    const gamepad = navigator.getGamepads()[index];
    if (gamepad) updateGamepad(gamepad);
  }, [index, updateGamepad]);

  const connectGamepadHandler = useCallback((e: GamepadEvent) => {
    if (e.gamepad.index !== index) return;
    onConnect(e.gamepad);
    updateGamepad(e.gamepad);
  }, [index, updateGamepad, onConnect]);

  const disconnectGamepadHandler = useCallback((e: GamepadEvent) => {
    if (e.gamepad.index !== index) return;
    currentGamepadState.current = { ...INITIAL_GAMEPAD_STATE };
    rawGamepadRef.current = null;
    onDisconnect(e.gamepad);
  }, [index, onDisconnect]);

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
    if (!haveEvents) pollGamepad();
    requestRef.current = requestAnimationFrame(onAnimationFrameUpdate);
  }, [pollGamepad]);

  useEffect(() => {
    if (!isBrowser) return;

    if (pollRate !== undefined && pollRate > 0) {
      const id = setInterval(pollGamepad, pollRate);
      return () => clearInterval(id);
    }

    requestRef.current = requestAnimationFrame(onAnimationFrameUpdate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [onAnimationFrameUpdate, pollGamepad, pollRate]);

  const rumble = useCallback(async (options: RumbleOptions): Promise<void> => {
    const raw = rawGamepadRef.current as any;
    if (!raw?.vibrationActuator) return;
    try {
      await raw.vibrationActuator.playEffect('dual-rumble', {
        startDelay: options.startDelay ?? 0,
        duration: options.duration,
        weakMagnitude: options.weakMagnitude ?? 0.5,
        strongMagnitude: options.strongMagnitude ?? 0.5,
      });
    } catch {
      // Haptics not supported on this device/browser
    }
  }, []);

  return { gamepad: gp, rumble };
};
