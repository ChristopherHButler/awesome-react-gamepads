import React from 'react';
import { render, screen, renderHook, act } from '@testing-library/react';
import { GamepadsProvider, useGamepadsContext, withGamepads, WithGamepadsProps } from '../contexts/GamepadsContext';

// ---------------------------------------------------------------------------
// Mocks (same pattern as useGamepads.test.ts)
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

  Object.defineProperty(navigator, 'getGamepads', {
    value: jest.fn(() => []),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function tick() {
  act(() => { rafCallback?.(performance.now()); });
}

// ---------------------------------------------------------------------------
// useGamepadsContext
// ---------------------------------------------------------------------------

describe('useGamepadsContext', () => {
  it('throws a descriptive error when used outside GamepadsProvider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useGamepadsContext())).toThrow(
      /useGamepadsContext must be used within a <GamepadsProvider>/,
    );
    consoleError.mockRestore();
  });

  it('returns context value when used inside GamepadsProvider', () => {
    const { result } = renderHook(() => useGamepadsContext(), {
      wrapper: ({ children }) => <GamepadsProvider>{children}</GamepadsProvider>,
    });

    tick();

    expect(result.current).toMatchObject({
      rumble: expect.any(Function),
      profile: 'xbox',
      buttonLabels: expect.objectContaining({ A: 'A' }),
    });
  });

  it('passes controllerProfile prop through to context value', () => {
    const { result } = renderHook(() => useGamepadsContext(), {
      wrapper: ({ children }) => (
        <GamepadsProvider controllerProfile="playstation">{children}</GamepadsProvider>
      ),
    });

    tick();

    expect(result.current.profile).toBe('playstation');
    expect(result.current.buttonLabels.A).toBe('Cross');
  });

  it('calls onA callback when A is pressed', () => {
    const onA = jest.fn();

    renderHook(() => useGamepadsContext(), {
      wrapper: ({ children }) => <GamepadsProvider onA={onA}>{children}</GamepadsProvider>,
    });

    // Baseline tick
    tick();

    // Press button index 0 (A)
    Object.defineProperty(navigator, 'getGamepads', {
      value: jest.fn(() => [{
        id: 'Test', index: 0, connected: true, mapping: 'standard',
        axes: [0, 0, 0, 0, 0, 0], timestamp: Date.now(),
        hapticActuators: [], vibrationActuator: null,
        buttons: Array(17).fill(null).map((_, i) => ({
          pressed: i === 0, touched: false, value: i === 0 ? 1 : 0,
        })),
      }]),
      configurable: true, writable: true,
    });
    tick();

    expect(onA).toHaveBeenCalledWith(expect.objectContaining({ buttonName: 'A', pressed: true }));
  });
});

// ---------------------------------------------------------------------------
// GamepadsProvider
// ---------------------------------------------------------------------------

describe('GamepadsProvider', () => {
  it('renders children', () => {
    render(
      <GamepadsProvider>
        <span data-testid="child">hello</span>
      </GamepadsProvider>,
    );
    expect(screen.getByTestId('child')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// withGamepads HOC
// ---------------------------------------------------------------------------

describe('withGamepads', () => {
  it('injects gamepad props from context into the wrapped component', () => {
    interface OwnProps { label: string }
    const Inner: React.FC<OwnProps & WithGamepadsProps> = ({ label, profile, buttonLabels }) => (
      <div data-testid="inner">
        {label} | {profile} | {buttonLabels.A}
      </div>
    );
    const Wrapped = withGamepads(Inner);

    render(
      <GamepadsProvider controllerProfile="playstation">
        <Wrapped label="P1" />
      </GamepadsProvider>,
    );

    tick();

    const el = screen.getByTestId('inner');
    expect(el.textContent).toBe('P1 | playstation | Cross');
  });

  it('sets a descriptive displayName on the wrapped component', () => {
    const MyComp: React.FC<WithGamepadsProps> = () => null;
    MyComp.displayName = 'MyComp';
    const Wrapped = withGamepads(MyComp);
    expect(Wrapped.displayName).toBe('withGamepads(MyComp)');
  });

  it('throws when no GamepadsProvider is present', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const Inner: React.FC<WithGamepadsProps> = () => <div />;
    const Wrapped = withGamepads(Inner);
    expect(() => render(<Wrapped />)).toThrow(/GamepadsProvider/);
    consoleError.mockRestore();
  });
});
