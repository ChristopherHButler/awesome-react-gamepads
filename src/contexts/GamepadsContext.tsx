import React, { createContext, useContext } from 'react';

import { useGamepads } from '../hooks/useGamepads';
import { UseGamepadsProps, UseGamepadsReturn } from '../hooks/useGamepadCore';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const GamepadsContext = createContext<UseGamepadsReturn | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * `GamepadsProvider` mounts a single `useGamepads` polling loop and makes the
 * result available anywhere in the component tree via `useGamepadsContext` or
 * `withGamepads`. Accepts all the same props as `useGamepads`.
 *
 * ```tsx
 * function App() {
 *   return (
 *     <GamepadsProvider controllerProfile="playstation" onA={() => jump()}>
 *       <Game />
 *     </GamepadsProvider>
 *   );
 * }
 * ```
 */
export const GamepadsProvider: React.FC<UseGamepadsProps & { children: React.ReactNode }> = ({
  children,
  ...props
}) => {
  const value = useGamepads(props);
  return <GamepadsContext.Provider value={value}>{children}</GamepadsContext.Provider>;
};

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * Reads the current gamepad state from the nearest `GamepadsProvider`.
 * Throws a descriptive error if used outside a provider.
 *
 * ```tsx
 * function HUD() {
 *   const { gamepad, buttonLabels } = useGamepadsContext();
 *   return <p>Press {buttonLabels.A} to fire</p>;
 * }
 * ```
 */
export const useGamepadsContext = (): UseGamepadsReturn => {
  const ctx = useContext(GamepadsContext);
  if (ctx === null) {
    throw new Error(
      'useGamepadsContext must be used within a <GamepadsProvider>.\n' +
      'Wrap your component tree: <GamepadsProvider><YourComponent /></GamepadsProvider>',
    );
  }
  return ctx;
};

// ---------------------------------------------------------------------------
// HOC
// ---------------------------------------------------------------------------

/** The props injected by `withGamepads`. */
export type WithGamepadsProps = UseGamepadsReturn;

/**
 * Higher-order component that injects gamepad state from the nearest
 * `GamepadsProvider` as props. Useful for class components that cannot
 * call hooks directly.
 *
 * ```tsx
 * interface Props extends WithGamepadsProps {
 *   playerName: string;
 * }
 *
 * class PlayerHUD extends React.Component<Props> {
 *   render() {
 *     const { gamepad, buttonLabels, playerName } = this.props;
 *     return <p>{playerName}: press {buttonLabels.A} to jump</p>;
 *   }
 * }
 *
 * export default withGamepads(PlayerHUD);
 *
 * // Usage (GamepadsProvider must be an ancestor):
 * // <GamepadsProvider><PlayerHUD playerName="P1" /></GamepadsProvider>
 * ```
 */
export function withGamepads<P extends object>(
  Component: React.ComponentType<P & WithGamepadsProps>,
): React.FC<Omit<P, keyof WithGamepadsProps>> {
  const displayName = (Component as any).displayName ?? Component.name ?? 'Component';

  const WithGamepads: React.FC<Omit<P, keyof WithGamepadsProps>> = (props) => {
    const gamepadProps = useGamepadsContext();
    return <Component {...(props as P)} {...gamepadProps} />;
  };

  WithGamepads.displayName = `withGamepads(${displayName})`;
  return WithGamepads;
}
