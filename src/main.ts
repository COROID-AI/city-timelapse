import * as THREE from 'three'
import { SceneManager } from './core/sceneManager'
import { TimelineSlider } from './ui/timelineSlider'
import { erasData } from './eras/eraData'
import { EraTransitionEngine, EraDataSnapshot } from './eraTransition'

const CONTAINER_ID = 'container'
const WIDTH = window.innerWidth
const HEIGHT = window.innerHeight

// Initialize scene manager
const sceneManager = new SceneManager(CONTAINER_ID, WIDTH, HEIGHT)
const renderer = sceneManager.getRenderer()
const camera = sceneManager.getCamera()
const controls = sceneManager.getControls()
const scene = sceneManager.getScene()

// Initialize era transition engine
const transitionEngine = new EraTransitionEngine(scene)

// Initialize timeline slider
const timelineSlider = new TimelineSlider((year: number) => {
  const toEra = erasData[year as keyof typeof erasData]
  if (!toEra) return

  // Get the currently selected era (default to 2025 if none transitioning)
  const fromEraKey = '2025' as const
  const fromEra = erasData[fromEraKey as keyof typeof erasData]

  if (fromEra && toEra) {
    const fromSnapshot: EraDataSnapshot = {
      ambientLightColor: fromEra.ambientLightColor,
      ambientLightIntensity: fromEra.ambientLightIntensity,
      fogDensity: fromEra.fogDensity,
      fogColor: fromEra.fogColor,
      directionalLightHorizontalAngle: 0, // Will be set per-era
      directionalLightVerticalAngle: 0,
      buildingBaseColor: '',
      buildingEmissive: '',
      pedestrianDominantColors: [],
      vehicleTypes: fromEra.vehicleTypes,
      storefrontTemplateCount: 0,
      signageIllumination: fromEra.signageStyle.illumination
    }

    // Build snapshot from toEra
    const toSnapshot: EraDataSnapshot = {
      ambientLightColor: toEra.ambientLightColor,
      ambientLightIntensity: toEra.ambientLightIntensity,
      fogDensity: toEra.fogDensity,
      fogColor: toEra.fogColor,
      directionalLightHorizontalAngle: 0,
      directionalLightVerticalAngle: 0,
      buildingBaseColor: '',
      buildingEmissive: '',
      pedestrianDominantColors: [],
      vehicleTypes: toEra.vehicleTypes,
      storefrontTemplateCount: 0,
      signageIllumination: toEra.signageStyle.illumination
    }

    // Start smooth transition (2 seconds as per acceptance criteria)
    transitionEngine.startTransition(fromSnapshot, toSnapshot, 2000, {
      onUpdate: (progress, interpolated) => {
        // Update will be handled in the engine's render loop
        console.log(`Transition progress: ${Math.round(progress * 100)}%`)
      },
      onComplete: () => {
        console.log('Era transition complete')
      }
    })
  }
})

// Add UI to DOM
document.body.appendChild(timelineSlider.getElement())

// Set initial era - start with 2025 as the initial state
// No abrupt applyEraStyle - just set up the initial snapshot

// Animation loop - now includes transition engine updates
let lastRenderTime = 0
sceneManager.animate = () => {
  requestAnimationFrame(() => sceneManager.animate())
  const now = performance.now()
  
  // Update transition engine (this will handle the interpolation)
  transitionEngine.onFrame ? transitionEngine.onFrame(now) : null
  
  controls.update()
  renderer.render(scene, camera)
  lastRenderTime = now
}

// Handle resize
window.addEventListener('resize', () => {
  sceneManager.resize(window.innerWidth, window.innerHeight)
  timelineSlider.resize()
})

// Initialize with 2025 era snapshot directly (no transition on startup)
const initialEra = erasData['2025']
if (initialEra) {
  const initialSnapshot: EraDataSnapshot = {
    ambientLightColor: initialEra.ambientLightColor,
    ambientLightIntensity: initialEra.ambientLightIntensity,
    fogDensity: initialEra.fogDensity,
    fogColor: initialEra.fogColor,
    directionalLightHorizontalAngle: 0,
    directionalLightVerticalAngle: 0,
    buildingBaseColor: '',
    buildingEmissive: '',
    pedestrianDominantColors: [],
    vehicleTypes: initialEra.vehicleTypes,
    storefrontTemplateCount: 0,
    signageIllumination: initialEra.signageStyle.illumination
  }

  // Apply initial state directly without transition
  scene.background = new THREE.Color(parseInt(initialEra.ambientLightColor.replace('#', ''), 16))

  // Set up initial ambient light
  scene.traverse((child) => {
    if (child.isLight && child.type === 'AmbientLight') {
      ;(child as THREE.AmbientLight).intensity = initialEra.ambientLightIntensity
    }
    if (child.isLight && child.type === 'DirectionalLight') {
      const light = child as THREE.DirectionalLight
      light.position.set(5, 10, 7.5)
    }
  })

  // Set up fog
  scene.fog = new THREE.Fog(
    initialEra.fogColor,
    initialEra.fogDensity,
    500
  )
}

console.log('Era Transition Engine initialized')
console.log('Use timeline slider to transition between eras smoothly')