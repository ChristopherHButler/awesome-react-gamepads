
export const Xbox = {
  buttons: [
    'A',         // gamepad.buttons[0].pressed
    'B',         // gamepad.buttons[1].pressed
    'X',         // gamepad.buttons[2].pressed
    'Y',         // gamepad.buttons[3].pressed
    'LB',        // gamepad.buttons[4].pressed
    'RB',        // gamepad.buttons[5].pressed
    'LT',        // gamepad.buttons[6].pressed
    'RT',        // gamepad.buttons[7].pressed
    'Select',    // gamepad.buttons[8].pressed
    'Start',     // gamepad.buttons[9].pressed
    'LS',        // gamepad.buttons[10].pressed (Left Stick Pressed)
    'RS',        // gamepad.buttons[11].pressed (Right Stick Pressed)
    'DPadUp',    // gamepad.buttons[12].pressed
    'DPadDown',  // gamepad.buttons[13].pressed
    'DPadLeft',  // gamepad.buttons[14].pressed
    'DPadRight', // gamepad.buttons[15].pressed
    'Xbox',      // gamepad.buttons[16].pressed
  ],
  axes: [
    'LeftStickX',
    '-LeftStickY',
    'RightStickX',
    '-RightStickY',
    'LeftTrigger',
    'RightTrigger',
  ],
  buttonAxes: [
    null,
    null,
    null,
    null,
    null,
    null,
    'LeftTrigger',
    'RightTrigger',
  ],
  buttonIndexToName: function(index: number) {
    if (this.buttons.length >= (index)) {
      return this.buttons[index];
    }
    return null;
  },
  axesIndexToName: function(index: number) {
    if (this.axes.length >= index) {
      return this.axes[index];
    }
    return null;
  },
  buttonAxesIndexToName: function(index: number) {
    if (this.axes.length >= index) {
      return this.buttonAxes[index];
    }
    return null;
  },
};