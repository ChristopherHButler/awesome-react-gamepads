type View = 'visualizer' | 'docs' | 'snake' | 'pong' | 'tetris';

interface Props {
  view: View;
  onNavigate: (v: View) => void;
}

export default function Sidebar({ view, onNavigate }: Props) {
  return (
    <nav className="sidebar">
      <button className={`sidebar-item${view === 'visualizer' ? ' active' : ''}`} onClick={() => onNavigate('visualizer')}>
        <span>📊</span> Visualizer
      </button>
      <button className={`sidebar-item${view === 'docs' ? ' active' : ''}`} onClick={() => onNavigate('docs')}>
        <span>📚</span> Documentation
      </button>
      <div className="sidebar-divider" />
      <div className="sidebar-section-label">Games</div>
      <button className={`sidebar-item indent${view === 'snake' ? ' active' : ''}`} onClick={() => onNavigate('snake')}>
        🐍 Snake
      </button>
      <button className={`sidebar-item indent${view === 'pong' ? ' active' : ''}`} onClick={() => onNavigate('pong')}>
        🏓 Pong
      </button>
      <button className={`sidebar-item indent${view === 'tetris' ? ' active' : ''}`} onClick={() => onNavigate('tetris')}>
        🟦 Tetris
      </button>
    </nav>
  );
}
