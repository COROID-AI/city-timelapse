import './style.css'
import { SceneShell } from './scene/scene-shell'

const APP_TITLE = 'City Time Period Timelapse'
const ERAS = ['1945', '1965', '1985', '2005', '2025', '2055']

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app root element')

app.innerHTML = `
  <main class="app-shell">
    <header class="app-header">
      <h1>${APP_TITLE}</h1>
      <div class="timeline" role="group" aria-label="Time period">
        <label for="era-range">Year</label>
        <input
          id="era-range"
          type="range"
          min="0"
          max="${ERAS.length - 1}"
          step="1"
          value="0"
          list="era-ticks"
        />
        <datalist id="era-ticks">
          ${ERAS.map((era) => `<option value="${era}"></option>`).join('')}
        </datalist>
        <output id="era-output" for="era-range">1945</output>
      </div>
    </header>
    <p class="tagline">
      Drag to orbit &middot; scroll to zoom. Press <kbd>M</kbd> to switch to
      walk mode (pointer lock + WASD), <kbd>M</kbd> again to return.
    </p>
    <p class="hint">
      Drag to orbit &middot; scroll to zoom. Press <kbd>M</kbd> to switch to
      walk mode (pointer lock + WASD), <kbd>M</kbd> again to return.
    </p>
    <p class="mode-badge" id="mode-badge" role="status">Mode: orbit</p>
  </main>
`

const range = document.querySelector<HTMLInputElement>('#era-range')
const output = document.querySelector<HTMLOutputElement>('#era-output')
const shell = new SceneShell({ container: app })

if (range && output) {
  const update = () => {
    const value = ERAS[Number(range.value)] ?? '1945'
    output.value = value
  }
  range.addEventListener('input', update)
  update()
}

const badge = document.querySelector<HTMLElement>('#mode-badge')
if (badge) {
  shell.rig.onModeChange = (mode) => {
    badge.textContent = `Mode: ${mode}`
  }
}