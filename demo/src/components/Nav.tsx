type View = 'visualizer' | 'snake' | 'pong' | 'tetris';

interface Props {
  view: View;
  onNavigate: (v: View) => void;
}

export default function Nav({ view, onNavigate }: Props) {
  return (
    <nav className="nav">
      <div className="nav-logo">🎮 <span>awesome-react-gamepads</span></div>
      {(['visualizer', 'snake', 'pong', 'tetris'] as View[]).map((v) => (
        <button
          key={v}
          className={`nav-tab${view === v ? ' active' : ''}`}
          onClick={() => onNavigate(v)}
        >
          {v === 'visualizer' ? 'Visualizer' : v === 'snake' ? '🐍 Snake' : v === 'pong' ? '🏓 Pong' : '🟦 Tetris'}
        </button>
      ))}
    </nav>
  );
}
