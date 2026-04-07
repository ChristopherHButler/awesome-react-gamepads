# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A React hook library wrapping the native browser [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API). The primary export is `useGamepads`, a hook that provides real-time gamepad input via callbacks and custom DOM events. Context and HOC wrappers are planned but not yet implemented.

## Commands

```bash
npm run build         # Rollup production build → lib/ (CJS, ESM, UMD)
npm run compile       # TypeScript compile only (all three tsconfigs)
npm run lint          # TSLint
npm run format        # Prettier
npm run test          # Jest (jestconfig.json — note: this file is not yet created)
```

`prepublish` removes `lib/` and runs `build`. `postbuild` packs and unpacks the tarball for inspection, then cleans up.

## Architecture

### Source (`src/`)

- `index.ts` — re-exports `useGamepads` from the hook
- `hooks/useGamepads.ts` — all logic lives here (~500 lines); polls `navigator.getGamepads()` via `requestAnimationFrame`, tracks button state (down/up/change), analog stick axes with dead zones, and Konami code sequences
- `constants/interfaces.ts` — core TypeScript interfaces: `ButtonDetails`, `AxesDetails`, `ReactGamepad`
- `models/XboxControllerMappings.ts` — maps button/axes indices to human-readable names (Xbox 360 layout)
- `contexts/GamepadsContext.tsx` — context implementation, marked `[HOLD]`, not exported to npm yet
- `components/Controller.tsx` — demo-only component, not published

### Build Output (`lib/`)

Three bundle formats, driven by `rollup.config.js` + three `tsconfig*.json` files:

| File | Format | Entry in package.json |
|---|---|---|
| `lib/index.js` | CJS | `main` |
| `lib/index.es.js` | ESM | `module` |
| `lib/index.umd.js` | UMD | `browser` |
| `lib/index.d.ts` | Types | `types` |

### Hook API

```typescript
useGamepads(options?: UseGamepadsProps): ReactGamepad
```

**Callbacks** (all optional): `onConnect`, `onDisconnect`, `onUpdate`, `onGamepadButtonDown`, `onGamepadButtonUp`, `onGamepadButtonChange`, `onGamepadAxesChange`, `onLeftStickRight/Left/Up/Down`, `onRightStickRight/Left/Up/Down`, `onKonamiSuccess`

**Custom DOM events dispatched**: `gamepadconnected`, `gamepaddisconnected`, `gamepadupdated`, `gamepadbuttondown`, `gamepadbuttonup`, `gamepadbuttonchange`, `axeschange`, `leftStickX*`, `leftStickY*`, `rightStickX*`, `rightStickY*`

## Notes

- The `dependencies` field in `package.json` contains React Native packages that are not used — likely leftover from an earlier design.
- No tests exist yet; `jestconfig.json` is referenced in scripts but not created.
- The `src/` directory is listed in `.gitignore` — verify this before assuming source changes persist.
