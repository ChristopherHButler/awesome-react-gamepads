import { useRef, useCallback, useEffect } from 'react';

import { ControllerProfile, ControllerProfiles } from '../models/ControllerProfiles';
import { SequenceMatcher, SequenceMatcherOptions } from '../utils/SequenceMatcher';

const isBrowser = typeof window !== 'undefined';

export interface UseGamepadSequenceOptions extends SequenceMatcherOptions {
  /** Controller profile used to resolve button names. Default: 'xbox'. */
  controllerProfile?: ControllerProfile;
}

export interface UseGamepadSequenceReturn {
  /** Manually reset progress back to the beginning of the sequence. */
  reset: () => void;
}

/**
 * Detects an arbitrary button sequence and fires a callback when matched.
 * Works standalone — no `useGamepads` required in the same component.
 *
 * Supports button names ("A", "Cross") or raw indices (0, 1, 2…).
 *
 * ```tsx
 * // Konami code (equivalent to onKonamiSuccess)
 * useGamepadSequence(
 *   ['DPadUp','DPadUp','DPadDown','DPadDown','DPadLeft','DPadRight','DPadLeft','DPadRight','B','A'],
 *   () => activateCheats(),
 * );
 *
 * // Fighting game combo with 2-second window between inputs
 * useGamepadSequence(['Down', 'DPadRight', 'A'], () => fireHadouken(), { timeout: 2000 });
 *
 * // PlayStation button names
 * useGamepadSequence(['Cross', 'Circle', 'Cross'], () => jump(), { controllerProfile: 'playstation' });
 *
 * // Raw indices
 * useGamepadSequence([0, 1, 0], () => doCombo());
 * ```
 */
export const useGamepadSequence = (
  sequence: (string | number)[],
  callback: () => void,
  options: UseGamepadSequenceOptions = {},
): UseGamepadSequenceReturn => {
  const { controllerProfile = 'xbox', ...matcherOptions } = options;

  // Keep all live values in refs so the stable rAF callback always reads fresh state
  const callbackRef = useRef(callback);
  const profileRef = useRef(controllerProfile);
  const sequenceRef = useRef(sequence);

  useEffect(() => { callbackRef.current = callback; }, [callback]);
  useEffect(() => { profileRef.current = controllerProfile; }, [controllerProfile]);
  useEffect(() => { sequenceRef.current = sequence; }, [sequence]);

  const matcher = useRef<SequenceMatcher>(
    new SequenceMatcher(normalizeSequence(sequence, controllerProfile), matcherOptions),
  );

  // Keep matcher in sync when sequence / options change
  useEffect(() => {
    matcher.current.setSequence(normalizeSequence(sequence, controllerProfile));
  }, [sequence, controllerProfile]);

  useEffect(() => {
    matcher.current.setOptions(matcherOptions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matcherOptions.timeout, matcherOptions.resetOnMiss]);

  // Stable ref for the previous button pressed state (per gamepad index)
  const prevButtons = useRef<boolean[][]>([]);
  const rafRef = useRef(0);

  const poll = useCallback(() => {
    if (isBrowser && navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      const profileButtons = ControllerProfiles[profileRef.current].buttons;

      for (let gi = 0; gi < gamepads.length; gi++) {
        const gamepad = gamepads[gi];
        if (!gamepad) continue;

        if (!prevButtons.current[gi]) prevButtons.current[gi] = [];

        for (let bi = 0; bi < gamepad.buttons.length; bi++) {
          const wasPressed = prevButtons.current[gi][bi] ?? false;
          const isPressed = gamepad.buttons[bi].pressed;

          if (wasPressed && !isPressed) {
            const buttonName = profileButtons[bi];
            if (buttonName && matcher.current.onButtonUp(buttonName)) {
              callbackRef.current();
            }
          }

          prevButtons.current[gi][bi] = isPressed;
        }
      }
    }

    rafRef.current = requestAnimationFrame(poll);
  // poll is intentionally stable — all mutable state accessed via refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isBrowser) return;
    rafRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [poll]);

  const reset = useCallback(() => {
    matcher.current.reset();
  }, []);

  return { reset };
};

function normalizeSequence(raw: (string | number)[], profile: ControllerProfile): string[] {
  const buttons = ControllerProfiles[profile].buttons;
  return raw.map(item => (typeof item === 'number' ? (buttons[item] ?? String(item)) : item));
}
