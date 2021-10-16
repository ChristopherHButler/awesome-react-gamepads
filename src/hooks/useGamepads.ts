import { useState, useEffect, useRef, useCallback } from 'react';

import { Xbox } from '../models/xbox';

interface ButtonDetails {
  buttonIndex: number;
  buttonName: string;
  pressed: boolean;
  touched: boolean;
  value: string;
}

interface AxesDetails {
  axesIndex: number;
  axesName: string;
  value: number;
  previousValue: number;
}

interface UseGamepadsProps {
  onUpdate?:(gamepad: any) => void;
  onConnect?:(gamepad: any) => void;
  onDisconnect?:(gamepad: any) => void;
  onGamepadButtonDown?:(button: ButtonDetails) => void;
  onGamepadButtonUp?:(button: ButtonDetails) => void;
  onGamepadButtonChange?:(button: ButtonDetails) => void;
  onGamepadAxesChange?:(axes: AxesDetails) => void;
  onKonamiSuccess?:() => void;
}

const useGamepads = ({
  onUpdate = () => {},
  onConnect = () => {},
  onDisconnect = () => {},
  onGamepadButtonDown = () => {},
  onGamepadButtonUp = () => {},
  onGamepadButtonChange = () => {},
  onGamepadAxesChange = () => {},
  onKonamiSuccess = () => {},
}: UseGamepadsProps = {}) => {

  const stickThreshold = 0.5;
  const deadZone = 0.08;

  const konamiCodeSequence = ['DPadUp', 'DPadUp', 'DPadDown', 'DPadDown', 'DPadLeft', 'DPadRight', 'DPadLeft', 'DPadRight', 'B', 'A'];

  const INITIAL_GAMEPAD_STATE = {
    connected: false,
    id: '',
    index: 0,
    mapping: '',
    vibrationActuator: '',
    buttons: {
      A: false,         // gamepad.buttons[0].pressed
      B: false,         // gamepad.buttons[1].pressed
      X: false,         // gamepad.buttons[2].pressed
      Y: false,         // gamepad.buttons[3].pressed
      LB: false,        // gamepad.buttons[4].pressed
      RB: false,        // gamepad.buttons[5].pressed
      LT: false,        // gamepad.buttons[6].pressed
      RT: false,        // gamepad.buttons[7].pressed
      Select: false,    // gamepad.buttons[8].pressed
      Start: false,     // gamepad.buttons[9].pressed
      LS: false,        // gamepad.buttons[10].pressed (Left Stick Pressed)
      RS: false,        // gamepad.buttons[11].pressed (Right Stick Pressed)
      DPadUp: false,    // gamepad.buttons[12].pressed
      DPadDown: false,  // gamepad.buttons[13].pressed
      DPadLeft: false,  // gamepad.buttons[14].pressed
      DPadRight: false, // gamepad.buttons[15].pressed
      Xbox: false,      // gamepad.buttons[16].pressed
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
  const gamepads = useRef<any>(); // { 0: { ...INITIAL_GAMEPAD_STATE } }
  const requestRef = useRef<number>(0);
  const sequence = useRef<string[]>([]);

  const [gp, setGp] = useState();
  const [gps, setGps] = useState();

  const haveEvents = "ongamepadconnected" in window;

  const addGamepad = useCallback((gamepad: any) => {

    currentGamepadState.current = {
      ...currentGamepadState.current,
      connected: gamepad.connected,
      id: gamepad.id,
      index: gamepad.index,
      mapping: gamepad.mapping,
      vibrationActuator: gamepad.vibrationActuator,
      // buttons: gamepad.buttons,
      // axes: gamepad.axes,
    };

    gamepads.current = {
      //...gamepads.current,
      [gamepad.index]: { ...currentGamepadState.current },
    };

    setGp(currentGamepadState.current);
    setGps(gamepads.current);

    // fire callback
    onConnect(currentGamepadState.current);
  }, []);

  const updateSequence = (buttonDetails: ButtonDetails) => {
    const { buttonName } = buttonDetails;
    sequence.current = [...sequence.current, buttonName];
  };

  useEffect(() => {
    if (sequence.current) {
      sequence.current.forEach((code, index) => {
        if (code !== konamiCodeSequence[index]) {
          sequence.current = [];
        }

        if (sequence.current.toString() == konamiCodeSequence.toString()) {
          onKonamiSuccess();
          sequence.current = [];
        }
      });
    }
  }, [sequence.current]);

  const updateButton = useCallback((buttonIndex, buttonName, button) => {
    if (currentGamepadState.current.buttons[buttonName] === undefined) return;

    const { pressed, touched, value } = button;

    // check for state change
    if (currentGamepadState.current.buttons[buttonName].pressed !== pressed) {
      // there was a state change on this button
      const buttonDetails = {
        buttonIndex,
        buttonName,
        pressed,
        touched,
        value,
      };

      // fire callback
      onGamepadButtonChange(buttonDetails);

      // if the old state is not pressed and the current state is pressed,
      // then fire a button down event
      if (pressed && !currentGamepadState.current.buttons[buttonName].pressed) {
        // console.log('dispatching button down');
        document.dispatchEvent(new CustomEvent("gamepadbuttondown", { bubbles: true, cancelable: false, detail: { gamepad: currentGamepadState.current.index, button: buttonIndex } }));
        // fire gamepadbuttondown callback
        onGamepadButtonDown(buttonDetails);
      }
      // button up event
      else if (!pressed && currentGamepadState.current.buttons[buttonName].pressed) {
        // console.log('dispatching button up');
        document.dispatchEvent(new CustomEvent("gamepadbuttonup", { bubbles: true, cancelable: false, detail: { gamepad: currentGamepadState.current.index, button: buttonIndex } }));
        // fire gamepadbuttonup callbacks
        updateSequence(buttonDetails);
        onGamepadButtonUp(buttonDetails);
        
      }
    }

    // update the button
    currentGamepadState.current = {
      ...currentGamepadState.current,
      buttons: {
        ...currentGamepadState.current.buttons,
        [buttonName]: button,
      },
    };
    // console.log(`button: ${buttonName}`, button);
    // console.log('currentGamepadState:', currentGamepadState.current);
  }, []);

  const updateAxes = useCallback((axesIndex, axesName, value) => {
    if (axesName && value !== undefined && value !== null && value !== NaN) {
      const invert = axesName[0] === '-';
      let newValue = value * (invert ? -1 : 1);

      if (Math.abs(newValue) < deadZone) {
        newValue = 0;
      }

      if (invert) axesName = axesName.substr(1);

      // check for state change
      if (currentGamepadState.current.axes[axesName] !== newValue) {
        // there was a state change

        const previousValue = currentGamepadState.current.axes[axesName];

        const axesDetails = {
          axesIndex,
          axesName,
          value: newValue,
          previousValue,
        };
        // fire onAxesChange callback here
        onGamepadAxesChange(axesDetails);

        // fire custom Events
        if (axesName === 'LeftStickX') {
          if (previousValue <= stickThreshold && newValue > stickThreshold) {
            document.dispatchEvent(new CustomEvent("leftStickXRight", { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: newValue } }));
            // fire callback
          }
          if (previousValue >= -stickThreshold && newValue < stickThreshold) {
            document.dispatchEvent(new CustomEvent("leftStickXLeft", { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: newValue } }));
            // fire callback
          }
        }

        if (axesName === 'LeftStickY') {
          if (previousValue <= stickThreshold && newValue > stickThreshold) {
            document.dispatchEvent(new CustomEvent("leftStickYUp", { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: newValue } }));
            // fire callback
          }
          if (previousValue >= -stickThreshold && newValue < stickThreshold) {
            document.dispatchEvent(new CustomEvent("leftStickYDown", { bubbles: true, detail: { gamepad: currentGamepadState.current.index, axes: newValue } }));
            // fire callback
          }
        }
      
      }

      // update the state
      currentGamepadState.current = {
        ...currentGamepadState.current,
        axes: {
          ...currentGamepadState.current.axes,
          [axesName]: newValue,
        },
      };
    }
  }, []);

  const updateAllButtons = useCallback((gamepad: Gamepad) => {
    const { buttons } = gamepad;
    for (let i = 0; i < buttons.length; i++) {
      const buttonName = Xbox.buttonIndexToName(i);
      updateButton(i, buttonName, buttons[i]);
    }
  }, [updateButton]);

  const updateAllAxes = useCallback((gamepad: Gamepad) => {
    const { axes } = gamepad;
    for (let i = 0; i < axes.length; i++) {
      const value = axes[i];
      const axesName = Xbox.axesIndexToName(i);
      updateAxes(i, axesName, axes[i]);
    }
  }, [updateAxes]);

  const updateGamepad = useCallback((gamepad: Gamepad) => {

    // console.log('gamepad connected: ', gamepad);

    updateAllButtons(gamepad);
    updateAllAxes(gamepad);

    // then we want to update the gamepads state with the current gamepad state
    addGamepad(gamepad);

    // fire callback
    onUpdate(gamepads.current);
  }, [updateAllButtons, updateAllAxes, addGamepad, onUpdate]);

  const scanGamepads = () => {
    // Grab gamepads from browser API
    const detectedGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    return detectedGamepads;
  };

  // on each animation tick (1/60s)...
  const updateGamepads = useCallback(() => {
    // scan for gamepads.
    const detectedGamepads = scanGamepads();

    // Loop through all detected controllers and add if not already in state
    for (let i = 0; i < detectedGamepads.length; i++) {
      const gamepad = detectedGamepads[i];

      if (gamepad) {
        updateGamepad(gamepad);
      }
    }
  }, [updateGamepad]);

  // Update each gamepad's status on each "tick"
  const onAnimationFrameUpdate = useCallback(() => {
    if (!haveEvents) updateGamepads();
    requestRef.current = requestAnimationFrame(onAnimationFrameUpdate);
  }, [haveEvents, updateGamepads]);

  // update gamepad when connected
  const connectGamepadHandler = useCallback((e: GamepadEvent) => {
    // console.log('new gamepad connected: ', e.gamepad);
    updateGamepad(e.gamepad);
  }, [updateGamepad]);

  // Add event listener for gamepad connecting
  useEffect(() => {
    window.addEventListener("gamepadconnected", connectGamepadHandler);
    return window.removeEventListener("gamepadconnected", connectGamepadHandler);
  }, [connectGamepadHandler]);

  // use requestAnimationFrame for updating
  // this will refresh 60 times / s
  useEffect(() => {
    if (window) requestRef.current = requestAnimationFrame(onAnimationFrameUpdate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [onAnimationFrameUpdate]);

  return gp;
};

export default useGamepads;