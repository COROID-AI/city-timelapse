// Mute toggle button in the top-right.
export class MuteButton {
  constructor(onToggle) {
    this.onToggle = onToggle;
    this.element = document.createElement('button');
    this.element.className = 'mute-btn';
    this.element.title = 'Mute (M)';
    this.element.setAttribute('aria-label', 'Mute toggle');
    this.element.textContent = '🔊';
    this.element.addEventListener('click', () => {
      if (this.onToggle) this.onToggle();
    });
  }

  setMuted(m) {
    this.element.textContent = m ? '🔇' : '🔊';
    this.element.classList.toggle('muted', m);
  }
}
