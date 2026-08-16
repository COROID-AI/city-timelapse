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
const controls = sceneManager.getControls()
const scene = sceneManager.getScene()

// Initialize timeline slider
const timelineSlider = new TimelineSlider((year: number) => {
  console.log(`Switching to year: ${year}`)
  applyEraStyle(scene, year)
})

// Add UI to DOM
document.body.appendChild(timelineSlider.getElement())

// Apply initial era (2025)
applyEraStyle(scene, 2025)

// Animation loop
sceneManager.animate()

// Handle resize
window.addEventListener('resize', () => {
  sceneManager.resize(window.innerWidth, window.innerHeight)
  timelineSlider.resize()
})

function applyEraStyle(scene: THREE.Scene, year: number): void {
  const era = erasData[year as keyof typeof erasData]
  if (!era) return

  // Update scene background
  scene.background = new THREE.Color(era.colors.sky)

  // Remove existing environment objects
  scene.traverse((child) => {
    if (child.userData.isEraObject) {
      child.geometry.dispose()
      child.material.dispose()
      scene.remove(child)
    }
  })

  // Here we would add era-specific buildings, vehicles, etc.
  // For now, just log the era
  console.log(`Applied era: ${era.name} - ${era.description}`)
}