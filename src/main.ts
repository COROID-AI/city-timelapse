import './style.css'

const APP_TITLE = 'City Time Period Timelapse'
const ERAS = ['1945', '1965', '1985', '2005', '2025', '2055']

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="app-shell">
    <h1>${APP_TITLE}</h1>
    <p class="tagline">
      A 3D city-block scene that transforms through time: buildings, vehicles,
      storefronts, advertisements, lighting and pedestrians change with the era.
    </p>
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
    <p class="hint">
      Placeholder scaffold. The Three.js scene, era transitions, procedural
      audio and interaction land in the next milestone.
    </p>
  </main>
`

const range = document.querySelector<HTMLInputElement>('#era-range')
const output = document.querySelector<HTMLOutputElement>('#era-output')

if (range && output) {
  const update = () => {
    output.value = ERAS[Number(range.value)] ?? '1945'
  }
  range.addEventListener('input', update)
  update()
}