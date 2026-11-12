import { useState } from 'react';

interface Report {
  ts: string;
  reportId: number;
  hex: string;
}

export default function HidDebug() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [reports, setReports] = useState<Report[]>([]);

  async function requestDevice() {
    setError('');
    setReports([]);

    const hid = (navigator as any).hid;
    if (!hid) {
      setError('WebHID is not supported in this browser. Use Chrome or Edge.');
      return;
    }

    let devices: any[];
    try {
      devices = await hid.requestDevice({ filters: [] });
    } catch (err: any) {
      setError(`Permission denied: ${err.message ?? err}`);
      return;
    }

    if (!devices.length) {
      setStatus('No device selected.');
      return;
    }

    const device = devices[0];
    setStatus(`Selected: ${device.productName}  (VID 0x${device.vendorId.toString(16).padStart(4, '0')}  PID 0x${device.productId.toString(16).padStart(4, '0')})`);

    try {
      await device.open();
    } catch (err: any) {
      setError(`Could not open device: ${err.message ?? err}\n\nmacOS may be claiming it exclusively — WebHID can't override a system driver.`);
      return;
    }

    setStatus(prev => prev + '  —  opened. Press buttons on the guitar.');

    device.addEventListener('inputreport', (e: any) => {
      const bytes = new Uint8Array(e.data.buffer);
      const hex = Array.from(bytes).map((b: number) => b.toString(16).padStart(2, '0')).join(' ');
      const ts = new Date().toISOString().split('T')[1].slice(0, 12);
      setReports(prev => [{ ts, reportId: e.reportId, hex }, ...prev.slice(0, 99)]);
    });
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>WebHID Debug</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Tries to open a HID device directly in the browser, bypassing the Gamepad API.
          Click the button and select your guitar from the browser prompt.
        </div>
      </div>

      <button className="rumble-btn" onClick={requestDevice} style={{ marginBottom: 16 }}>
        Request HID Device
      </button>

      {status && (
        <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--green)', marginBottom: 12 }}>
          {status}
        </div>
      )}

      {error && (
        <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#f87171', marginBottom: 12, whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}

      {reports.length > 0 && (
        <div style={{ fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {reports.map((r, i) => (
            <div key={i} style={{ color: i === 0 ? 'var(--fg)' : 'var(--muted)' }}>
              <span style={{ color: 'var(--muted)', marginRight: 8 }}>{r.ts}</span>
              <span style={{ color: 'var(--blue)', marginRight: 8 }}>id={r.reportId}</span>
              {r.hex}
            </div>
          ))}
        </div>
      )}

      {!reports.length && status.includes('opened') && (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Waiting for input…</div>
      )}
    </div>
  );
}
