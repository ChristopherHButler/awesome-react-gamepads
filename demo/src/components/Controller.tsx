import { useState, useEffect } from 'react';
import styled from 'styled-components';

import ControllerDashbaord from './ControllerDashboard';

import useGamepads from '../hooks/useGamepads';

interface ControllerProps {
  activeColor?: string;
  inactiveColor?: string;
  showController?: boolean;
  showControllerDashboard?: boolean;
  showTestVibrate?: boolean;
  onKonamiUnlocked?:() => void,
}

const Controller = ({
  activeColor = "#2F80ED",
  inactiveColor = "#E0E0E0",
  showController = true,
  showControllerDashboard = true,
  showTestVibrate = false,
  onKonamiUnlocked = () => {},
}: ControllerProps) => {
  
  const [gamepad, setGamepad] = useState<any>({});
  const [gamepads, setGamepads] = useState<any>(null);

  const [konamiUnlocked, setKonamiUnlocked] = useState(false);


  useGamepads({
    // onConnect: (gamepad) => console.log('Gamepad Connected: ', gamepad),
    onUpdate: (gp) => setGamepads(gp),
    onGamepadButtonUp: (button) => onGamepadButtonUp(button),
    onKonamiSuccess: () => onKonamiSuccess(),
  });

// ---------------------------- Test Code

  const onGamepadConnected = (e: Event) => {
    // console.log('Event - onGamepadConnected: ', e);
  };

  useEffect(() => {
    window.addEventListener('gamepadconnected', onGamepadConnected);

    // cleanup this component
    return () => window.removeEventListener('gamepadconnected', onGamepadConnected);
  }, []);

  const onEvtGamepadButtonDown = (e: Event) => {
    // console.log('Event - onGamepadButtonDown: ', e);
  };

  useEffect(() => {
    window.addEventListener('gamepadbuttondown', onEvtGamepadButtonDown);

    // cleanup this component
    return () => window.removeEventListener('gamepadbuttondown', onEvtGamepadButtonDown);
  }, []);

  const onEvtGamepadButtonUp = (e: Event) => {
    // console.log('Event - onEvtGamepadButtonUp: ', e);
  };

  useEffect(() => {
    window.addEventListener('gamepadbuttonup', onEvtGamepadButtonUp);

    // cleanup this component
    return () => window.removeEventListener('gamepadbuttonup', onEvtGamepadButtonUp);
  }, []);

  // const [seen, setSeen] = useState(false)
  // useEffect(() => {
  //   if (gamepad && gamepad['A'] && !seen) {

  //     // console.log('ctrl - gamepad: ', gamepad);
  //     console.log('gamepad: ', gamepads[0]);
  //     setSeen(true)
  //   }
  
  // }, [gamepad]);

  // ---------------------------- End Test Code

  const onKonamiSuccess = () => {
    setKonamiUnlocked(true);
    onVibrate();
  }
  
  const calcDirectionVertical = (axe: number) => {
    // Up
    if (axe < -0.2) {
      return "up";
    }
    // Down
    if (axe > 0.2) {
      return "down";
    }
  };

  const calcDirectionHorizontal = (axe: number) => {
    // Left
    if (axe < -0.2) {
      return "left";
    }
    // Right
    if (axe > 0.2) {
      return "right";
    }
  };

  const createTransform = (direction: string) => {
    switch (direction) {
      case "up":
        return "translateY(-10px)";
      case "down":
        return "translateY(10px)";
      case "left":
        return "translateX(-10px)";
      case "right":
        return "translateX(10px)";

      default:
        return "";
    }
  };

  useEffect(() => {

    if (gamepads && gamepads.length !== 0) {

      let newButtons: { [key: string]: any } = {};

      Object.keys(gamepads[0].buttons).forEach((button, i) => {
        newButtons[button] = gamepads[0].buttons[button].pressed;
      });

      const newGamepadState = {
        ...newButtons,
        analogLeft: gamepads[0].axes['LeftStickX'] > 0.3 || gamepads[0].axes['LeftStickX'] < -0.3 || gamepads[0].axes['LeftStickY'] > 0.3 || gamepads[0].axes['LeftStickY'] < -0.3,
        analogRight: gamepads[0].axes['RightStickX'] > 0.3 || gamepads[0].axes['RightStickX'] < -0.3 || gamepads[0].axes['RightStickY'] > 0.3 || gamepads[0].axes['RightStickY'] < -0.3,
        analogLeftDirection: [
          calcDirectionHorizontal(gamepads[0].axes['LeftStickX']),
          calcDirectionVertical(gamepads[0].axes['LeftStickY'])
        ],
        analogRightDirection: [
          calcDirectionHorizontal(gamepads[0].axes['RightStickX']),
          calcDirectionVertical(gamepads[0].axes['RightStickY'])
        ],
      };

      setGamepad({ ...newGamepadState });
    }
  }, [gamepads]);

  const onGamepadButtonUp = (button: any) => {
    // console.log('gamepadbuttonup: ', button);
  };

  const onVibrate = () => {
    gamepads[0].vibrationActuator.playEffect('dual-rumble', {
      startDelay: 0,
      duration: 1000,
      weakMagnitude: 1.0,
      strongMagnitude: 1.0
    });
  };

  const GamepadSVG = (
    <svg width="300" viewBox="0 0 441 383" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g id="XBox">
        <path id="LOutline" d="M220.5 294.5C220.5 294.5 195 294.5 150 294.5C105 294.5 81.5 378.5 49.5 378.5C17.5 378.5 4 363.9 4 317.5C4 271.1 43.5 165.5 55 137.5C66.5 109.5 95.5 92.0001 128 92.0001C154 92.0001 200.5 92.0001 220.5 92.0001" stroke="black" strokeWidth="5" strokeOpacity="0.2"></path>
        <path id="ROutline" d="M220 294.5C220 294.5 245.5 294.5 290.5 294.5C335.5 294.5 359 378.5 391 378.5C423 378.5 436.5 363.9 436.5 317.5C436.5 271.1 397 165.5 385.5 137.5C374 109.5 345 92.0001 312.5 92.0001C286.5 92.0001 240 92.0001 220 92.0001" stroke="black" strokeWidth="5" strokeOpacity="0.2"></path>
        <circle id="LStickOutline" cx="113" cy="160" r="37.5" stroke="black" strokeOpacity="0.2" strokeWidth="5"></circle>
        <circle id="LeftStick" cx="113" cy="160" r="28" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="5"></circle>
        <circle id="RStickOutline" cx="278" cy="238" r="37.5" stroke="black" strokeOpacity="0.2" strokeWidth="5"></circle>
        <circle id="RightStick" cx="278" cy="238" r="28" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="5"></circle>
        <circle id="DOutline" cx="166" cy="238" r="37.5" stroke="black" strokeOpacity="0.2" strokeWidth="5"></circle>
        <g id="DUp">
          <mask id="path-8-inside-1" fill="white">
            <path d="M177.669 222.335C180.793 219.21 180.816 213.997 176.868 212.014C176.327 211.743 175.776 211.491 175.215 211.258C172.182 210.002 168.931 209.355 165.648 209.355C162.365 209.355 159.114 210.002 156.081 211.258C155.521 211.491 154.969 211.743 154.429 212.014C150.48 213.997 150.503 219.21 153.627 222.335L159.991 228.698C163.116 231.823 168.181 231.823 171.305 228.698L177.669 222.335Z"></path>
          </mask>
          <path d="M177.669 222.335C180.793 219.21 180.816 213.997 176.868 212.014C176.327 211.743 175.776 211.491 175.215 211.258C172.182 210.002 168.931 209.355 165.648 209.355C162.365 209.355 159.114 210.002 156.081 211.258C155.521 211.491 154.969 211.743 154.429 212.014C150.48 213.997 150.503 219.21 153.627 222.335L159.991 228.698C163.116 231.823 168.181 231.823 171.305 228.698L177.669 222.335Z" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="10" mask="url(#path-8-inside-1)"></path>
        </g>
        <g id="DRight">
          <mask id="path-9-inside-2" fill="white">
            <path d="M181.447 249.669C184.571 252.793 189.785 252.816 191.768 248.868C192.039 248.327 192.291 247.776 192.523 247.215C193.78 244.182 194.426 240.931 194.426 237.648C194.426 234.365 193.78 231.114 192.523 228.081C192.291 227.521 192.039 226.969 191.768 226.429C189.785 222.48 184.571 222.503 181.447 225.627L175.083 231.991C171.959 235.116 171.959 240.181 175.083 243.305L181.447 249.669Z"></path>
          </mask>
          <path d="M181.447 249.669C184.571 252.793 189.785 252.816 191.768 248.868C192.039 248.327 192.291 247.776 192.523 247.215C193.78 244.182 194.426 240.931 194.426 237.648C194.426 234.365 193.78 231.114 192.523 228.081C192.291 227.521 192.039 226.969 191.768 226.429C189.785 222.48 184.571 222.503 181.447 225.627L175.083 231.991C171.959 235.116 171.959 240.181 175.083 243.305L181.447 249.669Z" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="10" mask="url(#path-9-inside-2)"></path>
        </g>
        <g id="DDown">
          <mask id="path-10-inside-3" fill="white">
            <path d="M154.113 253.447C150.989 256.571 150.966 261.785 154.914 263.767C155.455 264.039 156.006 264.291 156.566 264.523C159.6 265.78 162.85 266.426 166.134 266.426C169.417 266.426 172.667 265.78 175.701 264.523C176.261 264.291 176.812 264.039 177.353 263.767C181.301 261.785 181.279 256.571 178.154 253.447L171.79 247.083C168.666 243.959 163.601 243.959 160.477 247.083L154.113 253.447Z"></path>
          </mask>
          <path d="M154.113 253.447C150.989 256.571 150.966 261.785 154.914 263.767C155.455 264.039 156.006 264.291 156.566 264.523C159.6 265.78 162.85 266.426 166.134 266.426C169.417 266.426 172.667 265.78 175.701 264.523C176.261 264.291 176.812 264.039 177.353 263.767C181.301 261.785 181.279 256.571 178.154 253.447L171.79 247.083C168.666 243.959 163.601 243.959 160.477 247.083L154.113 253.447Z" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="10" mask="url(#path-10-inside-3)"></path>
        </g>
        <g id="DLeft">
          <mask id="path-11-inside-4" fill="white">
            <path d="M150.335 226.113C147.21 222.989 141.997 222.966 140.014 226.914C139.743 227.455 139.491 228.006 139.258 228.566C138.002 231.6 137.355 234.85 137.355 238.134C137.355 241.417 138.002 244.667 139.258 247.701C139.491 248.261 139.743 248.812 140.014 249.353C141.997 253.301 147.21 253.279 150.335 250.154L156.698 243.79C159.823 240.666 159.823 235.601 156.698 232.477L150.335 226.113Z"></path>
          </mask>
          <path d="M150.335 226.113C147.21 222.989 141.997 222.966 140.014 226.914C139.743 227.455 139.491 228.006 139.258 228.566C138.002 231.6 137.355 234.85 137.355 238.134C137.355 241.417 138.002 244.667 139.258 247.701C139.491 248.261 139.743 248.812 140.014 249.353C141.997 253.301 147.21 253.279 150.335 250.154L156.698 243.79C159.823 240.666 159.823 235.601 156.698 232.477L150.335 226.113Z" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="10" mask="url(#path-11-inside-4)"></path>
        </g>
        <circle id="BOutline" cx="329" cy="160" r="37.5" stroke="black" strokeOpacity="0.2" strokeWidth="5"></circle>
        <g id="BTop">
          <mask id="path-13-inside-5" fill="white">
            <path d="M340.669 144.335C343.793 141.21 343.816 135.997 339.868 134.014C339.327 133.743 338.776 133.491 338.215 133.258C335.182 132.002 331.931 131.355 328.648 131.355C325.365 131.355 322.114 132.002 319.081 133.258C318.521 133.491 317.969 133.743 317.429 134.014C313.48 135.997 313.503 141.21 316.627 144.335L322.991 150.698C326.116 153.823 331.181 153.823 334.305 150.698L340.669 144.335Z"></path>
          </mask>
          <path d="M340.669 144.335C343.793 141.21 343.816 135.997 339.868 134.014C339.327 133.743 338.776 133.491 338.215 133.258C335.182 132.002 331.931 131.355 328.648 131.355C325.365 131.355 322.114 132.002 319.081 133.258C318.521 133.491 317.969 133.743 317.429 134.014C313.48 135.997 313.503 141.21 316.627 144.335L322.991 150.698C326.116 153.823 331.181 153.823 334.305 150.698L340.669 144.335Z" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="10" mask="url(#path-13-inside-5)"></path>
        </g>
        <g id="BRight">
          <mask id="path-14-inside-6" fill="white">
            <path d="M344.447 171.669C347.571 174.793 352.785 174.816 354.768 170.868C355.039 170.327 355.291 169.776 355.523 169.215C356.78 166.182 357.426 162.931 357.426 159.648C357.426 156.365 356.78 153.114 355.523 150.081C355.291 149.521 355.039 148.969 354.768 148.429C352.785 144.48 347.571 144.503 344.447 147.627L338.083 153.991C334.959 157.116 334.959 162.181 338.083 165.305L344.447 171.669Z"></path>
          </mask>
          <path d="M344.447 171.669C347.571 174.793 352.785 174.816 354.768 170.868C355.039 170.327 355.291 169.776 355.523 169.215C356.78 166.182 357.426 162.931 357.426 159.648C357.426 156.365 356.78 153.114 355.523 150.081C355.291 149.521 355.039 148.969 354.768 148.429C352.785 144.48 347.571 144.503 344.447 147.627L338.083 153.991C334.959 157.116 334.959 162.181 338.083 165.305L344.447 171.669Z" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="10" mask="url(#path-14-inside-6)"></path>
        </g>
        <g id="BBottom">
          <mask id="path-15-inside-7" fill="white">
            <path d="M317.113 175.447C313.989 178.571 313.966 183.785 317.914 185.767C318.455 186.039 319.006 186.291 319.566 186.523C322.6 187.78 325.85 188.426 329.134 188.426C332.417 188.426 335.667 187.78 338.701 186.523C339.261 186.291 339.812 186.039 340.353 185.767C344.301 183.785 344.279 178.571 341.154 175.447L334.79 169.083C331.666 165.959 326.601 165.959 323.477 169.083L317.113 175.447Z"></path>
          </mask>
          <path d="M317.113 175.447C313.989 178.571 313.966 183.785 317.914 185.767C318.455 186.039 319.006 186.291 319.566 186.523C322.6 187.78 325.85 188.426 329.134 188.426C332.417 188.426 335.667 187.78 338.701 186.523C339.261 186.291 339.812 186.039 340.353 185.767C344.301 183.785 344.279 178.571 341.154 175.447L334.79 169.083C331.666 165.959 326.601 165.959 323.477 169.083L317.113 175.447Z" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="10" mask="url(#path-15-inside-7)"></path>
        </g>
        <g id="BLeft">
          <mask id="path-16-inside-8" fill="white">
            <path d="M313.335 148.113C310.21 144.989 304.997 144.966 303.014 148.914C302.743 149.455 302.491 150.006 302.258 150.566C301.002 153.6 300.355 156.851 300.355 160.134C300.355 163.417 301.002 166.668 302.258 169.701C302.491 170.261 302.743 170.812 303.014 171.353C304.997 175.301 310.21 175.279 313.335 172.154L319.698 165.79C322.823 162.666 322.823 157.601 319.698 154.477L313.335 148.113Z"></path>
          </mask>
          <path d="M313.335 148.113C310.21 144.989 304.997 144.966 303.014 148.914C302.743 149.455 302.491 150.006 302.258 150.566C301.002 153.6 300.355 156.851 300.355 160.134C300.355 163.417 301.002 166.668 302.258 169.701C302.491 170.261 302.743 170.812 303.014 171.353C304.997 175.301 310.21 175.279 313.335 172.154L319.698 165.79C322.823 162.666 322.823 157.601 319.698 154.477L313.335 148.113Z" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="10" mask="url(#path-16-inside-8)"></path>
        </g>
        <g id="LMeta">
          <circle cx="185" cy="162" r="10" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="5"></circle>
        </g>
        <g id="RMeta">
          <circle cx="259" cy="162" r="10" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="5"></circle>
        </g>
        <rect id="L1" x="111.5" y="61.5" width="41" height="13" rx="6.5" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="5"></rect>
        <rect id="R1" x="289.5" y="61.5" width="41" height="13" rx="6.5" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="5"></rect>
        <path id="L2" d="M152.5 37C152.5 41.1421 149.142 44.5 145 44.5H132C127.858 44.5 124.5 41.1421 124.5 37V16.5C124.5 8.76801 130.768 2.5 138.5 2.5C146.232 2.5 152.5 8.76801 152.5 16.5V37Z" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="5"></path>
        <path id="R2" d="M317.5 37C317.5 41.1421 314.142 44.5 310 44.5H297C292.858 44.5 289.5 41.1421 289.5 37V16.5C289.5 8.76801 295.768 2.5 303.5 2.5C311.232 2.5 317.5 8.76801 317.5 16.5V37Z" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.2)" strokeWidth="5"></path>
      </g>
    </svg>
  );

  if (!gamepads || gamepads.length === 0) {
    return (
      <Column>
        <h3>Attach a controller</h3>
        {GamepadSVG}
        <p>(or press a button on the controller)</p>
      </Column>
    );
  }

  const {
    DPadUp,
    DPadRight,
    DPadDown,
    DPadLeft,
    Select,
    Start,
    Y,
    B,
    A,
    X,
    analogLeft,
    analogLeftDirection,
    analogRight,
    analogRightDirection,
  } = gamepad;



  return (
    <div>
      { showController && 
        (
          <Column>
            <svg width={288} height={144} viewBox="0 0 1280 819" fill="none" >
              <path
                className="background"
                d="M209.5 7.246c11.7-2.7 26.5-5.2 38.5-6.6 12.5-1.4 38.5-.4 49 1.8 19.7 4.3 31.2 10.6 43.7 24.1 7.8 8.4 21.9 28.7 25.2 36.4 4.4 10.1 12.6 47.8 12.6 58.3v3.1h522v-3.1c0-5.2 4.8-32.2 7.6-43 3.5-13.1 6-18.6 13.5-29.9 12-17.9 23.6-30.5 33.3-36.2 6.4-3.7 19-8.1 29.2-10.1 11-2.2 40.4-2.5 54.4-.5 26.1 3.6 47.3 9.1 61 15.8 21 10.2 31.8 27.5 41.4 66 1.9 7.6 4 16.3 4.6 19.4l1.1 5.5 11.2 8c29 20.4 53.9 42.9 63.3 57.1 11.4 17.1 20.1 37.4 28.8 67.5 7.1 24.6 7.5 27.6 17.5 138.3 9.3 101.8 11.5 142.5 11.6 213 0 54.6-1.2 87.9-4 110.6-3.5 27.8-13.4 49.3-31.2 68-23.4 24.5-47.6 38.4-78.6 45.1-14.5 3.1-41.5 3.1-53 0-16.6-4.5-33.9-14.7-51.7-30.5-24.5-21.7-42.3-49.1-72.6-111.7-18.2-37.4-19.9-40.6-26.2-47.5-3.1-3.3-8-9.3-10.9-13.2l-5.4-7.3-10.2 8.3c-23.1 18.7-34.4 24.2-60.9 29.8-12.4 2.6-36.9 3.1-48.8 1-27.3-4.8-51.2-13.8-71-26.9-17.2-11.4-27.6-24.6-41.3-52.4l-7.2-14.6H573l-7.2 14.6c-13.7 27.8-24.1 41-41.3 52.4-20.1 13.2-43.7 22.1-71 26.9-11.9 2.1-36.4 1.6-48.8-1-26.5-5.6-37.8-11.1-60.9-29.8l-10.2-8.3-5.4 7.3c-3 3.9-8 10.1-11.3 13.7-4 4.4-7.6 9.9-11.1 17-2.8 5.8-10.8 22-17.6 36-28.5 58.3-47.1 86.1-71.4 107.1-17.8 15.4-33.8 24.7-50.1 29.1-11.4 3.1-38.5 3.1-52.9 0-31-6.7-55.2-20.6-78.6-45.1-17.8-18.7-27.7-40.2-31.2-68-2.8-22.7-4-56-4-110.6.1-70.4 2.3-111.1 11.6-213 10.2-112.6 10-111.3 15.9-132.9 8-29.2 17-51.6 27.4-68.6 10-16.2 33.5-38 65.4-60.8 6.4-4.5 11.7-8.4 11.8-8.5.2-.1 1.7-6.8 3.4-14.7 6.1-27.9 16.2-53.4 24.5-62.2 11.4-12 24.5-18.4 49.5-24.2z"
                fill="#C4C4C4"
              />
              <path
                className="direction_up"
                d="M269 165h-77v56c9.333 11.333 30 34 38 34s29.333-22.667 39-34v-56z"
                fill={DPadUp ? activeColor : inactiveColor}
              />
              <path
                className="direction_right"
                d="M341 240v77h-56c-11.333-9.333-34-30-34-38s22.667-29.333 34-39h56z"
                fill={DPadRight ? activeColor : inactiveColor}
              />
              <path
                className="direction_down"
                d="M269 392h-77v-56c9.333-11.333 30-34 38-34s29.333 22.667 39 34v56z"
                fill={DPadDown ? activeColor : inactiveColor}
              />
              <path
                className="direction_left"
                d="M119 240v77h56c11.333-9.333 34-30 34-38s-22.667-29.333-34-39h-56z"
                fill={DPadLeft ? activeColor : inactiveColor}
              />
              <path
                className="select"
                fill={Select ? activeColor : inactiveColor}
                d="M471 262h75v47h-75z"
              />
              <path
                className="start"
                d="M728 309v-49l72 23-72 26z"
                fill={Start ? activeColor : inactiveColor}
              />
              <circle
                className="button_up"
                cx={1050.5}
                cy={183.5}
                r={47.5}
                fill={Y ? activeColor : inactiveColor}
              />
              <circle
                className="button_right"
                cx={1162.5}
                cy={283.5}
                r={47.5}
                fill={B ? activeColor : inactiveColor}
              />
              <circle
                className="button_down"
                cx={1050.5}
                cy={383.5}
                r={47.5}
                fill={A ? activeColor : inactiveColor}
              />
              <circle
                className="button_left"
                cx={935.5}
                cy={283.5}
                r={47.5}
                fill={X ? activeColor : inactiveColor}
              />
              <circle
                className="analog_left"
                cx={429}
                cy={511}
                r={93}
                fill={analogLeft ? activeColor : inactiveColor}
                style={{
                  position: "relative",
                  transition: "transform 200ms ease-out",
                  transform: analogLeftDirection && analogLeftDirection.length > 0 ? `${createTransform(analogLeftDirection[0])} ${createTransform(analogLeftDirection[1])}` : "",
                }}
              />
              <circle
                className="analog_right"
                cx={843}
                cy={511}
                r={93}
                fill={analogRight ? activeColor : inactiveColor}
                style={{
                  position: "relative",
                  transition: "transform 200ms ease-out",
                  transform: analogRightDirection && analogRightDirection.length > 0 ? `${createTransform(analogRightDirection[0])} ${createTransform(analogRightDirection[1])}` : "",
                }}
              />
            </svg>
            { showTestVibrate && <button onClick={onVibrate}>Test Vibration</button> }
          </Column>
        )
      }
      { showControllerDashboard && (<ControllerDashbaord gamepad={gamepads[0]} />) }
      { konamiUnlocked &&
        (
          <div>
            <p>`🎉 Youve unlocked konami 🎉 `</p>
            <button onClick={() => setKonamiUnlocked(false)}>reset</button>
          </div>
        )
      }
    </div>
  );
};

export default Controller;





const Column = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

