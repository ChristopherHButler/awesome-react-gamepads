import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Visualizer from './components/Visualizer';
import Docs from './components/Docs';
import Snake from './games/Snake';
import Pong from './games/Pong';
import Tetris from './games/Tetris';

type View = 'visualizer' | 'docs' | 'snake' | 'pong' | 'tetris';

export default function App() {
  const [view, setView] = useState<View>('visualizer');
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
          {view === 'docs'       && <Docs />}
          {view === 'snake'      && <Snake />}
          {view === 'pong'       && <Pong />}
          {view === 'tetris'     && <Tetris />}
        </main>
      </div>
    </div>
  );
}
