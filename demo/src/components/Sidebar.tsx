type View = 'visualizer' | 'inspector' | 'docs' | 'snake' | 'pong' | 'tetris' | 'hid-debug' | 'usb-debug' | 'guitar-jam';

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
      <button className={`sidebar-item${view === 'inspector' ? ' active' : ''}`} onClick={() => onNavigate('inspector')}>
        <span>🔍</span> Inspector
      </button>
      <button className={`sidebar-item${view === 'docs' ? ' active' : ''}`} onClick={() => onNavigate('docs')}>
        <span>📚</span> Documentation
      </button>
      <div className="sidebar-divider" />
      <button className={`sidebar-item${view === 'hid-debug' ? ' active' : ''}`} onClick={() => onNavigate('hid-debug')}>
        <span>🔌</span> HID Debug
      </button>
      <button className={`sidebar-item${view === 'usb-debug' ? ' active' : ''}`} onClick={() => onNavigate('usb-debug')}>
        <span>🎸</span> USB Debug
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
      <button className={`sidebar-item indent${view === 'guitar-jam' ? ' active' : ''}`} onClick={() => onNavigate('guitar-jam')}>
        🎸 Guitar Jam
      </button>
    </nav>
  );
}
