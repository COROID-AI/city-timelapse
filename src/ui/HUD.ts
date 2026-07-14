// Bottom-left info HUD showing era description + help text + renderer stats.

export class HUD {
  private el: HTMLDivElement;
  private info: HTMLDivElement;
  private stats: HTMLDivElement;
  private help: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-info"></div>
      <div class="hud-stats"></div>
      <div class="hud-help">
        <span class="key">Drag</span> orbit ·
        <span class="key">Scroll</span> zoom ·
        <span class="key">←→</span> era ·
        <span class="key">Space</span> play ·
        <span class="key">R</span> reset ·
        <span class="key">M</span> mute
      </div>`;
    container.appendChild(this.el);
    this.info = this.el.querySelector('.hud-info') as HTMLDivElement;
    this.stats = this.el.querySelector('.hud-stats') as HTMLDivElement;
    this.help = this.el.querySelector('.hud-help') as HTMLDivElement;
    void this.help;
  }

  setInfo(text: string): void {
    this.info.textContent = text;
  }

  setStats(text: string): void {
    this.stats.textContent = text;
  }

  showHelp(visible: boolean): void {
    this.help.style.display = visible ? '' : 'none';
  }
}
