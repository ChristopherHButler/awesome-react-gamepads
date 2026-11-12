import { reconnectUsbGamepads, disconnectUsbGamepads, MIN_PRESS_MS } from '../webusb/usbGamepads';

function report(lo: number, hi = 0): DataView {
  const v = new DataView(new ArrayBuffer(20));
  v.setUint8(0, 0x00); v.setUint8(1, 0x14); v.setUint8(2, lo); v.setUint8(3, hi);
  return v;
}

/** Fake WebUSB XInput device that hands out queued reports. */
function fakeDevice(queue: DataView[]) {
  let waiting: ((r: any) => void) | null = null;
  const device: any = {
    vendorId: 0x1430, productId: 0x4748, productName: 'Guitar Hero X-plorer', opened: false,
    configuration: { interfaces: [{ interfaceNumber: 0, alternates: [{ interfaceClass: 0xff, interfaceSubclass: 0x5d, interfaceProtocol: 0x01,
      endpoints: [{ direction: 'in', endpointNumber: 1 }, { direction: 'out', endpointNumber: 2 }] }] }] },
    open: async () => { device.opened = true; },
    close: async () => { device.opened = false; waiting?.({ status: 'ok', data: null }); },
    claimInterface: async () => {},
    transferOut: async () => ({ status: 'ok' }),
    transferIn: () => new Promise(res => {
      const next = queue.shift();
      if (next) res({ status: 'ok', data: next }); else waiting = res;
    }),
    push: (d: DataView) => { const w = waiting; waiting = null; if (w) w({ status: 'ok', data: d }); else queue.push(d); },
  };
  return device;
}

const flush = () => new Promise(r => setTimeout(r, 0));

describe('WebUSB virtual gamepads', () => {
  let device: any;
  let clock = 1000;

  beforeAll(() => {
    // Native list is empty; the WebUSB layer wraps this once, on first use.
    Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true, writable: true });
  });

  beforeEach(() => {
    jest.spyOn(performance, 'now').mockImplementation(() => clock);
    jest.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    device = fakeDevice([]);
    Object.defineProperty(navigator, 'usb', {
      configurable: true,
      value: { getDevices: async () => [device], requestDevice: async () => device, addEventListener: () => {} },
    });
  });

  afterEach(async () => {
    await disconnectUsbGamepads();
    jest.restoreAllMocks();
  });

  it('exposes the device through navigator.getGamepads()', async () => {
    const infos = await reconnectUsbGamepads();
    expect(infos).toHaveLength(1);
    const pads = navigator.getGamepads().filter(Boolean) as Gamepad[];
    expect(pads[0].id).toContain('Guitar Hero X-plorer');
    expect(pads[0].mapping).toBe('standard');
  });

  it('keeps a quick strum flick visible for MIN_PRESS_MS', async () => {
    await reconnectUsbGamepads();
    device.push(report(0x01)); // strum up down...
    await flush();
    clock += 5;
    device.push(report(0x00)); // ...and released 5 ms later, before anyone polled
    await flush();

    const read = () => (navigator.getGamepads().find(Boolean) as Gamepad).buttons[12].pressed;
    clock += 10;
    expect(read()).toBe(true);           // a 60 fps poll still sees the strum
    clock += MIN_PRESS_MS;
    expect(read()).toBe(false);          // and it releases afterwards
  });

  it('releases a held fret immediately', async () => {
    await reconnectUsbGamepads();
    device.push(report(0x00, 0x10));     // green fret down
    await flush();
    clock += 300;                        // held for a while
    device.push(report(0x00, 0x00));     // released
    await flush();
    clock += 1;
    expect((navigator.getGamepads().find(Boolean) as Gamepad).buttons[0].pressed).toBe(false);
  });
});
