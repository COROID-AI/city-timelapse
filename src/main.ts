import * as THREE from 'three'
import { EraTransitionEngine } from './eraTransition'
import { ERAS, EraKey } from './eras/eraData'
import { TimelineSlider } from './ui/timelineSlider'

// Initialize era transition engine
const transitionEngine = new EraTransitionEngine(scene)

// Initialize timeline slider with config object (from feature branch)
const timelineSlider = new TimelineSlider({
  onYearChange: (year: number) => {
    const eraKey = year as EraKey
    const eraData = ERAS[eraKey]
    if (eraData) {
      // Apply era style with smooth transition
      transitionEngine.startTransition(
        { /* from current era snapshot */ },
        {
          ambientLightColor: eraData.ambientLightColor,
          ambientLightIntensity: eraData.ambientLightIntensity,
          fogDensity: eraData.fogDensity,
          fogColor: eraData.fogColor,
          directionalLightHorizontalAngle: eraData.directionalLightHorizontalAngle,
          directionalLightVerticalAngle: eraData.directionalLightVerticalAngle,
          buildingBaseColorBlend: 0,
          buildingEmissiveBlend: 0,
          pedestrianColorBlend: 0,
          vehicleFade: 0,
          storefrontFade: 0,
          signageOpacity: 0,
          progress: 0
        },
        2000
      )
      applyEraStyle(scene, year)
    }
  },
  transitionDuration: 2,
  accentColor: '#4a90e2'
})

// Initialize with 2025 era snapshot directly (from HEAD)
// (no transition on startup)
const initialEra = '2025'
applyEraStyle(scene, parseInt(initialEra))

// Initialize ambient light and fog for 2025 era
scene.background = new THREE.Color(
  parseInt(ERAS['2025'].ambientLightColor.replace('#', ''), 16) / 255,
  parseInt(ERAS['2025'].ambientLightColor.replace('#', ''), 16) / 255,
  parseInt(ERAS['2025'].ambientLightColor.replace('#', ''), 16) / 255
)

// Animation loop - includes transition engine updates (from HEAD)
let lastRenderTime = 0
sceneManager.animate = () => {
  requestAnimationFrame(() => sceneManager.animate())
  const now = performance.now()
  // Update transition engine (this will handle the interpolation)
  transitionEngine.onFrame?.(now)
  controls.update()
  renderer.render(scene, camera)
  lastRenderTime = now
}

// Animation loop callback - era-specific updates (from feature branch)
sceneManager.init((delta: number) => {
  // Render loop callback - could era-specific updates here
  renderer.render(scene, camera)
})

/**
 * Apply era-specific styles to the scene based on selected year.
 * Updates background color and logs the era being applied.
 * @param scene Three.js scene to update
 * @param year The selected year (1945, 1965, 1985, 2005, 2025)
 */
function applyEraStyle(scene: THREE.Scene, year: number): void {
  const era = ERAS[year as keyof typeof ERAS]
  if (!era) return

  // Update scene background color based on era
  scene.background = new THREE.Color(
    parseInt(era.colors.sky.replace('#', ''), 16) / 255,
    parseInt(era.colors.sky.replace('#', ''), 16) / 255,
    parseInt(era.colors.sky.replace('#', ''), 16) / 255
  )

  // Remove existing era-specific objects from previous transitions
  scene.traverse((child) => {
    if (child.userData?.isEraObject) {
      child.geometry.dispose()
      child.material.dispose()
      scene.remove(child)
    }
  })

  // Log the era being applied
  console.log(`Applied era: ${era.name} - ${era.description}`)
}

console.log('Era Transition Engine initialized')
console.log('Use timeline slider to transition between eras smoothly')