
export interface ButtonDetails {
  buttonIndex: number;
  buttonName: string;
  pressed: boolean;
  touched: boolean;
  value: string;
}

export interface AxesDetails {
  axesIndex: number;
  axesName: string;
  value: number;
  previousValue: number;
}

export interface ReactGamepad extends Gamepad {
  vibrationActuator?: GamepadHapticActuator;
}