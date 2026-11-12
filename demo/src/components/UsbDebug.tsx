import { useEffect, useRef, useState } from 'react';

/**
 * WebUSB debug view for wired Xbox 360 (XInput) devices such as the
 * RedOctane Guitar Hero X-plorer (VID 0x1430, PID 0x4748).
 *
 * macOS has no driver for XInput devices, so they never reach the Gamepad API.
 * Because nothing claims the vendor-specific interface, WebUSB can open it and
 * read the raw 20-byte input report directly.
 *
 * Report layout (wired XInput):
 *   [0] 0x00 message type   [1] 0x14 length
 *   [2] bits: 0 D-up, 1 D-down, 2 D-left, 3 D-right, 4 Start, 5 Back, 6 LS, 7 RS
 *   [3] bits: 0 LB, 1 RB, 2 Guide, 4 A, 5 B, 6 X, 7 Y
 *   [4] LT  [5] RT  [6-7] LX  [8-9] LY  [10-11] RX  [12-13] RY  (int16 LE)
 */

interface XInputState {
  up: boolean; down: boolean; left: boolean; right: boolean;
  start: boolean; back: boolean; ls: boolean; rs: boolean;
  lb: boolean; rb: boolean; guide: boolean;
  a: boolean; b: boolean; x: boolean; y: boolean;
  lt: number; rt: number;
  lx: number; ly: number; rx: number; ry: number;
}

const FILTERS = [
  { vendorId: 0x1430 },                      // RedOctane
  { classCode: 0xff, subclassCode: 0x5d },   // any XInput device
];

const hex4 = (n: number) => '0x' + n.toString(16).padStart(4, '0');

function parse(d: DataView): XInputState {
  const lo = d.getUint8(2);
  const hi = d.getUint8(3);
  return {
    up: !!(lo & 0x01), down: !!(lo & 0x02), left: !!(lo & 0x04), right: !!(lo & 0x08),
    start: !!(lo & 0x10), back: !!(lo & 0x20), ls: !!(lo & 0x40), rs: !!(lo & 0x80),
    lb: !!(hi & 0x01), rb: !!(hi & 0x02), guide: !!(hi & 0x04),
    a: !!(hi & 0x10), b: !!(hi & 0x20), x: !!(hi & 0x40), y: !!(hi & 0x80),
    lt: d.getUint8(4), rt: d.getUint8(5),
    lx: d.getInt16(6, true), ly: d.getInt16(8, true),
    rx: d.getInt16(10, true), ry: d.getInt16(12, true),
  };
}

const FRETS: { key: keyof XInputState; label: string; color: string }[] = [
  { key: 'a',  label: 'Green',  color: '#22c55e' },
  { key: 'b',  label: 'Red',    color: '#ef4444' },
  { key: 'y',  label: 'Yellow', color: '#eab308' },
  { key: 'x',  label: 'Blue',   color: '#3b82f6' },
  { key: 'lb', label: 'Orange', color: '#f97316' },
];

const PILLS: { key: keyof XInputState; label: string }[] = [
  { key: 'up',    label: 'Strum ↑' },
  { key: 'down',  label: 'Strum ↓' },
  { key: 'start', label: 'Start' },
  { key: 'back',  label: 'Back / Star power' },
  { key: 'guide', label: 'Guide' },
];

export default function UsbDebug() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [raw, setRaw] = useState('');
  const [state, setState] = useState<XInputState | null>(null);
  const deviceRef = useRef<any>(null);

  useEffect(() => () => { deviceRef.current?.close().catch(() => {}); }, []);

  async function disconnect() {
    const device = deviceRef.current;
    deviceRef.current = null;
    await device?.close().catch(() => {});
    setStatus('Disconnected.');
  }

  async function requestDevice() {
    setError('');
    setRaw('');
    setState(null);

    const usb = (navigator as any).usb;
    if (!usb) {
      setError('WebUSB is not supported in this browser. Use Chrome or Edge on http://localhost or https.');
      return;
    }

    let device: any;
    try {
      device = await usb.requestDevice({ filters: FILTERS });
    } catch (err: any) {
      setError(`No device selected: ${err.message ?? err}`);
      return;
    }

    setStatus(`Selected: ${device.productName}  (VID ${hex4(device.vendorId)}  PID ${hex4(device.productId)})`);

    let epIn: any;
    let epOut: any;
    try {
      await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);

      const ifaces: any[] = device.configuration.interfaces;
      const iface =
        ifaces.find(i => {
          const alt = i.alternates[0];
          return alt.interfaceClass === 0xff && alt.interfaceSubclass === 0x5d && alt.interfaceProtocol === 0x01;
        }) ?? ifaces[0];
      const alt = iface.alternates[0];
      epIn = alt.endpoints.find((e: any) => e.direction === 'in');
      epOut = alt.endpoints.find((e: any) => e.direction === 'out');

      await device.claimInterface(iface.interfaceNumber);
      setStatus(prev => `${prev}  —  claimed interface ${iface.interfaceNumber} (IN ep ${epIn?.endpointNumber}, OUT ep ${epOut?.endpointNumber}). Press buttons on the guitar.`);
    } catch (err: any) {
      setError(`Could not open/claim device: ${err.message ?? err}\n\nSomething on macOS may already be claiming the interface.`);
      await device.close().catch(() => {});
      return;
    }

    deviceRef.current = device;

    // Set the player-1 LED, as the Linux xpad driver does. Harmless if ignored.
    if (epOut) device.transferOut(epOut.endpointNumber, new Uint8Array([0x01, 0x03, 0x06])).catch(() => {});

    let last = '';
    try {
      while (deviceRef.current === device && device.opened) {
        const r = await device.transferIn(epIn.endpointNumber, 32);
        if (r.status !== 'ok' || !r.data || r.data.byteLength < 14 || r.data.getUint8(0) !== 0x00) continue;
        const bytes = Array.from(new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength));
        const h = bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
        if (h === last) continue;
        last = h;
        setRaw(h);
        setState(parse(r.data));
      }
    } catch (err: any) {
      if (deviceRef.current === device) setError(`Read failed: ${err.message ?? err}`);
    }
  }

  const s = state;
  const stdRows: [string, boolean | number | undefined][] = s ? [
    ['0  A / green', s.a], ['1  B / red', s.b], ['2  X / blue', s.x], ['3  Y / yellow', s.y],
    ['4  LB / orange', s.lb], ['5  RB', s.rb], ['6  LT', s.lt], ['7  RT', s.rt],
    ['8  Back / star power', s.back], ['9  Start', s.start], ['10 LS', s.ls], ['11 RS', s.rs],
    ['12 D-up / strum up', s.up], ['13 D-down / strum down', s.down],
    ['14 D-left', s.left], ['15 D-right', s.right], ['16 Guide', s.guide],
    ['axes[0] LX', s.lx], ['axes[1] LY', s.ly],
    ['axes[2] RX / whammy', s.rx], ['axes[3] RY / tilt', s.ry],
  ] : [];

  const meter = (v: number) => (
    <div style={{ width: 220, height: 8, background: 'var(--surface-raised)', borderRadius: 4, overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle' }}>
      <div style={{ width: `${((v + 32768) / 65535) * 100}%`, height: '100%', background: 'var(--accent)' }} />
    </div>
  );

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>WebUSB Debug (XInput)</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Reads wired Xbox 360 / XInput devices (e.g. Guitar Hero X-plorer) directly over USB,
          bypassing the Gamepad API. Needed on macOS, which has no XInput driver.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="rumble-btn" onClick={requestDevice}>Request USB Device</button>
        {deviceRef.current && <button className="rumble-btn" onClick={disconnect}>Disconnect</button>}
      </div>

      {status && (
        <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--green)', marginBottom: 12 }}>{status}</div>
      )}
      {error && (
        <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--danger)', marginBottom: 12, whiteSpace: 'pre-wrap' }}>{error}</div>
      )}

      {s && (
        <>
          <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
            {FRETS.map(f => {
              const on = !!s[f.key];
              return (
                <div key={f.label} style={{
                  width: 72, height: 72, borderRadius: 8, background: f.color,
                  opacity: on ? 1 : 0.2, boxShadow: on ? `0 0 16px ${f.color}` : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 600, fontSize: 12, color: '#000',
                }}>{f.label}</div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {PILLS.map(p => {
              const on = !!s[p.key];
              return (
                <span key={p.label} style={{
                  padding: '4px 12px', borderRadius: 999, fontSize: 12,
                  background: on ? 'var(--accent)' : 'var(--surface-raised)',
                  color: on ? 'var(--accent-fg)' : 'var(--muted)',
                  border: '1px solid var(--border)',
                }}>{p.label}</span>
              );
            })}
          </div>

          <div style={{ fontSize: 13, display: 'grid', gridTemplateColumns: '200px auto 80px', gap: '6px 12px', alignItems: 'center', marginBottom: 16 }}>
            <span>Whammy (right stick X)</span>{meter(s.rx)}<span style={{ fontFamily: 'monospace' }}>{s.rx}</span>
            <span>Tilt (right stick Y)</span>{meter(s.ry)}<span style={{ fontFamily: 'monospace' }}>{s.ry}</span>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Raw report</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{raw}</div>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Equivalent standard Gamepad indices <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(what Chrome on Windows/Linux reports)</span>
          </div>
          <table style={{ fontFamily: 'monospace', fontSize: 12, borderCollapse: 'collapse' }}>
            <tbody>
              {stdRows.map(([k, v]) => (
                <tr key={k} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '2px 16px 2px 0', color: 'var(--text-secondary)' }}>{k}</td>
                  <td style={{ color: v === true ? 'var(--accent)' : 'var(--muted)' }}>
                    {v === true ? '●' : v === false ? '·' : v}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!s && deviceRef.current && (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Waiting for input…</div>
      )}
    </div>
  );
}
