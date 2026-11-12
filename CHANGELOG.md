# Changelog

## 1.1.0

### Added
- **Guitar controllers** — new `guitar` controller profile for Xbox 360 guitars (Guitar Hero X-plorer and compatibles), with
  `onGreenFret`, `onRedFret`, `onYellowFret`, `onBlueFret`, `onOrangeFret`, `onStrumUp`, `onStrumDown`, `onStarPower`
  (falls back to `onSelect`), `onWhamBar` and `onTilt`.
- **macOS support for wired Xbox 360 / XInput controllers via WebUSB** — `useUsbGamepads()` (plus `requestUsbGamepad`,
  `reconnectUsbGamepads`, `getUsbGamepads`, `disconnectUsbGamepads`, `subscribeUsbGamepads`, `isUsbGamepadSupported`).
  Connected devices appear in `navigator.getGamepads()`, so existing hooks work unchanged. Chrome / Edge, secure context,
  one-time Connect click; reconnects automatically.
- `MIN_PRESS_MS`: very short presses (e.g. a strum-bar flick) stay visible for at least 50 ms so polling can't miss them.
- `parseXInputReport` and `XINPUT_USB_FILTERS` exports.

### Fixed
- Changing `controllerProfile` at runtime now works — button and axis state is rebuilt under the new profile's names
  (previously buttons from the new profile were ignored).

### Demo
- Guitar Jam: a Guitar Hero-style game with Kid and Normal modes, built-in public-domain songs, a song editor,
  Clone Hero / YARG chart import (.zip, drag & drop), guitar tones, speed control, pause menu and progress bar.
- USB Debug page and a header button to connect a USB guitar.
