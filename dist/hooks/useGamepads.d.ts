import { AxesDetails, ButtonDetails, ReactGamepad } from '../constants';
interface UseGamepadsProps {
    deadZone?: number;
    stickThreshold?: number;
    onConnect?: (gamepad: ReactGamepad) => void;
    onDisconnect?: (gamepad: ReactGamepad) => void;
    onUpdate?: (gamepad: ReactGamepad) => void;
    onGamepadButtonDown?: (button: ButtonDetails) => void;
    onGamepadButtonUp?: (button: ButtonDetails) => void;
    onGamepadButtonChange?: (button: ButtonDetails) => void;
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
export declare const useGamepads: ({ stickThreshold, deadZone, onConnect, onDisconnect, onUpdate, onGamepadButtonDown, onGamepadButtonUp, onGamepadButtonChange, onGamepadAxesChange, onLeftStickRight, onLeftStickLeft, onLeftStickUp, onLeftStickDown, onRightStickRight, onRightStickLeft, onRightStickUp, onRightStickDown, onKonamiSuccess, }?: UseGamepadsProps) => undefined;
export {};
