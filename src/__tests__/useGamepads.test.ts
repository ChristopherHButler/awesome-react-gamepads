import { renderHook, act } from '@testing-library/react';
import { useGamepads } from '../hooks/useGamepads';

// ---------------------------------------------------------------------------
// Browser API mocks
// ---------------------------------------------------------------------------

let rafCallback: FrameRequestCallback | null = null;

beforeEach(() => {
  rafCallback = null;

  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    rafCallback = cb;
    return 1;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  jest.spyOn(document, 'dispatchEvent').mockImplementation(() => true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeButton(pressed = false, touched = false, value = 0): GamepadButton {
  return { pressed, touched, value };
}

function makeGamepad(buttonOverrides: Partial<GamepadButton>[] = [], axesOverrides: number[] = []): Gamepad {
  const buttons: GamepadButton[] = Array(17).fill(null).map((_, i) => ({
    pressed: false,
    touched: false,
    value: 0,
    ...(buttonOverrides[i] ?? {}),
  }));
  const axes = axesOverrides.length > 0 ? axesOverrides : [0, 0, 0, 0, 0, 0];
  return {
    id: 'Xbox Controller',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes,
    buttons,
    timestamp: Date.now(),
    hapticActuators: [],
    vibrationActuator: null,
  } as unknown as Gamepad;
}

/** Simulate one animation frame with a given gamepad state. */
function tick(gamepad: Gamepad) {
  Object.defineProperty(navigator, 'getGamepads', {
    value: jest.fn(() => [gamepad]),
    configurable: true,
    writable: true,
  });
  act(() => {
    rafCallback?.(performance.now());
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGamepads — SSR safety', () => {
  it('returns undefined and does not call navigator when getGamepads is unavailable', () => {
    Object.defineProperty(navigator, 'getGamepads', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    let result: any;
    expect(() => {
      const { result: r } = renderHook(() => useGamepads());
      result = r;
    }).not.toThrow();
    expect(result?.current?.gamepad).toBeUndefined();
  });
});

describe('useGamepads — dead zone', () => {
  it('does not fire onGamepadAxesChange for values below the dead zone', () => {
    const onGamepadAxesChange = jest.fn();
    renderHook(() => useGamepads({ onGamepadAxesChange, deadZone: 0.08 }));

    // Value below threshold — should be swallowed (rounds to 0, no change from initial 0)
    tick(makeGamepad([], [0.05, 0, 0, 0, 0, 0]));
    expect(onGamepadAxesChange).not.toHaveBeenCalled();
  });

  it('fires onGamepadAxesChange for values above the dead zone', () => {
    const onGamepadAxesChange = jest.fn();
    renderHook(() => useGamepads({ onGamepadAxesChange, deadZone: 0.08 }));

    tick(makeGamepad([], [0.5, 0, 0, 0, 0, 0]));
    expect(onGamepadAxesChange).toHaveBeenCalledWith(
      expect.objectContaining({ axesName: 'LeftStickX', value: 0.5 }),
    );
  });
});

describe('useGamepads — button state transitions', () => {
  it('fires onGamepadButtonDown when a button is pressed', () => {
    const onGamepadButtonDown = jest.fn();
    renderHook(() => useGamepads({ onGamepadButtonDown }));

    // First tick — baseline (all released, no change from initial state)
    tick(makeGamepad());
    expect(onGamepadButtonDown).not.toHaveBeenCalled();

    // Second tick — press A (index 0)
    tick(makeGamepad([{ pressed: true, touched: true, value: 1 }]));
    expect(onGamepadButtonDown).toHaveBeenCalledWith(
      expect.objectContaining({ buttonName: 'A', pressed: true }),
    );
  });

  it('fires onGamepadButtonUp when a button is released', () => {
    const onGamepadButtonUp = jest.fn();
    renderHook(() => useGamepads({ onGamepadButtonUp }));

    tick(makeGamepad());                                                   // baseline
    tick(makeGamepad([{ pressed: true, touched: true, value: 1 }]));     // press A
    tick(makeGamepad());                                                   // release A

    expect(onGamepadButtonUp).toHaveBeenCalledWith(
      expect.objectContaining({ buttonName: 'A', pressed: false }),
    );
  });

  it('fires onGamepadButtonChange on both press and release', () => {
    const onGamepadButtonChange = jest.fn();
    renderHook(() => useGamepads({ onGamepadButtonChange }));

    tick(makeGamepad());                                                   // baseline — no changes
    tick(makeGamepad([{ pressed: true, touched: true, value: 1 }]));     // press A
    tick(makeGamepad());                                                   // release A

    expect(onGamepadButtonChange).toHaveBeenCalledTimes(2);
  });
});

describe('useGamepads — axes change', () => {
  it('fires onGamepadAxesChange when an axis moves beyond the dead zone', () => {
    const onGamepadAxesChange = jest.fn();
    renderHook(() => useGamepads({ onGamepadAxesChange }));

    tick(makeGamepad([], [0.9, 0, 0, 0, 0, 0]));
    expect(onGamepadAxesChange).toHaveBeenCalledWith(
      expect.objectContaining({ axesName: 'LeftStickX', value: 0.9 }),
    );
  });

  it('includes previousValue in the axes details', () => {
    const onGamepadAxesChange = jest.fn();
    renderHook(() => useGamepads({ onGamepadAxesChange }));

    tick(makeGamepad([], [0.5, 0, 0, 0, 0, 0]));
    tick(makeGamepad([], [0.9, 0, 0, 0, 0, 0]));

    const secondCall = onGamepadAxesChange.mock.calls[1][0];
    expect(secondCall).toMatchObject({ axesName: 'LeftStickX', value: 0.9, previousValue: 0.5 });
  });
});

describe('useGamepads — Konami code', () => {
  // Up Up Down Down Left Right Left Right B A
  // DPadUp=12, DPadDown=13, DPadLeft=14, DPadRight=15, B=1, A=0
  const konamiIndices = [12, 12, 13, 13, 14, 15, 14, 15, 1, 0];

  function pressAndRelease(index: number) {
    const overrides = Array(17).fill(null).map((_, i) =>
      i === index ? makeButton(true, true, 1) : makeButton(),
    );
    tick(makeGamepad(overrides));  // press
    tick(makeGamepad());           // release
  }

  it('fires onKonamiSuccess when the full sequence is entered correctly', () => {
    const onKonamiSuccess = jest.fn();
    renderHook(() => useGamepads({ onKonamiSuccess }));
    tick(makeGamepad()); // baseline

    for (const index of konamiIndices) {
      pressAndRelease(index);
    }

    expect(onKonamiSuccess).toHaveBeenCalledTimes(1);
  });

  it('does not fire onKonamiSuccess for an incorrect sequence', () => {
    const onKonamiSuccess = jest.fn();
    renderHook(() => useGamepads({ onKonamiSuccess }));
    tick(makeGamepad());

    // Enter with wrong button at position 8 (A=0 instead of B=1)
    const wrong = [...konamiIndices];
    wrong[8] = 0;
    for (const index of wrong) {
      pressAndRelease(index);
    }

    expect(onKonamiSuccess).not.toHaveBeenCalled();
  });
});
