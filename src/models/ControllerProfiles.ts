export type ControllerProfile = 'xbox' | 'playstation' | 'switch' | 'generic';

interface ProfileDefinition {
  displayName: string;
  /** Button names indexed by Standard Gamepad button index (0–16). */
  buttons: string[];
  /** Axes names indexed by Standard Gamepad axis index (0–5). Prefix `-` to invert. */
  axes: string[];
}

/**
 * All profiles share the same physical Standard Gamepad layout; only the names differ.
 *
 * Standard Gamepad button layout:
 *  0 = bottom face   (A / Cross / B)
 *  1 = right face    (B / Circle / A)
 *  2 = left face     (X / Square / Y)
 *  3 = top face      (Y / Triangle / X)
 *  4 = left shoulder (LB / L1 / L)
 *  5 = right shoulder(RB / R1 / R)
 *  6 = left trigger  (LT / L2 / ZL)
 *  7 = right trigger (RT / R2 / ZR)
 *  8 = back/select   (Select / Share / Minus)
 *  9 = start/menu    (Start / Options / Plus)
 * 10 = left stick click  (LS / L3)
 * 11 = right stick click (RS / R3)
 * 12 = D-Pad Up
 * 13 = D-Pad Down
 * 14 = D-Pad Left
 * 15 = D-Pad Right
 * 16 = home/guide    (Xbox / PS / Home)
 */
export const ControllerProfiles: Record<ControllerProfile, ProfileDefinition> = {
  xbox: {
    displayName: 'Xbox',
    buttons: [
      'A', 'B', 'X', 'Y',
      'LB', 'RB', 'LT', 'RT',
      'Select', 'Start', 'LS', 'RS',
      'DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight',
      'Xbox',
    ],
    axes: ['LeftStickX', '-LeftStickY', 'RightStickX', '-RightStickY', 'LeftTrigger', 'RightTrigger'],
  },
  playstation: {
    displayName: 'PlayStation',
    buttons: [
      'Cross', 'Circle', 'Square', 'Triangle',
      'L1', 'R1', 'L2', 'R2',
      'Share', 'Options', 'L3', 'R3',
      'DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight',
      'PS',
    ],
    axes: ['LeftStickX', '-LeftStickY', 'RightStickX', '-RightStickY', 'LeftTrigger', 'RightTrigger'],
  },
  switch: {
    displayName: 'Nintendo Switch',
    // Switch Pro Controller face buttons are positionally swapped vs Xbox:
    // bottom=B, right=A, left=Y, top=X
    buttons: [
      'B', 'A', 'Y', 'X',
      'L', 'R', 'ZL', 'ZR',
      'Minus', 'Plus', 'LS', 'RS',
      'DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight',
      'Home',
    ],
    axes: ['LeftStickX', '-LeftStickY', 'RightStickX', '-RightStickY', 'LeftTrigger', 'RightTrigger'],
  },
  generic: {
    displayName: 'Generic',
    buttons: [
      'Button0', 'Button1', 'Button2', 'Button3',
      'Button4', 'Button5', 'Button6', 'Button7',
      'Button8', 'Button9', 'Button10', 'Button11',
      'DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight',
      'Button16',
    ],
    axes: ['LeftStickX', '-LeftStickY', 'RightStickX', '-RightStickY', 'LeftTrigger', 'RightTrigger'],
  },
};

/**
 * Returns a map from Xbox button names to the equivalent names in the given profile.
 * Useful for rendering correct button labels in UI:
 *
 * ```tsx
 * const { buttonLabels } = useGamepads({ controllerProfile: 'playstation' });
 * <p>Press {buttonLabels.A} to confirm</p>  // → "Press Cross to confirm"
 * ```
 */
export function getButtonLabels(profile: ControllerProfile): Record<string, string> {
  const xboxButtons = ControllerProfiles.xbox.buttons;
  const profileButtons = ControllerProfiles[profile].buttons;
  const labels: Record<string, string> = {};
  for (let i = 0; i < xboxButtons.length; i++) {
    if (xboxButtons[i]) {
      labels[xboxButtons[i]] = profileButtons[i] ?? xboxButtons[i];
    }
  }
  return labels;
}
