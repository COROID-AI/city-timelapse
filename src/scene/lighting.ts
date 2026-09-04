import * as THREE from 'three'

export interface LightingOptions {
  /** Ground size in world units; used to size the shadow camera frustum. */
  groundSize?: number
  /** Inverse darkness (0 = pitch black, 1 = full ambient contribution). */
  ambientIntensity?: number
  /** Intensity of the directional sun. */
  sunIntensity?: number
  /** Softness of the sun shadow edges (blur radius in shadow-space pixels). */
  shadowRadius?: number
  /** Size of the shadow map texture. */
  shadowMapSize?: number
  /** Intensity of the soft sky-dome fill from the hemisphere light. */
  hemisphereIntensity?: number
  /** Target the sun points at (usually the center of the ground plane). */
  sunTarget?: THREE.Vector3
}

export interface LightingResult {
  readonly group: THREE.Group
  /** Ambient light node (kept alive so pedestrian/night tweaks can reach it). */
  readonly ambient: THREE.AmbientLight
  /** Warm directional "sun" with a soft shadow map. */
  readonly sun: THREE.DirectionalLight
  /** Sky-dome hemisphere fill (subtle cool counterpoint). */
  readonly hemisphere: THREE.HemisphereLight
  /** The sun's shadow camera, exposed for later shadow-tuning (e.g. dusk). */
  readonly shadowCamera: THREE.OrthographicCamera
}

function softShadowMaterial(): THREE.ShadowMaterial {
  const material = new THREE.ShadowMaterial({ opacity: 1, depthWrite: false })
  material.polygonOffset = true
  material.polygonOffsetFactor = -2
  material.polygonOffsetUnits = -2
  return material
}

/**
 * Build the three-point lighting setup: ambient + directional sun with a soft
 * shadow map + hemisphere fill. The sun uses an orthographic shadow camera
 * sized to the ground plane and a PCFSoft shadow map for gentle edges.
 */
export function createLighting(options: LightingOptions = {}): LightingResult {
  const groundSize = options.groundSize ?? 60
  const group = new THREE.Group()
  group.name = 'Lighting'

  const ambient = new THREE.AmbientLight(0xffffff, options.ambientIntensity ?? 0.55)

  const sun = new THREE.DirectionalLight(0xffeedd, options.sunIntensity ?? 3.0)
  sun.position.set(34, 46, 22)
  if (options.sunTarget) sun.target.position.copy(options.sunTarget)

  const hemisphere = new THREE.HemisphereLight(
    0xcfe4ff,
    0xcbb89a,
    options.hemisphereIntensity ?? 0.85,
  )

  const shadowCamera = new THREE.OrthographicCamera(
    -groundSize / 2,
    groundSize / 2,
    groundSize / 2,
    -groundSize / 2,
    0.5,
    140,
  )
  sun.shadow.camera = shadowCamera
  sun.shadow.mapSize.set(options.shadowMapSize ?? 2048, options.shadowMapSize ?? 2048)
  sun.shadow.radius = options.shadowRadius ?? 6
  sun.shadow.bias = -0.0005
  sun.shadow.normalBias = 0.03
  sun.castShadow = true

  group.add(ambient)
  group.add(sun)
  group.add(hemisphere)
  group.add(sun.target)

  return { group, ambient, sun, hemisphere, shadowCamera }
}

/** Ground plane with a neutral asphalt look and a shadow-only overlay. */
export function createGround(groundSize = 60): THREE.Group {
  const group = new THREE.Group()
  group.name = 'Ground'

  // Matte asphalt surface (casts no shadows itself).
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x76767c, roughness: 0.95, metalness: 0 }),
  )
  surface.rotation.x = -Math.PI / 2
  surface.receiveShadow = true
  surface.name = 'Ground surface'
  group.add(surface)

  // Shadow receiver slightly above the surface, dedicated to soft shadows.
  // A separate overlay keeps the material's depth offset from bleeding into
  // later scene content layered on the ground (sidewalks, roads).
  const shadowOverlay = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    softShadowMaterial(),
  )
  shadowOverlay.rotation.x = -Math.PI / 2
  shadowOverlay.position.y = 0.002
  shadowOverlay.receiveShadow = true
  shadowOverlay.name = 'Ground shadow overlay'
  group.add(shadowOverlay)

  return group
}