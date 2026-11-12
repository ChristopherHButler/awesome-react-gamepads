import { useCallback, useEffect, useState } from 'react';
import {
  UsbGamepadInfo,
  getUsbGamepads,
  isUsbGamepadSupported,
  reconnectUsbGamepads,
  requestUsbGamepad,
  subscribeUsbGamepads,
} from '../webusb/usbGamepads';

export interface UseUsbGamepadsReturn {
  /** True when the browser has WebUSB (Chrome/Edge on https or localhost). */
  supported: boolean;
  /** WebUSB controllers currently connected. */
  devices: UsbGamepadInfo[];
  /** Opens the browser's device picker. Call from a click handler. */
  connect: () => Promise<UsbGamepadInfo | null>;
  /** Last error from `connect`, if any. */
  error: string | null;
}

/**
 * Connects wired Xbox 360-protocol controllers (e.g. Guitar Hero X-plorer) over WebUSB,
 * for platforms like macOS where the Gamepad API can't see them. Once connected, they
 * appear to `useGamepads` like any other controller.
 *
 * Previously granted devices reconnect automatically when this hook mounts.
 *
 * ```tsx
 * const usb = useUsbGamepads();
 * const { gamepad } = useGamepads({ controllerProfile: 'guitar', onGreenFret: ... });
 * {usb.supported && !gamepad && <button onClick={usb.connect}>Connect guitar</button>}
 * ```
 */
export function useUsbGamepads(): UseUsbGamepadsReturn {
  const [devices, setDevices] = useState<UsbGamepadInfo[]>(() => getUsbGamepads());
  const [error, setError] = useState<string | null>(null);
  const supported = isUsbGamepadSupported();

  useEffect(() => {
    const unsubscribe = subscribeUsbGamepads(() => setDevices(getUsbGamepads()));
    reconnectUsbGamepads().catch(() => {});
    return unsubscribe;
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try {
      return await requestUsbGamepad();
    } catch (e: any) {
      setError(e?.message ?? String(e));
      return null;
    }
  }, []);

  return { supported, devices, connect, error };
}
