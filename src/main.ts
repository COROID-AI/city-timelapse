import * as THREE from 'three'
import { SceneManager } from './core/sceneManager'
import { TimelineSlider } from './ui/timelineSlider'
import { erasData } from './eras/eraData'

const CONTAINER_ID = 'container'
const WIDTH = window.innerWidth
const HEIGHT = window.innerHeight

// Initialize scene manager
const sceneManager = new SceneManager(CONTAINER_ID, WIDTH, HEIGHT)
const renderer = sceneManager.getRenderer()
const camera = sceneManager.getCamera()
const scene = sceneManager.getScene()

// Initialize timeline slider with transition duration config
// The onYearChange callback triggers the Scene Manager's era transition
const timelineSlider = new TimelineSlider({
  onYearChange: (year: number) => {
    console.log(`Switching to year: ${year}`)
    applyEraStyle(scene, year)
  },
  transitionDuration: 2, // 2 seconds default transition
  accentColor: '#4a90e2'
})

// Add UI to DOM - position after the container
document.body.appendChild(timelineSlider.getElement())

// Apply initial era (2025)
applyEraStyle(scene, 2025)

// Animation loop
sceneManager.init((delta: number) => {
  // Render loop callback - could era-specific updates here
  renderer.render(scene, camera)
})

// Handle resize
window.addEventListener('resize', () => {
  sceneManager.resize(window.innerWidth, window.innerHeight)
  timelineSlider.resize()
})

/**
 * Apply era-specific styles to the scene based on selected year.
 * Updates background color and logs the era being applied.
 * @param scene Three.js scene to update
 * @param year The selected year (1945, 1965, 1985, 2005, 2025)
 */
function applyEraStyle(scene: THREE.Scene, year: number): void {
  const era = erasData[year as keyof typeof erasData]
  if (!era) return

  // Update scene background color based on era
  scene.background = new THREE.Color(era.colors.sky)

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