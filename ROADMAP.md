# Roadmap

## Goal

Make `awesome-react-gamepads` the best — and best maintained — React gamepad library on npm.

The competition is frozen. The ecosystem is underserved. This package already has a better API design than anything out there. The work is: finish it, prove it, and ship it.

### The bigger picture

This library and [cdbx.ai](https://cdbx.ai) (an in-development web-based development platform) are intentionally linked. The demo app and games will run on cdbx.ai — not CodeSandbox, StackBlitz, or any competitor platform. The library is a natural flagship use case for cdbx.ai (browser game development), and cdbx.ai is the best possible showcase for the library. The two products drive each other's audiences.

---

## Phase 1 — Fix the Foundation ✅

> Get the house in order before adding rooms.

- [x] Remove `src/` from `.gitignore` and commit all source files
- [x] Fix `package.json` — remove the stray React Native packages from `dependencies`
- [x] Create `jestconfig.json` and write tests:
  - Button state transitions (down → up → change)
  - Dead zone math (values below threshold round to 0)
  - Konami code sequence detection
  - Axes change detection
- [x] Add SSR / Next.js compatibility — guard all `navigator` and `window` calls with `typeof window !== 'undefined'` so the hook does not throw in server-rendered apps
- [x] Remove the "⚠️ UNDER DEVELOPMENT ⚠️" banner from README
- [x] Replace the `tslint` setup with `eslint` (TSLint has been deprecated since 2019)

**Exit criteria:** `npm run test`, `npm run lint`, and `npm run build` all pass cleanly. Hook works in a Next.js app without SSR errors.

---

## Phase 2 — Complete the Hook API ✅

> Deliver everything that is currently marked `[HOLD]`, plus features no competitor has.

- [x] Implement per-button callbacks: `onA`, `onB`, `onX`, `onY`, `onStart`, `onSelect`, `onLB`, `onRB`, `onLT`, `onRT`, `onLS`, `onRS`, `onDPadUp`, `onDPadDown`, `onDPadLeft`, `onDPadRight`, `onXBoxLogo`
- [x] Add **haptic/vibration support** — expose a `rumble` function on the hook return value wrapping `GamepadHapticActuator.playEffect()`. No other React gamepad package does this.
- [x] Add **button hold / long-press detection** — `onGamepadButtonHold` callback with a configurable `holdThreshold` (ms). Distinguishes tap vs. hold (e.g. tap A to jump, hold A to charge).
- [x] Add **polling rate control** — a `pollRate` option (ms) for use cases that don't need 60fps (UI navigation, accessibility). Default keeps `requestAnimationFrame` behaviour.
- [x] Add `useGamepad(index: number)` — a single-controller variant of the hook for multiplayer use cases
- [x] Add dead zone presets: accept `"none" | "small" | "medium" | "large"` in addition to raw numbers
- [x] Add `useDebugValue` inside the hook so gamepad state displays correctly in React DevTools
- [x] Update README — remove all `[HOLD]` markers, document new APIs

**Exit criteria:** Full Props API is implemented with no placeholders remaining.

---

## Phase 3 — Controller Profiles ✅

> Make the library useful for non-Xbox controllers.

- [x] Add a `controllerProfile` option: `"xbox" | "playstation" | "switch" | "generic"`
- [x] Map named button callbacks (`onA`, `onB`, etc.) to the correct indices per profile — PlayStation uses Cross/Circle/Square/Triangle, Switch uses B/A/Y/X (swapped from Xbox)
- [x] Expose the active profile on the hook return value so apps can render the correct button labels
- [x] Document the Standard Gamepad mapping and how profiles sit on top of it

**Exit criteria:** Per-button callbacks fire correctly on a PS4/PS5 controller with `controllerProfile: "playstation"`.

---

## Phase 4 — Combo & Sequence System

> A general combo engine, not just Konami code.

- [ ] Extract and generalize the existing Konami detection logic into a reusable `useGamepadSequence(sequence, callback, options?)` hook
- [ ] Support configurable timeout between inputs (how long the player has to complete the sequence)
- [ ] Support both button name sequences (`["A", "B", "A"]`) and raw index sequences
- [ ] Keep `onKonamiSuccess` working as a convenience wrapper over the new system
- [ ] Ship as a named export so it can be used standalone without `useGamepads`

**Exit criteria:** Developers can define arbitrary button combos (fighting game inputs, cheat codes, etc.) with a single hook call.

---

## Phase 5 — Context & HOC

> Match what `react-gamepads` planned but never finished.

- [ ] Publish `GamepadsContext` and `GamepadsProvider` — wraps the hook so the full gamepad state is available anywhere in the tree without prop drilling
- [ ] Publish HOC `withGamepads(Component)` — for class components and simpler wrapping use cases
- [ ] Update README with Context and HOC usage examples

**Exit criteria:** All three APIs (hook, context, HOC) are exported and documented.

---

## Phase 6 — Demo App & Games

> The killer differentiator. Users need to *feel* the library, not just read about it.

_Note: Demo will be built in a dedicated app and hosted on cdbx.ai. This is intentional — the demo is also a showcase for what you can build on that platform._

### Controller Visualizer

A real-time visual display of the connected gamepad state:
- All buttons highlighted on press (with layouts for Xbox, PlayStation, and Switch)
- Analog stick positions shown as dots in a circular field
- Trigger values shown as fill bars
- Vibration test UI (fire rumble patterns and feel the result)
- Live event log showing which callbacks fire and when
- Profile switcher to demonstrate multi-controller support

This functions as both a demo and a debugging tool developers can use during their own development.

### Games

Build at least two small playable games that prove the library works end-to-end:

**Game 1 — Something simple** (input feel, directional movement)
- e.g. a classic maze/platformer or snake variant
- Tests: analog sticks, d-pad, A/B buttons, dead zone behavior

**Game 2 — Something with a twist** (showcase a unique library feature)
- e.g. a two-player game using `useGamepad(0)` and `useGamepad(1)`, or a mode unlocked by entering a custom combo sequence
- Tests: multi-controller support, combo system, rumble feedback

### Publish the games
- Host and play both games on cdbx.ai — they become proof that the platform supports real game development
- Release on [itch.io](https://itch.io) as free/pay-what-you-want titles as well, linking back to both the library and cdbx.ai
- The games serve triple duty: library demo, cdbx.ai showcase, standalone products

**Exit criteria:** Demo is deployed and linked from the README and npm page. Both games are playable and published.

---

## Phase 7 — Publish v1.0.0

> Signal that this is stable, maintained, and production-ready.

- [ ] Audit and lock down the public API — anything not intended to be public should be unexported
- [ ] Write a `CHANGELOG.md` starting from v0.1.7
- [ ] Add browser compatibility table to README (Chrome/Edge full support, Firefox no haptics, Safari limited)
- [ ] Set up GitHub Actions CI (lint + test on push/PR)
- [ ] Set up a documentation site (Docusaurus) to replace the README as the primary reference
- [ ] Publish v1.0.0 to npm
- [ ] Update the npm description and keywords for discoverability

**Exit criteria:** `npm publish` succeeds, the npm page shows v1.0.0 with a recent publish date, and the docs site is live.

---

## Monetization

The library itself stays free and open source. The ecosystem around it is where revenue comes from.

**Near-term (low effort):**
- **GitHub Sponsors** — set up once v1.0.0 ships and the library has credibility. Won't generate significant income but legitimizes the project and some companies sponsor dependencies they rely on.

**Medium-term (tied to the demo app):**
- **Hosted gamepad testing tool on cdbx.ai** — the Controller Visualizer from Phase 6, polished and deployed as a standalone product. Think gamepad-tester.com but React-powered, with multi-profile support, event logging, and vibration testing. Drives developers to cdbx.ai and demonstrates what the platform can host.
- **Games on cdbx.ai + itch.io** — pay-what-you-want or small fixed price. Each game is simultaneously a library demo, a platform showcase, and a standalone product.
- **cdbx.ai cross-promotion** — when cdbx.ai launches, awesome-react-gamepads is a featured first-party library. Developers who discover the library discover the platform; developers who discover the platform discover the library.

**Long-term:**
- **Course / content** — deep expertise in browser gamepad input is rare. A course on building browser games with React, centered on this library, is a natural product once the library has an audience.
- **Consulting** — "the person who built the best React gamepad library" is a credible position for web game studio work.

---

## Parking Lot

Ideas worth revisiting after v1.0.0:

- **React Native support** — the stray RN packages in `package.json` suggest this was considered; revisit if there's community demand
- **Accessibility utilities** — gamepad as a navigation device for web UIs, not just games; helpers for remapping buttons to keyboard/ARIA equivalents
- **`useGamepadAnalog`** — a hook focused purely on analog values (triggers, sticks) with smoothing and interpolation options for non-game UI use cases
