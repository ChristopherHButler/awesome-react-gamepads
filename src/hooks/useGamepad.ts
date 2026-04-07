import { useGamepadCore } from './useGamepadCore';
import type { UseGamepadsProps, UseGamepadsReturn } from './useGamepadCore';

/**
 * useGamepad — tracks a single gamepad by index. Useful for local multiplayer
 * where each player has their own hook instance:
 *
 * ```tsx
 * const { gamepad: p1, rumble: rumble1 } = useGamepad(0, { onA: () => jump(1) });
 * const { gamepad: p2, rumble: rumble2 } = useGamepad(1, { onA: () => jump(2) });
 * ```
 */
export const useGamepad = (
  index: number,
  props: UseGamepadsProps = {},
): UseGamepadsReturn => useGamepadCore(props, index);
