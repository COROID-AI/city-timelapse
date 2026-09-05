import './style.css'
import { SfxMixer } from './audio/mixer'
import { ERA_IDS } from './eras'
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
      <button
        id="audio-toggle"
        type="button"
        class="audio-toggle"
        aria-pressed="false"
        aria-label="Unmute sound"
        title="Unmute sound"
      >
        <span class="audio-toggle-icon" aria-hidden="true">🔇</span>
        <span class="audio-toggle-label">Sound off</span>
      </button>
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
const toggle = document.querySelector<HTMLButtonElement>('#audio-toggle')
const toggleIcon = toggle?.querySelector<HTMLElement>('.audio-toggle-icon') ?? null
const toggleLabel = toggle?.querySelector<HTMLElement>('.audio-toggle-label') ?? null

const mixer = new SfxMixer()
const shell = new SceneShell({
  container: app,
  // Every frame: keep the positional listener glued to the camera, then
  // advance crossfades and event scheduling.
  onFrame: (delta) => {
    mixer.updateListener(shell.camera)
    mixer.update(delta)
  },
})

if (range && output) {
  const update = () => {
    const value = ERAS[Number(range.value)] ?? '1945'
    output.value = value
    const era = ERA_IDS[Number(range.value)]
    if (era) mixer.setEra(era)
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

// Visible mute/unmute toggle. The first click is the user gesture that
// unlocks the AudioContext; the mixer starts muted, so audio only ever
// starts after the gesture.
if (toggle) {
  const syncToggle = () => {
    const muted = mixer.state.muted
    toggle.setAttribute('aria-pressed', String(!muted))
    toggle.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound')
    toggle.title = muted ? 'Unmute sound' : 'Mute sound'
    if (toggleIcon) toggleIcon.textContent = muted ? '🔇' : '🔊'
    if (toggleLabel) toggleLabel.textContent = muted ? 'Sound off' : 'Sound on'
  }
  toggle.addEventListener('click', () => {
    mixer.unlockOnGesture()
    mixer.toggleMuted()
    syncToggle()
  })
  syncToggle()
}