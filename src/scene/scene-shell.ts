import * as THREE from 'three'
import { CameraRig, type CameraMode } from './camera-rig'
import { createGround, createLighting } from './lighting'
import { type SceneModule } from './registry'

export interface SceneShellOptions {
  /** Root element that hosts the renderer canvas. Defaults to `<body>`. */
  container?: HTMLElement
  /** Triggered after the first frame completes (used by browser smoke tests). */
  onFirstRender?: () => void
  /** Called every frame after the camera rig updates, before rendering. */
  onFrame?: (deltaSeconds: number) => void
  /** Extra `SceneModule`s registered at construction (in addition to addModule). */
  modules?: SceneModule[]
  /** Camera starting distance from the orbit target, clamped to [min,max]. */
  initialCameraDistance?: number
  /** Fixed eye height used in walk mode (world units). */
  walkEyeHeight?: number
  /** Ground plane + shadow volume size in world units. Defaults large enough to frame the 170×110 city-block district. */
  groundSize?: number
  /** Sky-dome radius. Keep large enough to never intersect the camera. */
  skyRadius?: number
}

const DEFAULT_FOV = 55
const DEFAULT_NEAR = 0.1
const DEFAULT_FAR = 1200

/** Neutral mid-day baseline: soft warm sunlight, hazy distant sky. */
export const MIDDAY = {
  clearColor: 0x9fc2e8,
  background: 0xcfe3f4,
  fog: 0xcfe3f4,
  skyColor: 0xcfe3f4,
} as const

/** Convert a 0xRRGGBB integer to a `#rrggbb` CSS color string. */
function hexToCss(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`
}

/** Radial gradient dome for a soft procedural sky (no texture assets). */
export function createSkyDome(radius = 400): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 64)
    gradient.addColorStop(0, '#3f6fb0')
    gradient.addColorStop(0.45, hexToCss(MIDDAY.skyColor))
    gradient.addColorStop(0.62, '#eef4fb')
    gradient.addColorStop(0.72, '#f4e6c8')
    gradient.addColorStop(1, '#c97e4a')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material)
  dome.name = 'Sky dome'
  dome.renderOrder = -10
  return dome
}

/** A single demonstration box that casts shadows onto the ground. */
export function createShadowDemonstrator(): THREE.Mesh {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 4.6, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x8a7f74, roughness: 0.9 }),
  )
  box.position.set(5, 2.3, -3)
  box.castShadow = true
  box.name = 'Shadow demonstrator'
  return box
}

export class SceneShell {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly rig: CameraRig
  readonly container: HTMLElement

  /** Current transient camera mode, reflected into rig.currentMode. */
  get cameraMode(): CameraMode {
    return this.rig.currentMode
  }

  private readonly skyDome: THREE.Mesh
  private readonly modules: SceneModule[] = []
  private readonly timer = new THREE.Timer()
  private readonly disposers: Array<() => void> = []
  private readonly resizeObserver: ResizeObserver
  private readonly onFirstRender: (() => void) | null
  private readonly onFrame: ((deltaSeconds: number) => void) | null
  private firstRenderCalled = false

  constructor(options: SceneShellOptions = {}) {
    this.container = options.container ?? document.body
    const groundSize = options.groundSize ?? 190

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
    this.renderer.setClearColor(MIDDAY.clearColor, 1)
    this.renderer.shadowMap.enabled = true
    // PCFSoftShadowMap is deprecated in three 0.185; PCFShadowMap keeps the
    // soft edges via `sun.shadow.radius`.
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.style.display = 'block'
    this.container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(MIDDAY.background)
    this.scene.fog = new THREE.Fog(MIDDAY.fog, 40, 260)

    this.camera = new THREE.PerspectiveCamera(
      DEFAULT_FOV,
      this.container.clientWidth / Math.max(1, this.container.clientHeight),
      DEFAULT_NEAR,
      DEFAULT_FAR,
    )
    this.camera.position.set(24, 18, 30)

    const initialDistance = options.initialCameraDistance ?? 38
    this.rig = new CameraRig({
      camera: this.camera,
      domElement: this.renderer.domElement,
      target: new THREE.Vector3(0, 1, 0),
      minDistance: 3,
      maxDistance: 200,
      walkEyeHeight: options.walkEyeHeight ?? 1.7,
      walkSpeed: 6,
      onModeChange: (mode) => {
        for (const module of this.modules) module.onCameraModeChange?.(mode)
      },
    })
    this.rig.setMode('orbit')

    // Camera starts at `initialDistance` along the default viewing direction.
    const dir = this.camera.position.clone().normalize()
    this.camera.position.copy(dir.multiplyScalar(initialDistance))
    this.rig.setOrbitDistance(initialDistance)

    this.skyDome = createSkyDome(options.skyRadius ?? 420)
    this.scene.add(this.skyDome)

    const lighting = createLighting({ groundSize })
    this.scene.add(lighting.group)

    const ground = createGround(groundSize)
    this.scene.add(ground)

    if (options.modules) {
      for (const module of options.modules) this.addModule(module)
    }

    this.onFirstRender = options.onFirstRender ?? null
    this.onFrame = options.onFrame ?? null
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(this.container)
    this.disposers.push(() => this.resizeObserver.disconnect())

    this.renderer.setAnimationLoop(() => {
      const delta = this.timer.getDelta()
      this.rig.update(delta)
      for (const module of this.modules) module.update?.(delta)
      this.onFrame?.(delta)
      this.renderer.render(this.scene, this.camera)
      if (!this.firstRenderCalled) {
        this.firstRenderCalled = true
        this.onFirstRender?.()
      }
    })
  }

  addModule(module: SceneModule): void {
    this.modules.push(module)
    this.scene.add(module.group)
  }

  /** Emit an era change to every registered module (era store event). */
  setEra(eraIndex: number): void {
    for (const module of this.modules) module.onEraChange?.(eraIndex)
  }

  removeModule(module: SceneModule): void {
    const index = this.modules.indexOf(module)
    if (index === -1) return
    this.modules.splice(index, 1)
    this.scene.remove(module.group)
  }

  /** Stop the render loop and release all GPU, observer, and input resources. */
  dispose(): void {
    this.renderer.setAnimationLoop(null)
    this.rig.dispose()
    for (const module of this.modules) module.dispose()
    for (const dispose of this.disposers.splice(0)) dispose()
    this.scene.traverse((object: THREE.Object3D) => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(material)) {
        for (const m of material) m.dispose()
      } else if (material) {
        material.dispose()
      }
    })
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }

  private handleResize(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (width <= 0 || height <= 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(width, height)
  }
}