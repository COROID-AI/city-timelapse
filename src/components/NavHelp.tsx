import './NavHelp.css';

export const NavHelp = () => {
  return (
    <div className="nav-help">
      <div className="nav-help-item">
        <span className="nav-key">🖱️</span>
        <span className="nav-text">Drag to rotate</span>
      </div>
      <div className="nav-help-item">
        <span className="nav-key">🔍</span>
        <span className="nav-text">Scroll to zoom</span>
      </div>
      <div className="nav-help-item">
        <span className="nav-key">✋</span>
        <span className="nav-text">Drag to pan</span>
      </div>
    </div>
  );
};
