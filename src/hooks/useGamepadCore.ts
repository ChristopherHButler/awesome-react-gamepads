import { useState, useEffect, useRef, useCallback, useDebugValue } from 'react';

import { ControllerProfile, ControllerProfiles, getButtonLabels, translateSequence } from '../models/ControllerProfiles';
import { SequenceMatcher } from '../utils/SequenceMatcher';

import {
  AxesDetails,
  ButtonDetails,
  ReactGamepad,
  RumbleOptions,
  konamiCodeSequence,
} from '../constants';

export type { ControllerProfile };

const isBrowser = typeof window !== 'undefined';

const DEAD_ZONE_PRESETS = {
  none: 0,
  small: 0.05,
  medium: 0.08,
  large: 0.15,
};

type DeadZonePreset = keyof typeof DEAD_ZONE_PRESETS;

export interface UseGamepadsProps {
  deadZone?: number | DeadZonePreset;
  stickThreshold?: number;
  holdThreshold?: number;
  pollRate?: number;
  controllerProfile?: ControllerProfile;

  onConnect?: (gamepad: ReactGamepad) => void;
  onDisconnect?: (gamepad: ReactGamepad) => void;
  onUpdate?: (gamepad: ReactGamepad) => void;

  onGamepadButtonDown?: (button: ButtonDetails) => void;
  onGamepadButtonUp?: (button: ButtonDetails) => void;
  onGamepadButtonChange?: (button: ButtonDetails) => void;
  onGamepadButtonHold?: (button: ButtonDetails) => void;

  // Per-button callbacks — always refer to the same physical button position
  // regardless of active profile. Use `buttonLabels` from the return value
  // to display the profile-specific name in your UI.
  onA?: (button: ButtonDetails) => void;
  onB?: (button: ButtonDetails) => void;
  onX?: (button: ButtonDetails) => void;
  onY?: (button: ButtonDetails) => void;
  onLB?: (button: ButtonDetails) => void;
  onRB?: (button: ButtonDetails) => void;
  onLT?: (button: ButtonDetails) => void;
  onRT?: (button: ButtonDetails) => void;
  onSelect?: (button: ButtonDetails) => void;
  onStart?: (button: ButtonDetails) => void;
  onLS?: (button: ButtonDetails) => void;
  onRS?: (button: ButtonDetails) => void;
  onDPadUp?: (button: ButtonDetails) => void;
  onDPadDown?: (button: ButtonDetails) => void;
  onDPadLeft?: (button: ButtonDetails) => void;
  onDPadRight?: (button: ButtonDetails) => void;
  onXBoxLogo?: (button: ButtonDetails) => void;

  onGamepadAxesChange?: (axes: AxesDetails) => void;

  onLeftStickRight?: (axes: AxesDetails) => void;
  onLeftStickLeft?: (axes: AxesDetails) => void;
  onLeftStickUp?: (axes: AxesDetails) => void;
  onLeftStickDown?: (axes: AxesDetails) => void;

  onRightStickRight?: (axes: AxesDetails) => void;
  onRightStickLeft?: (axes: AxesDetails) => void;
  onRightStickUp?: (axes: AxesDetails) => void;
  onRightStickDown?: (axes: AxesDetails) => void;

  onKonamiSuccess?: () => void;
}

export interface UseGamepadsReturn {
  gamepad: ReactGamepad | undefined;
  rumble: (options: RumbleOptions) => Promise<void>;
  profile: ControllerProfile;
  /** Maps Xbox button names to the active profile's display names.
   *  e.g. with `controllerProfile: "playstation"`, `buttonLabels.A === "Cross"`. */
  buttonLabels: Record<string, string>;
}

const NOOP = () => {};

function buildInitialButtonState(profile: ControllerProfile): Record<string, { pressed: boolean; touched: boolean; value: number }> {
  const emptyButton = { pressed: false, touched: false, value: 0 };
  const result: Record<string, typeof emptyButton> = {};
  for (const name of ControllerProfiles[profile].buttons) {
    if (name) result[name] = { ...emptyButton };
  }
  return result;
}

/**
 * Shared core hook. Both `useGamepads` and `useGamepad` are thin wrappers
 * over this — they differ only in which gamepad indices get processed.
 *
 * @param props       Standard hook options
 * @param indexFilter When provided, only the gamepad at this index is tracked.
 *                    When undefined, all connected gamepads are tracked.
 */
export function useGamepadCore(
  props: UseGamepadsProps = {},
  indexFilter?: number,
): UseGamepadsReturn {
  const {
    deadZone: deadZoneOption = 'medium',
    stickThreshold = 0.75,
    holdThreshold = 500,
    pollRate,
    controllerProfile = 'xbox',

    onConnect = NOOP,
    onDisconnect = NOOP,
    onUpdate = NOOP,

    onGamepadButtonDown = NOOP,
    onGamepadButtonUp = NOOP,
    onGamepadButtonChange = NOOP,
    onGamepadButtonHold = NOOP,

    onA = NOOP, onB = NOOP, onX = NOOP, onY = NOOP,
    onLB = NOOP, onRB = NOOP, onLT = NOOP, onRT = NOOP,
    onSelect = NOOP, onStart = NOOP, onLS = NOOP, onRS = NOOP,
    onDPadUp = NOOP, onDPadDown = NOOP, onDPadLeft = NOOP, onDPadRight = NOOP,
    onXBoxLogo = NOOP,

    onGamepadAxesChange = NOOP,
    onLeftStickRight = NOOP, onLeftStickLeft = NOOP,
    onLeftStickUp = NOOP, onLeftStickDown = NOOP,
    onRightStickRight = NOOP, onRightStickLeft = NOOP,
    onRightStickUp = NOOP, onRightStickDown = NOOP,

    onKonamiSuccess = NOOP,
  } = props;

  const deadZone = typeof deadZoneOption === 'string'
    ? DEAD_ZONE_PRESETS[deadZoneOption]
    : deadZoneOption;

  const profileDef = ControllerProfiles[controllerProfile];

  const INITIAL_GAMEPAD_STATE = {
    connected: false,
    id: '',
    index: indexFilter ?? 0,
    mapping: '',
    vibrationActuator: '',
    buttons: buildInitialButtonState(controllerProfile),
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
  const rawGamepadRef = useRef<any>(null);
  const gamepads = useRef<any>({});
  const gamepadList = useRef<any>(null);
  const requestRef = useRef<number>(0);
  const pressedAt = useRef<Record<string, number>>({});
  const holdFired = useRef<Record<string, boolean>>({});

  // onKonamiSuccess is a convenience wrapper over SequenceMatcher
  const konamiCallbackRef = useRef(onKonamiSuccess);
  useEffect(() => { konamiCallbackRef.current = onKonamiSuccess; }, [onKonamiSuccess]);

  const konamiMatcher = useRef<SequenceMatcher>(
    new SequenceMatcher(translateSequence(konamiCodeSequence, 'xbox', controllerProfile)),
  );
  useEffect(() => {
    konamiMatcher.current.setSequence(translateSequence(konamiCodeSequence, 'xbox', controllerProfile));
  }, [controllerProfile]);

  const [gp, setGp] = useState<ReactGamepad | undefined>(undefined);

  const debugLabel = indexFilter !== undefined
    ? (g: ReactGamepad | undefined) => g ? `Gamepad[${indexFilter}]: ${g.id}` : `No gamepad at index ${indexFilter}`
    : (g: ReactGamepad | undefined) => g ? `Gamepad: ${g.id} (index ${g.index})` : 'No gamepad';
  useDebugValue(gp, debugLabel);

  // Per-button callbacks: indexed by the PROFILE's button name at each position.
  // onA always refers to button index 0 (physical bottom face), etc.
  const xboxCallbacksByIndex = [
    onA, onB, onX, onY,
    onLB, onRB, onLT, onRT,
    onSelect, onStart, onLS, onRS,
    onDPadUp, onDPadDown, onDPadLeft, onDPadRight,
    onXBoxLogo,
  ];

  const perButtonCallbacks = useRef<Record<string, (b: ButtonDetails) => void>>({});
  useEffect(() => {
    const map: Record<string, (b: ButtonDetails) => void> = {};
    for (let i = 0; i < xboxCallbacksByIndex.length; i++) {
      const profileName = profileDef.buttons[i];
      if (profileName) map[profileName] = xboxCallbacksByIndex[i];
    }
    perButtonCallbacks.current = map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerProfile, onA, onB, onX, onY, onLB, onRB, onLT, onRT, onSelect, onStart, onLS, onRS, onDPadUp, onDPadDown, onDPadLeft, onDPadRight, onXBoxLogo]);

  const addGamepad = useCallback((gamepad: any) => {
    currentGamepadState.current = {
      ...currentGamepadState.current,
      connected: gamepad.connected,
      id: gamepad.id,
      index: gamepad.index,
      mapping: gamepad.mapping,
      vibrationActuator: gamepad.vibrationActuator,
    };

    gamepads.current[gamepad.index] = { ...currentGamepadState.current };
    setGp(currentGamepadState.current);

    if (isBrowser) {
      document.dispatchEvent(new CustomEvent('gamepadupdated', { bubbles: true, cancelable: false, detail: { gamepad: currentGamepadState.current } }));
    }
  }, []);

  const checkKonami = useCallback((buttonName: string) => {
    if (konamiMatcher.current.onButtonUp(buttonName)) {
      konamiCallbackRef.current();
    }
  }, []);

  const updateButton = useCallback((buttonIndex: number, button: GamepadButton) => {
    const buttonName = profileDef.buttons[buttonIndex];
    if (!buttonName || currentGamepadState.current.buttons[buttonName] === undefined) return;

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
        checkKonami(buttonName);
        onGamepadButtonUp(buttonDetails);
        delete pressedAt.current[buttonName];
        delete holdFired.current[buttonName];
      }
    }

    // Hold detection
    if (pressed && pressedAt.current[buttonName] !== undefined && !holdFired.current[buttonName]) {
      if (Date.now() - pressedAt.current[buttonName] >= holdThreshold) {
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
  }, [holdThreshold, profileDef, onGamepadButtonChange, onGamepadButtonDown, onGamepadButtonUp, onGamepadButtonHold, checkKonami]);

  const updateAxes = useCallback((axesIndex: number, value: number) => {
    const rawName = profileDef.axes[axesIndex];
    if (!rawName || value === undefined || value === null || isNaN(value)) return;

    const invert = rawName[0] === '-';
    let newValue = value * (invert ? -1 : 1);
    if (Math.abs(newValue) < deadZone) newValue = 0;
    const axesName = invert ? rawName.substr(1) : rawName;

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

      currentGamepadState.current = {
        ...currentGamepadState.current,
        axes: { ...currentGamepadState.current.axes, [axesName]: newValue },
      };
    }
  }, [deadZone, stickThreshold, profileDef, onGamepadAxesChange, onLeftStickRight, onLeftStickLeft, onLeftStickUp, onLeftStickDown, onRightStickRight, onRightStickLeft, onRightStickUp, onRightStickDown]);

  const updateGamepad = useCallback((gamepad: Gamepad) => {
    rawGamepadRef.current = gamepad;
    const { buttons, axes } = gamepad;
    for (let i = 0; i < buttons.length; i++) {
      updateButton(i, buttons[i]);
    }
    for (let i = 0; i < axes.length; i++) {
      updateAxes(i, axes[i]);
    }
    addGamepad(gamepad);
    onUpdate(currentGamepadState.current);
  }, [updateButton, updateAxes, addGamepad, onUpdate]);

  const scanGamepads = useCallback(() => {
    const all: (Gamepad | null)[] = isBrowser && navigator.getGamepads ? navigator.getGamepads() : [];

    // If indexFilter is set, only process that one slot
    const slots = indexFilter !== undefined ? [all[indexFilter] ?? null] : all;
    const fullList = indexFilter !== undefined ? { [indexFilter]: all[indexFilter] ?? null } : all;

    // Connect / disconnect detection
    for (const [key, gamepad] of Object.entries(fullList)) {
      if (!gamepadList.current && gamepad) {
        onConnect(gamepad);
      }
      if (gamepadList.current) {
        if (gamepadList.current[key] == null && gamepad != null) onConnect(gamepad);
        if (gamepadList.current[key] != null && gamepad == null) onDisconnect(gamepadList.current[key]);
      }
    }

    gamepadList.current = fullList;
    return slots;
  }, [indexFilter, onConnect, onDisconnect]);

  const updateGamepads = useCallback(() => {
    const slots = scanGamepads();
    for (const gamepad of slots) {
      if (gamepad) updateGamepad(gamepad);
    }
  }, [scanGamepads, updateGamepad]);

  const connectGamepadHandler = useCallback((e: GamepadEvent) => {
    if (indexFilter !== undefined && e.gamepad.index !== indexFilter) return;
    onConnect(e.gamepad);
    updateGamepad(e.gamepad);
  }, [indexFilter, updateGamepad, onConnect]);

  const disconnectGamepadHandler = useCallback((e: GamepadEvent) => {
    if (indexFilter !== undefined && e.gamepad.index !== indexFilter) return;
    currentGamepadState.current = { ...INITIAL_GAMEPAD_STATE };
    rawGamepadRef.current = null;
    delete gamepads.current[e.gamepad.index];
    onDisconnect(e.gamepad);
  }, [indexFilter, onDisconnect]);

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
    if (!('ongamepadconnected' in window)) updateGamepads();
    requestRef.current = requestAnimationFrame(onAnimationFrameUpdate);
  }, [updateGamepads]);

  useEffect(() => {
    if (!isBrowser) return;
    if (pollRate !== undefined && pollRate > 0) {
      const id = setInterval(updateGamepads, pollRate);
      return () => clearInterval(id);
    }
    requestRef.current = requestAnimationFrame(onAnimationFrameUpdate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [onAnimationFrameUpdate, updateGamepads, pollRate]);

  const rumble = useCallback(async (options: RumbleOptions): Promise<void> => {
    const raw = rawGamepadRef.current;
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

  return {
    gamepad: gp,
    rumble,
    profile: controllerProfile,
    buttonLabels: getButtonLabels(controllerProfile),
  };
}
