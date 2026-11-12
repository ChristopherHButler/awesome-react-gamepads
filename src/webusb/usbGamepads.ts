/**
 * WebUSB support for wired XInput (Xbox 360-protocol) controllers, e.g. the
 * RedOctane Guitar Hero X-plorer guitar.
 *
 * Why: macOS ships no driver for XInput devices, so the browser's Gamepad API
 * never sees them. Nothing claims their vendor-specific USB interface either,
 * so Chrome/Edge can open it with WebUSB and read the raw input report.
 *
 * How: each opened device becomes a "virtual" Gamepad (standard mapping) that is
 * merged into `navigator.getGamepads()` and announced with `gamepadconnected`.
 * Everything built on the Gamepad API — including `useGamepads` — then just works.
 *
 * Limits:
 *  - Chrome / Edge / Opera only (no WebUSB in Safari or Firefox).
 *  - Needs a secure context (https or http://localhost).
 *  - The first connection must come from a user gesture (a click) that calls
 *    `requestUsbGamepad()`; the browser shows a device picker once. After that the
 *    permission is remembered for the site and devices reconnect automatically.
 *  - Inside an iframe, the iframe needs `allow="usb"`.
 *  - On Windows/Linux the OS driver owns the device, so this isn't needed (and
 *    claiming will fail); the guitar already shows up in the Gamepad API there.
 */

const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';

/** USB filters for XInput devices (class 0xFF, subclass 0x5D, protocol 0x01). */
export const XINPUT_USB_FILTERS = [
  { classCode: 0xff, subclassCode: 0x5d, protocolCode: 0x01 },
  { vendorId: 0x1430 }, // RedOctane (Guitar Hero X-plorer)
  { vendorId: 0x1bad }, // Harmonix / Mad Catz (Rock Band)
];

/** Microsoft's own pads already work in Chrome on macOS; don't fight its driver for them. */
const SKIP_VENDORS = new Set([0x045e]);

export interface UsbGamepadInfo {
  index: number;
  id: string;
  vendorId: number;
  productId: number;
  productName: string;
}

interface VirtualPad {
  device: any;
  index: number;
  id: string;
  /** Latest state parsed from the device. */
  snapshot: Gamepad;
  /** performance.now() at which each button was last pressed down. */
  downAt: number[];
}

/**
 * Minimum time a press stays visible to readers. A guitar strum bar is a flick that
 * can go down and up within ~10-20 ms — faster than a 60 fps polling loop — so
 * without this, most strums would never be seen by `getGamepads()` callers.
 */
export const MIN_PRESS_MS = 50;

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Snapshot for readers. A press that was released before MIN_PRESS_MS had passed still
 * reads as pressed until MIN_PRESS_MS after it started. Held buttons (frets) release
 * immediately, so moving between frets isn't delayed.
 */
function readSnapshot(pad: VirtualPad): Gamepad {
  const t = nowMs();
  const buttons = pad.snapshot.buttons.map((b, i) =>
    !b.pressed && t - (pad.downAt[i] ?? -Infinity) < MIN_PRESS_MS
      ? ({ pressed: true, touched: true, value: 1 } as GamepadButton)
      : b,
  );
  return { ...pad.snapshot, buttons, timestamp: t } as unknown as Gamepad;
}

const pads = new Map<any, VirtualPad>();
const listeners = new Set<() => void>();
let installed = false;
let originalGetGamepads: ((() => (Gamepad | null)[]) | null) = null;

const hex4 = (n: number) => n.toString(16).padStart(4, '0');

export function isUsbGamepadSupported(): boolean {
  return isBrowser && !!(navigator as any).usb && (typeof window === 'undefined' || window.isSecureContext !== false);
}

/** Parses a 20-byte wired XInput report into a standard-mapping Gamepad snapshot. */
export function parseXInputReport(data: DataView, base: { id: string; index: number }): Gamepad | null {
  if (data.byteLength < 14 || data.getUint8(0) !== 0x00) return null;
  const lo = data.getUint8(2);
  const hi = data.getUint8(3);
  const lt = data.getUint8(4) / 255;
  const rt = data.getUint8(5) / 255;
  const axis = (offset: number) => Math.max(-1, data.getInt16(offset, true) / 32767);

  const btn = (pressed: boolean, value = pressed ? 1 : 0): GamepadButton =>
    ({ pressed, touched: pressed, value } as GamepadButton);

  const buttons: GamepadButton[] = [
    btn(!!(hi & 0x10)),            // 0  A
    btn(!!(hi & 0x20)),            // 1  B
    btn(!!(hi & 0x40)),            // 2  X
    btn(!!(hi & 0x80)),            // 3  Y
    btn(!!(hi & 0x01)),            // 4  LB
    btn(!!(hi & 0x02)),            // 5  RB
    btn(lt > 0.12, lt),            // 6  LT
    btn(rt > 0.12, rt),            // 7  RT
    btn(!!(lo & 0x20)),            // 8  Back
    btn(!!(lo & 0x10)),            // 9  Start
    btn(!!(lo & 0x40)),            // 10 LS
    btn(!!(lo & 0x80)),            // 11 RS
    btn(!!(lo & 0x01)),            // 12 D-up
    btn(!!(lo & 0x02)),            // 13 D-down
    btn(!!(lo & 0x04)),            // 14 D-left
    btn(!!(lo & 0x08)),            // 15 D-right
    btn(!!(hi & 0x04)),            // 16 Guide
  ];
  // XInput Y axes are "up = positive"; the standard mapping is "up = negative".
  const axes = [axis(6), -axis(8), axis(10), -axis(12)];

  return {
    id: base.id,
    index: base.index,
    connected: true,
    mapping: 'standard',
    timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    buttons,
    axes,
    vibrationActuator: null,
    hapticActuators: [],
  } as unknown as Gamepad;
}

function emptySnapshot(id: string, index: number): Gamepad {
  const view = new DataView(new ArrayBuffer(20));
  view.setUint8(1, 0x14);
  return parseXInputReport(view, { id, index }) as Gamepad;
}

function notify() {
  listeners.forEach(l => { try { l(); } catch { /* ignore */ } });
}

function dispatch(type: 'gamepadconnected' | 'gamepaddisconnected', gamepad: Gamepad) {
  const event = new Event(type);
  Object.defineProperty(event, 'gamepad', { value: gamepad });
  window.dispatchEvent(event);
}

function nativeGamepads(): (Gamepad | null)[] {
  return originalGetGamepads ? Array.from(originalGetGamepads() ?? []) : [];
}

function freeIndex(): number {
  const native = nativeGamepads();
  const used = new Set<number>([...pads.values()].map(p => p.index));
  for (let i = 0; ; i++) {
    if (!native[i] && !used.has(i)) return i;
  }
}

/** Merges virtual pads into navigator.getGamepads(). Idempotent. */
function install() {
  if (installed || !isBrowser) return;
  installed = true;
  const nav = navigator as any;
  originalGetGamepads = typeof nav.getGamepads === 'function' ? nav.getGamepads.bind(nav) : () => [];
  Object.defineProperty(nav, 'getGamepads', {
    configurable: true,
    writable: true,
    value: () => {
      const list = nativeGamepads();
      for (const pad of pads.values()) {
        while (list.length <= pad.index) list.push(null);
        if (!list[pad.index]) list[pad.index] = readSnapshot(pad);
      }
      return list;
    },
  });

  const usb = nav.usb;
  if (usb) {
    usb.addEventListener('connect', (e: any) => { openDevice(e.device).catch(() => {}); });
    usb.addEventListener('disconnect', (e: any) => { removeDevice(e.device); });
  }
}

function removeDevice(device: any) {
  const pad = pads.get(device);
  if (!pad) return;
  pads.delete(device);
  dispatch('gamepaddisconnected', { ...pad.snapshot, connected: false } as Gamepad);
  notify();
}

async function openDevice(device: any): Promise<UsbGamepadInfo | null> {
  if (SKIP_VENDORS.has(device.vendorId)) return null;
  if (pads.has(device)) return toInfo(pads.get(device)!);

  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);

  const ifaces: any[] = device.configuration.interfaces;
  const iface = ifaces.find(i => {
    const alt = i.alternates[0];
    return alt.interfaceClass === 0xff && alt.interfaceSubclass === 0x5d && alt.interfaceProtocol === 0x01;
  });
  if (!iface) { await device.close().catch(() => {}); return null; }

  const alt = iface.alternates[0];
  const epIn = alt.endpoints.find((e: any) => e.direction === 'in');
  const epOut = alt.endpoints.find((e: any) => e.direction === 'out');
  await device.claimInterface(iface.interfaceNumber);

  const id = `${device.productName || 'XInput controller'} (WebUSB, Vendor: ${hex4(device.vendorId)} Product: ${hex4(device.productId)})`;
  const index = freeIndex();
  const pad: VirtualPad = { device, index, id, snapshot: emptySnapshot(id, index), downAt: [] };
  pads.set(device, pad);

  // Player-1 LED, like the Linux xpad driver. Harmless if unsupported.
  if (epOut) device.transferOut(epOut.endpointNumber, new Uint8Array([0x01, 0x03, 0x06])).catch(() => {});

  dispatch('gamepadconnected', pad.snapshot);
  notify();
  readLoop(pad, epIn.endpointNumber);
  return toInfo(pad);
}

async function readLoop(pad: VirtualPad, endpoint: number) {
  try {
    while (pads.get(pad.device) === pad && pad.device.opened) {
      const r = await pad.device.transferIn(endpoint, 32);
      if (r.status === 'stall') { await pad.device.clearHalt('in', endpoint).catch(() => {}); continue; }
      if (r.status !== 'ok' || !r.data) continue;
      const snap = parseXInputReport(r.data, { id: pad.id, index: pad.index });
      if (snap) {
        const t = nowMs();
        snap.buttons.forEach((b, i) => { if (b.pressed && !pad.snapshot.buttons[i].pressed) pad.downAt[i] = t; });
        pad.snapshot = snap;
      }
    }
  } catch {
    // Device unplugged or closed.
  }
  removeDevice(pad.device);
}

function toInfo(pad: VirtualPad): UsbGamepadInfo {
  return {
    index: pad.index,
    id: pad.id,
    vendorId: pad.device.vendorId,
    productId: pad.device.productId,
    productName: pad.device.productName,
  };
}

/**
 * Shows the browser's USB device picker and connects the chosen controller.
 * Must be called from a user gesture (e.g. a button click).
 * Resolves to `null` if the user cancels or the device isn't an XInput controller.
 */
export async function requestUsbGamepad(): Promise<UsbGamepadInfo | null> {
  if (!isUsbGamepadSupported()) throw new Error('WebUSB is not available (use Chrome or Edge over https or localhost).');
  install();
  let device: any;
  try {
    device = await (navigator as any).usb.requestDevice({ filters: XINPUT_USB_FILTERS });
  } catch {
    return null; // user cancelled the picker
  }
  return openDevice(device);
}

/**
 * Reconnects controllers the user has already granted to this site.
 * Safe to call on page load (no user gesture needed). Also enables hot-plugging.
 */
export async function reconnectUsbGamepads(): Promise<UsbGamepadInfo[]> {
  if (!isUsbGamepadSupported()) return [];
  install();
  const devices: any[] = await (navigator as any).usb.getDevices();
  const result: UsbGamepadInfo[] = [];
  for (const d of devices) {
    try {
      const info = await openDevice(d);
      if (info) result.push(info);
    } catch {
      // Claimed by another tab/driver — skip.
    }
  }
  return result;
}

/** Currently connected WebUSB controllers. */
export function getUsbGamepads(): UsbGamepadInfo[] {
  return [...pads.values()].map(toInfo);
}

/** Disconnects all WebUSB controllers (they can be reconnected without the picker). */
export async function disconnectUsbGamepads(): Promise<void> {
  for (const pad of [...pads.values()]) {
    pads.delete(pad.device);
    await pad.device.close().catch(() => {});
    dispatch('gamepaddisconnected', { ...pad.snapshot, connected: false } as Gamepad);
  }
  notify();
}

/** Subscribe to WebUSB controller connect/disconnect. Returns an unsubscribe function. */
export function subscribeUsbGamepads(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
