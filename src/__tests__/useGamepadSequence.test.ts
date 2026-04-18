import { renderHook, act } from '@testing-library/react';
import { useGamepadSequence } from '../hooks/useGamepadSequence';
import { translateSequence } from '../models/ControllerProfiles';

// ---------------------------------------------------------------------------
// Mocks
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

function makeGamepad(buttonIndices: number[] = []): Gamepad {
  const buttons: GamepadButton[] = Array(17).fill(null).map((_, i) => ({
    pressed: buttonIndices.includes(i),
    touched: false,
    value: buttonIndices.includes(i) ? 1 : 0,
  }));
  return {
    id: 'Xbox Controller',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0, 0, 0],
    buttons,
    timestamp: Date.now(),
    hapticActuators: [],
    vibrationActuator: null,
  } as unknown as Gamepad;
}

function setGamepad(gamepad: Gamepad) {
  Object.defineProperty(navigator, 'getGamepads', {
    value: jest.fn(() => [gamepad]),
    configurable: true,
    writable: true,
  });
}

function tick() {
  act(() => { rafCallback?.(performance.now()); });
}

// Press a button for one frame then release (advances sequence on button-up)
function pressRelease(buttonIndex: number) {
  setGamepad(makeGamepad([buttonIndex]));
  tick(); // pressed
  setGamepad(makeGamepad([]));
  tick(); // released → onButtonUp fires in hook
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGamepadSequence — basic matching', () => {
  it('fires callback when full sequence is matched (raw indices)', () => {
    const callback = jest.fn();
    renderHook(() => useGamepadSequence([0, 1], callback));

    setGamepad(makeGamepad()); tick(); // baseline

    pressRelease(0); // A
    expect(callback).not.toHaveBeenCalled();

    pressRelease(1); // B — sequence complete
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('fires callback when full sequence is matched (string names)', () => {
    const callback = jest.fn();
    renderHook(() => useGamepadSequence(['A', 'B'], callback));

    setGamepad(makeGamepad()); tick();

    pressRelease(0); pressRelease(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not fire for a partial match', () => {
    const callback = jest.fn();
    renderHook(() => useGamepadSequence([0, 1, 0], callback));

    setGamepad(makeGamepad()); tick();

    pressRelease(0); pressRelease(1); // only 2 of 3
    expect(callback).not.toHaveBeenCalled();
  });

  it('resets on wrong button and retries correctly', () => {
    const callback = jest.fn();
    renderHook(() => useGamepadSequence([0, 1], callback)); // A then B

    setGamepad(makeGamepad()); tick();

    pressRelease(0); // A ✓ (progress=1)
    pressRelease(2); // X — wrong, resets
    pressRelease(0); // A ✓ again
    pressRelease(1); // B ✓ — complete
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('can be matched multiple times in a row', () => {
    const callback = jest.fn();
    renderHook(() => useGamepadSequence([0, 1], callback));

    setGamepad(makeGamepad()); tick();

    pressRelease(0); pressRelease(1); // first
    pressRelease(0); pressRelease(1); // second
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe('useGamepadSequence — reset()', () => {
  it('reset() clears partial progress so sequence must restart', () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useGamepadSequence([0, 1], callback));

    setGamepad(makeGamepad()); tick();

    pressRelease(0); // halfway (progress=1)
    act(() => { result.current.reset(); });

    pressRelease(1); // B without A first — should NOT complete
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('useGamepadSequence — timeout option', () => {
  it('resets when timeout is exceeded between inputs', () => {
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    const callback = jest.fn();
    renderHook(() => useGamepadSequence([0, 1], callback, { timeout: 500 }));

    setGamepad(makeGamepad()); tick();

    pressRelease(0); // A at t=1000

    now += 600; // exceed 500ms timeout
    pressRelease(1); // B — too late, sequence reset
    expect(callback).not.toHaveBeenCalled();
  });

  it('completes when all inputs are within the timeout window', () => {
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    const callback = jest.fn();
    renderHook(() => useGamepadSequence([0, 1], callback, { timeout: 500 }));

    setGamepad(makeGamepad()); tick();

    pressRelease(0); // A at t=1000
    now += 300; // within 500ms
    pressRelease(1); // B — in time
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('useGamepadSequence — controller profiles', () => {
  it('matches using PlayStation button names', () => {
    const callback = jest.fn();
    renderHook(() => useGamepadSequence(
      ['Cross', 'Circle'],
      callback,
      { controllerProfile: 'playstation' },
    ));

    setGamepad(makeGamepad()); tick();

    pressRelease(0); // Cross (index 0 on PS)
    pressRelease(1); // Circle (index 1 on PS)
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('matches using raw indices on PlayStation profile', () => {
    const callback = jest.fn();
    renderHook(() => useGamepadSequence([0, 1], callback, { controllerProfile: 'playstation' }));

    setGamepad(makeGamepad()); tick();

    pressRelease(0); pressRelease(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('translateSequence utility', () => {
  it('maps Xbox names to PlayStation names', () => {
    expect(translateSequence(['A', 'B', 'DPadUp'], 'xbox', 'playstation'))
      .toEqual(['Cross', 'Circle', 'DPadUp']);
  });

  it('maps Xbox names to Switch names', () => {
    // Xbox A (index 0) → Switch B
    // Xbox B (index 1) → Switch A
    expect(translateSequence(['A', 'B'], 'xbox', 'switch'))
      .toEqual(['B', 'A']);
  });

  it('is a no-op for same profile', () => {
    const seq = ['A', 'B', 'X'];
    expect(translateSequence(seq, 'xbox', 'xbox')).toBe(seq);
  });
});
