// Small help card listing navigation + keyboard shortcuts.
export class ControlsHint {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'controls-hint';
    this.element.innerHTML = `
      <div><b>Drag</b> orbit &nbsp; <b>Scroll</b> zoom &nbsp; <b>Right-drag</b> pan</div>
      <div><kbd>1</kbd>–<kbd>6</kbd> era &nbsp; <kbd>M</kbd> mute &nbsp; <kbd>←↑↓→</kbd> camera</div>
    `;
    // auto-fade after a while handled via CSS transition
  }
}
