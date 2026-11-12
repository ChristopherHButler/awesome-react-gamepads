import { renderHook, act } from '@testing-library/react';
import { useGamepads } from '../hooks/useGamepads';
import { ControllerProfiles, translateSequence } from '../models/ControllerProfiles';
import { parseXInputReport } from '../webusb/usbGamepads';

let rafCallback: FrameRequestCallback | null = null;

beforeEach(() => {
  rafCallback = null;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { rafCallback = cb; return 1; });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  jest.spyOn(document, 'dispatchEvent').mockImplementation(() => true);
});
afterEach(() => jest.restoreAllMocks());

function guitar(pressed: number[] = [], axes: number[] = [0, 0, 0, 0]): Gamepad {
  return {
    id: 'Guitar Hero X-plorer', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), touched: false, value: pressed.includes(i) ? 1 : 0 })),
    axes, vibrationActuator: null,
  } as unknown as Gamepad;
}

function tick(gamepad: Gamepad) {
  Object.defineProperty(navigator, 'getGamepads', { value: jest.fn(() => [gamepad]), configurable: true, writable: true });
  act(() => { rafCallback?.(performance.now()); });
}

describe('guitar profile', () => {
  it('follows the standard XInput layout', () => {
    const b = ControllerProfiles.guitar.buttons;
    expect(b[0]).toBe('GreenFret');
    expect(b[1]).toBe('RedFret');
    expect(b[2]).toBe('BlueFret');
    expect(b[3]).toBe('YellowFret');
    expect(b[4]).toBe('OrangeFret');
    expect(b[8]).toBe('StarPower');
    expect(b[9]).toBe('Start');
    expect(b[12]).toBe('StrumUp');
    expect(b[13]).toBe('StrumDown');
    expect(b[16]).toBe('Xbox');
    expect(ControllerProfiles.guitar.axes[2]).toBe('Whammy');
    expect(ControllerProfiles.guitar.axes[3]).toBe('Tilt');
  });

  it('translates the Konami code onto strum + frets', () => {
    expect(translateSequence(['DPadUp', 'DPadDown', 'A', 'B'], 'xbox', 'guitar'))
      .toEqual(['StrumUp', 'StrumDown', 'GreenFret', 'RedFret']);
  });

  it('fires fret, strum and star power callbacks', () => {
    const cb = {
      onGreenFret: jest.fn(), onRedFret: jest.fn(), onYellowFret: jest.fn(), onBlueFret: jest.fn(), onOrangeFret: jest.fn(),
      onStrumUp: jest.fn(), onStrumDown: jest.fn(), onStarPower: jest.fn(), onStart: jest.fn(),
    };
    renderHook(() => useGamepads({ controllerProfile: 'guitar', ...cb }));
    tick(guitar());
    tick(guitar([0, 1, 2, 3, 4, 8, 9, 12]));
    tick(guitar());
    tick(guitar([13]));

    expect(cb.onGreenFret).toHaveBeenCalledTimes(1);
    expect(cb.onRedFret).toHaveBeenCalledTimes(1);
    expect(cb.onBlueFret).toHaveBeenCalledTimes(1);
    expect(cb.onYellowFret).toHaveBeenCalledTimes(1);
    expect(cb.onOrangeFret).toHaveBeenCalledTimes(1);
    expect(cb.onStarPower).toHaveBeenCalledTimes(1);
    expect(cb.onStart).toHaveBeenCalledTimes(1);
    expect(cb.onStrumUp).toHaveBeenCalledTimes(1);
    expect(cb.onStrumDown).toHaveBeenCalledTimes(1);
    expect(cb.onBlueFret.mock.calls[0][0].buttonName).toBe('BlueFret');
  });

  it('works when switching profile from xbox to guitar at runtime', () => {
    const onGreenFret = jest.fn();
    const onStrumUp = jest.fn();
    const { rerender } = renderHook(
      ({ profile }) => useGamepads({ controllerProfile: profile, onGreenFret, onStrumUp }),
      { initialProps: { profile: 'xbox' as const } as { profile: 'xbox' | 'guitar' } },
    );
    tick(guitar());
    rerender({ profile: 'guitar' });
    tick(guitar());
    tick(guitar([0, 12]));
    expect(onGreenFret).toHaveBeenCalledTimes(1);
    expect(onStrumUp).toHaveBeenCalledTimes(1);
  });

  it('star power falls back to onSelect', () => {
    const onSelect = jest.fn();
    renderHook(() => useGamepads({ controllerProfile: 'guitar', onSelect }));
    tick(guitar());
    tick(guitar([8]));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('fires whammy and tilt callbacks from the right stick axes', () => {
    const onWhamBar = jest.fn();
    const onTilt = jest.fn();
    renderHook(() => useGamepads({ controllerProfile: 'guitar', onWhamBar, onTilt }));
    tick(guitar());
    tick(guitar([], [0, 0, 0.6, -0.9]));
    expect(onWhamBar).toHaveBeenCalledWith(expect.objectContaining({ axesName: 'Whammy', value: 0.6 }));
    expect(onTilt).toHaveBeenCalledWith(expect.objectContaining({ axesName: 'Tilt', value: -0.9 }));
  });
});

describe('parseXInputReport', () => {
  function report(lo: number, hi: number, rx = 0, ry = 0): DataView {
    const v = new DataView(new ArrayBuffer(20));
    v.setUint8(0, 0x00); v.setUint8(1, 0x14);
    v.setUint8(2, lo); v.setUint8(3, hi);
    v.setInt16(10, rx, true); v.setInt16(12, ry, true);
    return v;
  }

  it('maps XInput bits to standard Gamepad buttons', () => {
    // hi: A(0x10) | Y(0x80) | LB(0x01); lo: D-up(0x01) | Back(0x20)
    const g = parseXInputReport(report(0x21, 0x91), { id: 'x', index: 0 })!;
    const pressed = g.buttons.map((b, i) => (b.pressed ? i : -1)).filter(i => i >= 0);
    expect(pressed).toEqual([0, 3, 4, 8, 12]);
    expect(g.mapping).toBe('standard');
  });

  it('normalises right stick to whammy/tilt axes', () => {
    const g = parseXInputReport(report(0, 0, 32767, 32767), { id: 'x', index: 0 })!;
    expect(g.axes[2]).toBeCloseTo(1);
    expect(g.axes[3]).toBeCloseTo(-1); // Y inverted to standard "up = negative"
  });

  it('ignores non-input messages', () => {
    const v = new DataView(new ArrayBuffer(3));
    v.setUint8(0, 0x01);
    expect(parseXInputReport(v, { id: 'x', index: 0 })).toBeNull();
  });
});
