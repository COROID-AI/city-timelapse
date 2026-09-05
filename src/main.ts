import './style.css'
import { ERA_IDS, type EraId } from './eras'
import { EraStateStore } from './state'
import { TimelineSlider } from './timeline'

const APP_TITLE = 'City Time Period Timelapse'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('#app mount point missing')
}

app.innerHTML = `
  <main class="app-shell">
    <div class="timeline-slot" data-testid="timeline-slot"></div>
    <section class="scene-stage" data-testid="scene-stage" aria-label="City scene">
      <h1>${APP_TITLE}</h1>
      <p class="tagline">
        Drag the timeline slider or press the arrow keys to travel through
        1945, 1965, 1985, 2005 and 2025. The city block reshapes itself as the
        era changes.
      </p>
      <div class="scene-canvas" data-testid="scene-canvas"></div>
    </section>
  </main>
`

const timelineSlot = app.querySelector<HTMLElement>('.timeline-slot')!
const sceneStage = app.querySelector<HTMLElement>('.scene-stage')!
const sceneCanvas = app.querySelector<HTMLElement>('.scene-canvas')!
if (!timelineSlot || !sceneStage || !sceneCanvas) {
  throw new Error('Timeline UI mount points missing')
}

const store = new EraStateStore()

// The current milestone renders a placeholder scene that morphs through the
// eras. The timeline drives it through the store: era-change → store →
// era-state-change re-paints the scene and turns the transitioning indicator
// on, and the shortened transition ends by clearing it.
let transitionTimer = 0
const sceneEra = document.createElement('div')
sceneEra.className = 'scene-era-badge'
sceneEra.setAttribute('data-testid', 'scene-era-badge')
sceneEra.setAttribute('role', 'status')
sceneStage.appendChild(sceneEra)

function renderScene(): void {
  sceneCanvas.textContent = ''
  const eraPanel = document.createElement('div')
  eraPanel.className = 'scene-era-panel'
  eraPanel.dataset.era = store.state.era
  sceneCanvas.appendChild(eraPanel)

  const eraHeading = document.createElement('p')
  eraHeading.className = 'scene-era-heading'
  eraHeading.textContent = `City block — ${store.state.era}`
  eraPanel.appendChild(eraHeading)

  const note = document.createElement('p')
  note.className = 'scene-era-note'
  note.textContent =
    'The Three.js scene shell morphs buildings, vehicles, storefronts and lighting with each era. A runtime placeholder is shown in this milestone.'
  eraPanel.appendChild(note)

  sceneEra.textContent = `Current era: ${store.state.era}`
}

const onEraStateChange = (event: Event): void => {
  const detail = (event as CustomEvent<{ era: EraId; transitioning?: boolean }>).detail
  if (!detail) return
  if (detail.era) {
    renderScene()
  }
  if (detail.transitioning === true) {
    clearTimeout(transitionTimer)
    transitionTimer = window.setTimeout(() => {
      store.endTransition()
    }, 400)
  }
}
window.addEventListener('era-state-change', onEraStateChange)

renderScene()

const slider = new TimelineSlider({
  initialEra: ERA_IDS[0],
})

timelineSlot.appendChild(slider.root)

window.addEventListener('beforeunload', () => {
  clearTimeout(transitionTimer)
  window.removeEventListener('era-state-change', onEraStateChange)
  slider.dispose()
  store.dispose()
})