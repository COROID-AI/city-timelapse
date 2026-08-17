import { useState } from 'react';
import { useStore } from '../state/store';

export function HelpOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const resetCamera = useStore(state => state.reset);

  if (!isOpen) {
    return (
      <button className="help-btn" onClick={() => setIsOpen(true)} title="Help (H)">
        ?
      </button>
    );
  }

  return (
    <div className="help-overlay" onClick={() => setIsOpen(false)}>
      <div className="help-content" onClick={e => e.stopPropagation()}>
        <h2>Controls</h2>
        <ul>
          <li><strong>Mouse Drag</strong> - Orbit camera</li>
          <li><strong>Scroll</strong> - Zoom in/out</li>
          <li><strong>Right-click drag</strong> - Pan</li>
          <li><strong>1-6 keys</strong> - Jump to era</li>
          <li><strong>← → arrows</strong> - Previous/next era</li>
          <li><strong>Space</strong> - Play/pause timelapse</li>
          <li><strong>M</strong> - Mute/unmute audio</li>
          <li><strong>H</strong> - Toggle this help</li>
          <li><strong>R</strong> - Reset camera</li>
        </ul>
        <button className="close-help" onClick={() => setIsOpen(false)}>Close</button>
        <button className="reset-cam" onClick={() => { resetCamera(); setIsOpen(false); }}>Reset Camera</button>
      </div>
    </div>
  );
}
