import { useEffect, useState } from 'react';
import { useUsbGamepads } from 'awesome-react-gamepads';
import Sidebar from './components/Sidebar';
import Visualizer from './components/Visualizer';
import Inspector from './components/Inspector';
import Docs from './components/Docs';
import HidDebug from './components/HidDebug';
import UsbDebug from './components/UsbDebug';
import Snake from './games/Snake';
import Pong from './games/Pong';
import Tetris from './games/Tetris';
import GuitarJam from './games/GuitarJam';

type View = 'visualizer' | 'inspector' | 'docs' | 'snake' | 'pong' | 'tetris' | 'hid-debug' | 'usb-debug' | 'guitar-jam';

export default function App() {
  const [view, setView] = useState<View>('visualizer');
  const usb = useUsbGamepads();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span>🎮</span> awesome-react-gamepads
        </div>
        {usb.supported && (
          <button
            className="rumble-btn"
            style={{ marginLeft: 'auto', marginRight: 8 }}
            onClick={usb.connect}
            title="Connect a wired Xbox 360 / Guitar Hero controller over WebUSB (needed on macOS)"
          >
            {usb.devices.length ? `🎸 ${usb.devices[0].productName}` : '🎸 Connect USB guitar'}
          </button>
        )}
        <button
          className="theme-btn"
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>
      <div className="app-body">
        <Sidebar view={view} onNavigate={setView} />
        <main className="app-main">
          {view === 'visualizer' && <Visualizer />}
          {view === 'inspector'  && <Inspector />}
          {view === 'docs'       && <Docs />}
          {view === 'snake'      && <Snake />}
          {view === 'pong'       && <Pong />}
          {view === 'tetris'     && <Tetris />}
          {view === 'guitar-jam' && <GuitarJam />}
          {view === 'hid-debug'  && <HidDebug />}
          {view === 'usb-debug'  && <UsbDebug />}
        </main>
      </div>
    </div>
  );
}
