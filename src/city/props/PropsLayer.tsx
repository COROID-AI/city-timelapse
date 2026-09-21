/**
 * The props layer's renderer bridge: instanced meshes, the era runtime and the
 * React component the scene integration mounts.
 *
 * This is the only file of the layer that imports three.js or React (matching
 * the layout's own split between data and `buildMeshes`). Everything it draws
 * comes from a {@link PropsLayerPlan} produced by `placement.ts`, so the geometry
 * on screen and the geometry the tests prove legal are the same numbers.
 *
 * ## Batching and instancing
 *
 * A plan is a flat list of placed props. The builder groups them by recipe and
 * part, and emits one {@link THREE.InstancedMesh} per (recipe, part) pair, whose
 * per-instance matrix is the placement matrix times the part's local transform.
 * That keeps the draw-call count at "recipes × parts in use" instead of
 * "props × parts" — the catalogue's repeated objects (sixteen lamp posts, three
 * bollards, four grates) cost one draw call each, and every primitive geometry is
 * built once and shared through {@link PropsGeometryCache}.
 *
 * ## Progressive era switches
 *
 * A settled era draws every prop at full weight. During a staged switch the
 * runtime keeps the departing and arriving eras alive at once and scales each
 * instance by its own weight, so props grow in, shrink out or blend their
 * transform between the two placements — instantly, when the caller asks for
 * reduced motion.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactElement,
} from 'react'
import * as THREE from 'three'
import { getEra, type EraId } from '../../era'
import { DEFAULT_QUALITY_TIER, QUALITY_TIERS, type QualityTierName } from '../../lib/quality'
import type { BlockLayout } from '../layout'
import {
  MATERIAL_SPECS,
  PART_BY_ID,
  getPropRecipe,
  resolveMaterialPalette,
  type PropPaletteSample,
} from './recipes'
import { planEraProps, planTransition } from './placement'
import {
  PROP_SLOTS,
  type MaterialKey,
  type PartDefinition,
  type PlacedProp,
  type PropRecipe,
  type PropsLayerPlan,
  type PropsLayerStats,
  type PropsTransitionInput,
  type PropsTransitionPlan,
} from './types'

/* ------------------------------------------------------------------------- *
 * Runtime contract types
 * ------------------------------------------------------------------------- */

/** Options the props runtime and the React component share. */
export interface PropsRuntimeOptions {
  /** Block seed override; defaults to the layout's own seed input. */
  readonly seed?: string | number
  /** Shared quality tier; scales optional detail and the lamp light budget. */
  readonly qualityTier?: QualityTierName
  /** Overrides the era's night state. */
  readonly night?: boolean
  /** Instant era switches instead of staged ones. */
  readonly reducedMotion?: boolean
  /** Shared geometry cache; the runtime creates one when omitted. */
  readonly cache?: PropsGeometryCache
  /** How many eras stay mounted at once; a transition needs two. */
  readonly maxCachedEras?: number
}

/** Extra context the integration passes to the layer's imperative entry points. */
export interface PropsApplyContext {
  /** The runtime created by `createPropsRuntime`. */
  readonly runtime: PropsRuntime
  /** Overrides the era's own night state, e.g. from the lighting rig. */
  readonly night?: boolean
  /** Reduced-motion users get instant switches instead of staged fades. */
  readonly reducedMotion?: boolean
}

/* ------------------------------------------------------------------------- *
 * Geometry cache
 * ------------------------------------------------------------------------- */

/**
 * Shared primitive geometry, keyed by part id.
 *
 * The catalogue reuses the same handful of shapes across dozens of props, so one
 * `BufferGeometry` per part is built once per layer and disposed with it. The
 * shapes are authored *base-origin* (a cylinder's `y` runs `0 … height`) to match
 * the recipe frame documented in `recipes.ts`.
 */
export interface PropsGeometryCache {
  readonly geometries: ReadonlyMap<string, THREE.BufferGeometry>
  get(definition: PartDefinition): THREE.BufferGeometry
  dispose(): void
}

function torusRows(shape: { readonly segments?: number }): number {
  return shape.segments ?? 12
}

/** Builds the three.js geometry of one part definition. */
export function buildPartGeometry(definition: PartDefinition): THREE.BufferGeometry {
  const shape = definition.shape
  switch (shape.kind) {
    case 'box':
      return new THREE.BoxGeometry(shape.size[0], shape.size[1], shape.size[2]).translate(
        0,
        shape.size[1] / 2,
        0,
      )
    case 'cylinder':
      return new THREE.CylinderGeometry(
        shape.radius,
        shape.radius,
        shape.height,
        shape.segments ?? 8,
      ).translate(0, shape.height / 2, 0)
    case 'cone':
      return new THREE.ConeGeometry(shape.radius, shape.height, shape.segments ?? 8).translate(
        0,
        shape.height / 2,
        0,
      )
    case 'sphere':
      return new THREE.SphereGeometry(shape.radius, shape.segments ?? 8, Math.max(4, Math.round((shape.segments ?? 8) * 0.75)))
    case 'torus':
      return new THREE.TorusGeometry(shape.radius, shape.tube, 6, torusRows(shape))
  }
}

/** Creates an empty geometry cache; the runtime owns exactly one. */
export function createPropsGeometryCache(): PropsGeometryCache {
  const geometries = new Map<string, THREE.BufferGeometry>()
  return {
    geometries,
    get(definition) {
      const cached = geometries.get(definition.id)
      if (cached !== undefined) {
        return cached
      }
      const geometry = buildPartGeometry(definition)
      geometry.name = `prop-part:${definition.id}`
      geometry.computeBoundingSphere()
      geometries.set(definition.id, geometry)
      return geometry
    },
    dispose() {
      for (const geometry of geometries.values()) {
        geometry.dispose()
      }
      geometries.clear()
    },
  }
}

/* ------------------------------------------------------------------------- *
 * Detail budget per quality tier
 * ------------------------------------------------------------------------- */

/**
 * Detail buckets dropped at the cheapest tier.
 *
 * Coverage never changes with quality — every anchor keeps its prop — but the
 * loose litter and paper that only reads from metres away is skipped to protect
 * the low-tier triangle budget.
 */
const COSMETIC_DETAIL_AT_LOW_TIER: ReadonlySet<string> = new Set(['clutter'])

/** True when a part of a recipe is drawn at this quality tier. */
export function partVisibleAtTier(
  recipe: PropRecipe,
  partIndex: number,
  tier: QualityTierName,
): boolean {
  if (tier !== 'low') {
    return true
  }
  const instance = recipe.parts[partIndex]
  if (instance === undefined) {
    return false
  }
  const definition = PART_BY_ID[instance.part]
  const detail = instance.detail ?? definition?.detail ?? 'clutter'
  return !COSMETIC_DETAIL_AT_LOW_TIER.has(detail)
}

/* ------------------------------------------------------------------------- *
 * Built layer
 * ------------------------------------------------------------------------- */

/** One instanced draw call of the layer. */
export interface BuiltPropBatch {
  readonly recipeId: string
  readonly partIndex: number
  readonly materialKey: MaterialKey
  readonly detail: string
  readonly mesh: THREE.InstancedMesh
  readonly instanceCount: number
  readonly triangles: number
}

/** Instance slots one prop occupies across the layer's batches. */
export interface PropInstanceSlot {
  readonly key: string
  readonly anchorName: string
  readonly propId: string
  readonly instances: readonly { readonly batch: number; readonly index: number }[]
  readonly lightIndex: number | null
}

/** Everything one era's props look like once mounted. */
export interface BuiltPropsLayer {
  readonly eraId: EraId
  readonly root: THREE.Group
  readonly plan: PropsLayerPlan
  readonly props: readonly PlacedProp[]
  readonly batches: readonly BuiltPropBatch[]
  readonly slots: readonly PropInstanceSlot[]
  readonly slotByKey: ReadonlyMap<string, PropInstanceSlot>
  readonly materials: readonly THREE.Material[]
  readonly lights: readonly THREE.PointLight[]
  readonly stats: PropsLayerStats
  readonly cache: PropsGeometryCache
}

/** Options accepted by {@link buildPropsObject}. */
export interface BuildPropsOptions {
  readonly cache: PropsGeometryCache
  readonly qualityTier?: QualityTierName
}

/** Per-instance transform written for one prop. */
export interface PropTransform {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly rotationY: number
  readonly scale: number
  readonly weight: number
}

function materialKeyFor(recipe: PropRecipe, partIndex: number): MaterialKey {
  return recipe.parts[partIndex]?.material ?? 'galvanised-steel'
}

function detailFor(recipe: PropRecipe, partIndex: number): string {
  const instance = recipe.parts[partIndex]
  if (instance === undefined) {
    return 'clutter'
  }
  return instance.detail ?? PART_BY_ID[instance.part]?.detail ?? 'clutter'
}

const REUSABLE_QUATERNION = new THREE.Quaternion()
const REUSABLE_SCALE = new THREE.Vector3()
const REUSABLE_POSITION = new THREE.Vector3()
const REUSABLE_EULER = new THREE.Euler()

/** Local matrix of one recipe part, including its optional scale and rotation. */
export function partLocalMatrix(recipe: PropRecipe, partIndex: number): THREE.Matrix4 {
  const instance = recipe.parts[partIndex]
  const matrix = new THREE.Matrix4()
  if (instance === undefined) {
    return matrix
  }
  const scale = instance.scale ?? [1, 1, 1]
  const rotate = instance.rotate ?? [0, 0, 0]
  REUSABLE_EULER.set(rotate[0], rotate[1], rotate[2], 'XYZ')
  REUSABLE_QUATERNION.setFromEuler(REUSABLE_EULER)
  return matrix.compose(
    REUSABLE_POSITION.set(instance.at[0], instance.at[1], instance.at[2]),
    REUSABLE_QUATERNION,
    REUSABLE_SCALE.set(scale[0], scale[1], scale[2]),
  )
}

/** Placement matrix of one prop, with its weight folded into the scale. */
export function placementMatrix(transform: PropTransform, target = new THREE.Matrix4()): THREE.Matrix4 {
  REUSABLE_EULER.set(0, transform.rotationY, 0, 'XYZ')
  REUSABLE_QUATERNION.setFromEuler(REUSABLE_EULER)
  const scale = transform.scale * Math.max(0, transform.weight)
  return target.compose(
    REUSABLE_POSITION.set(transform.position.x, transform.position.y, transform.position.z),
    REUSABLE_QUATERNION,
    REUSABLE_SCALE.set(scale, scale, scale),
  )
}

/** The transform of a settled prop. */
export function transformOf(prop: PlacedProp, weight = 1): PropTransform {
  return { position: prop.position, rotationY: prop.rotationY, scale: prop.scale, weight }
}

/**
 * Mounts one era's plan as instanced three.js objects.
 *
 * The returned root is named `era-props:<eraId>` and holds one
 * {@link THREE.InstancedMesh} per recipe part plus the era's lamp point lights.
 */
export function buildPropsObject(plan: PropsLayerPlan, options: BuildPropsOptions): BuiltPropsLayer {
  const tier = options.qualityTier ?? DEFAULT_QUALITY_TIER
  const effects = QUALITY_TIERS[tier].effects
  const era = getEra(plan.eraId)
  const palette = resolveMaterialPalette(
    era.palette as PropPaletteSample,
    plan.wear,
    era.lighting.artificialLightColor,
  )

  const root = new THREE.Group()
  root.name = `era-props:${plan.eraId}`
  root.userData['eraId'] = plan.eraId
  root.userData['propCount'] = plan.props.length

  // One material per palette entry the plan actually uses.
  const usedMaterials = new Set<MaterialKey>()
  for (const prop of plan.props) {
    for (const key of prop.materialPalette) {
      usedMaterials.add(key)
    }
  }
  const materialByKey = new Map<MaterialKey, THREE.MeshStandardMaterial>()
  for (const key of usedMaterials) {
    const resolved = palette[key]
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(resolved.colour),
      roughness: resolved.roughness,
      metalness: resolved.metalness,
      opacity: resolved.opacity,
      transparent: resolved.opacity < 1,
      emissive: new THREE.Color(resolved.emissiveColour),
      emissiveIntensity: 0,
      name: `prop-material:${key}`,
    })
    material.userData['materialKey'] = key
    materialByKey.set(key, material)
  }

  // Group props by recipe so each (recipe, part) pair becomes one batch.
  const byRecipe = new Map<string, PlacedProp[]>()
  for (const prop of plan.props) {
    const list = byRecipe.get(prop.propId)
    if (list === undefined) {
      byRecipe.set(prop.propId, [prop])
    } else {
      list.push(prop)
    }
  }

  const batches: BuiltPropBatch[] = []
  const slots: PropInstanceSlot[] = []
  const slotsByKey = new Map<string, PropInstanceSlot>()
  const lights: THREE.PointLight[] = []
  let triangles = 0

  for (const [recipeId, props] of [...byRecipe.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const recipe = getPropRecipe(recipeId)
    for (let partIndex = 0; partIndex < recipe.parts.length; partIndex += 1) {
      if (!partVisibleAtTier(recipe, partIndex, tier)) {
        continue
      }
      const materialKey = materialKeyFor(recipe, partIndex)
      const material = materialByKey.get(materialKey)
      if (material === undefined) {
        continue
      }
      const partId = recipe.parts[partIndex]?.part
      const part = partId === undefined ? undefined : PART_BY_ID[partId]
      if (part === undefined) {
        continue
      }
      const geometry = options.cache.get(part)
      const mesh = new THREE.InstancedMesh(geometry, material, props.length)
      mesh.name = `props:${recipeId}:${partIndex}`
      mesh.userData['recipeId'] = recipeId
      mesh.userData['partIndex'] = partIndex
      mesh.userData['materialKey'] = materialKey
      mesh.castShadow = effects.shadows
      mesh.receiveShadow = effects.shadows
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

      const local = partLocalMatrix(recipe, partIndex)
      const batchIndex = batches.length
      props.forEach((prop, index) => {
        const matrix = placementMatrix(transformOf(prop))
        matrix.multiply(local)
        mesh.setMatrixAt(index, matrix)
        pushInstance(slotsByKey, prop, batchIndex, index)
      })
      mesh.instanceMatrix.needsUpdate = true
      root.add(mesh)

      const trianglesPerInstance = Math.floor(geometry.index ? geometry.index.count / 3 : 0)
      batches.push({
        recipeId,
        partIndex,
        materialKey,
        detail: detailFor(recipe, partIndex),
        mesh,
        instanceCount: props.length,
        triangles: trianglesPerInstance * props.length,
      })
      triangles += trianglesPerInstance * props.length
    }
  }

  // Lamp point lights: only the era's highest-priority lamps get one.
  const lampProps = plan.props.filter((prop) => prop.lamp?.light === true)
  lampProps.forEach((prop) => {
    const recipe = getPropRecipe(prop.propId)
    const offset = recipe.lamp?.lightOffset ?? [0, 0, 0]
    const local = localToWorldOffset(offset[0], offset[2], prop.rotationY, prop.scale)
    const light = new THREE.PointLight(
      new THREE.Color(prop.lamp?.colour ?? '#ffffff'),
      prop.lamp?.lightIntensity ?? 0,
      40,
      2,
    )
    light.name = `prop-light:${prop.anchorName}`
    light.position.set(
      prop.position.x + local.x,
      prop.position.y + offset[1] * prop.scale,
      prop.position.z + local.z,
    )
    light.userData['anchorName'] = prop.anchorName
    const slot = slotsByKey.get(prop.key)
    if (slot !== undefined) {
      slotsByKey.set(prop.key, { ...slot, lightIndex: lights.length })
    }
    lights.push(light)
    root.add(light)
  })

  const props = [...plan.props]
  for (const prop of props) {
    const slot = slotsByKey.get(prop.key)
    if (slot !== undefined) {
      slots.push(slot)
    }
  }

  const built: BuiltPropsLayer = {
    eraId: plan.eraId,
    root,
    plan,
    props,
    batches,
    slots,
    slotByKey: slotsByKey,
    materials: [...materialByKey.values()],
    lights,
    stats: {
      eraId: plan.eraId,
      propCount: plan.props.length,
      instanceCount: batches.reduce((total, batch) => total + batch.instanceCount, 0),
      triangles,
      drawCalls: batches.length,
      recipesUsed: byRecipe.size,
      byCategory: plan.census.byCategory,
      bySlot: plan.census.bySlot,
      detail: plan.census.detail,
      lamp: {
        technology: plan.lamp.technology,
        label: plan.lamp.label,
        colour: plan.lamp.colour,
        emissiveIntensity: plan.lamp.emissiveIntensity,
        emissiveVisible: plan.lamp.emissiveIntensity > 0.05,
        pointLights: lights.length,
        pointLightIntensity: plan.lamp.pointLightIntensity,
      },
      coverage: {
        anchors: PROP_SLOTS.reduce((total, slot) => total + plan.coverage[slot].expected.length, 0),
        placed: plan.props.length,
        missing: PROP_SLOTS.flatMap((slot) => plan.coverage[slot].missing),
        duplicated: PROP_SLOTS.flatMap((slot) => plan.coverage[slot].duplicated),
      },
      issues: plan.issues,
    },
    cache: options.cache,
  }

  applyEmissive(built, plan)
  return built
}

function pushInstance(
  slotsByKey: Map<string, PropInstanceSlot>,
  prop: PlacedProp,
  batch: number,
  index: number,
): void {
  const existing = slotsByKey.get(prop.key)
  if (existing === undefined) {
    slotsByKey.set(prop.key, {
      key: prop.key,
      anchorName: prop.anchorName,
      propId: prop.propId,
      instances: [{ batch, index }],
      lightIndex: null,
    })
    return
  }
  slotsByKey.set(prop.key, { ...existing, instances: [...existing.instances, { batch, index }] })
}

function localToWorldOffset(
  localX: number,
  localZ: number,
  yaw: number,
  scale: number,
): { x: number; z: number } {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return { x: (cos * localX + sin * localZ) * scale, z: (-sin * localX + cos * localZ) * scale }
}

/**
 * Applies the era's lamp emission to the lamp materials.
 *
 * The era tables and the emitter's own recipe decide the colour and strength, so
 * a 1945 gas lantern, a 1985 sodium lamp and a 2025 LED panel each glow with
 * their own colour at their own intensity, and a daylight era barely glows at all.
 */
function applyEmissive(built: BuiltPropsLayer, plan: PropsLayerPlan): void {
  for (const material of built.materials) {
    const key = material.userData['materialKey'] as MaterialKey | undefined
    if (key === undefined) {
      continue
    }
    const spec = MATERIAL_SPECS[key]
    if (spec.emissive <= 0) {
      continue
    }
    const meshMaterial = material as THREE.MeshStandardMaterial
    const lampScale = plan.lamp.emissiveIntensity
    const isLampGlass =
      key === 'lamp-glass' || key === 'led-diffuser' || key === 'neon-tube' || key === 'screen-glass'
    meshMaterial.emissiveIntensity = spec.emissive * (isLampGlass ? Math.max(lampScale, 0.05) : 1)
  }
}

/* ------------------------------------------------------------------------- *
 * Weights and transitions
 * ------------------------------------------------------------------------- */

const TRANSFORM_MATRIX = new THREE.Matrix4()

/** Sets one prop's instance transforms, scaling it by `weight`. */
export function setPropTransform(built: BuiltPropsLayer, propKey: string, transform: PropTransform): void {
  const slot = built.slotByKey.get(propKey)
  if (slot === undefined) {
    return
  }
  const recipe = getPropRecipe(slot.propId)
  const placement = placementMatrix(transform, TRANSFORM_MATRIX)
  for (const instance of slot.instances) {
    const batch = built.batches[instance.batch]
    if (batch === undefined) {
      continue
    }
    const local = partLocalMatrix(recipe, batch.partIndex)
    const matrix = new THREE.Matrix4().multiplyMatrices(placement, local)
    batch.mesh.setMatrixAt(instance.index, matrix)
    batch.mesh.instanceMatrix.needsUpdate = true
  }
  if (slot.lightIndex !== null) {
    const light = built.lights[slot.lightIndex]
    if (light !== undefined) {
      const source = built.props.find((prop) => prop.key === propKey)
      const weight = Math.max(0, Math.min(1, transform.weight))
      light.intensity = (source?.lamp?.lightIntensity ?? 0) * weight
      light.visible = weight > 0.001
    }
  }
}

/** Sets every prop of a built layer to full weight (a settled era). */
export function settleBuiltLayer(built: BuiltPropsLayer): void {
  for (const prop of built.props) {
    setPropTransform(built, prop.key, transformOf(prop, 1))
  }
}

/* ------------------------------------------------------------------------- *
 * Runtime
 * ------------------------------------------------------------------------- */

/** Handle the transition director and the scene integration drive. */
export interface PropsRuntime {
  readonly layout: BlockLayout
  /** Group holding every era layer; the integration adds this to the world. */
  readonly root: THREE.Group
  readonly options: PropsRuntimeOptions
  readonly eraId: EraId | null
  readonly plan: PropsLayerPlan | null
  readonly built: BuiltPropsLayer | null
  readonly stats: PropsLayerStats | null
  readonly cachedEras: readonly EraId[]
  /** Instantly shows one era; returns its plan. */
  applyEra(eraId: EraId, overrides?: { night?: boolean; qualityTier?: QualityTierName }): PropsLayerPlan
  /** Shows a staged (or, under reduced motion, instant) switch; returns the frame. */
  applyEraTransition(
    input: PropsTransitionInput,
    overrides?: { night?: boolean; qualityTier?: QualityTierName; reducedMotion?: boolean },
  ): PropsTransitionPlan
  /** The plan of one era without changing what is shown. */
  inspectEra(eraId: EraId): PropsLayerPlan
  dispose(): void
}

/** How many eras the runtime keeps mounted at once (a transition needs two). */
export const RUNTIME_ERA_CACHE_LIMIT = 2

/**
 * Creates the layer runtime for one block.
 *
 * The runtime owns the geometry cache, the mounted era layers and the group the
 * integration adds to the scene graph. It is deliberately React-free, so the
 * harness page, the composition suite and the React component all drive the same
 * code path.
 */
export function createPropsRuntime(layout: BlockLayout, options: PropsRuntimeOptions = {}): PropsRuntime {
  const cache = options.cache ?? createPropsGeometryCache()
  const root = new THREE.Group()
  root.name = 'props-layer'
  const layers = new Map<EraId, BuiltPropsLayer>()
  const plans = new Map<EraId, PropsLayerPlan>()
  let currentEra: EraId | null = null
  let currentBuilt: BuiltPropsLayer | null = null

  const planFor = (eraId: EraId, overrides?: { night?: boolean }): PropsLayerPlan => {
    const desiredNight = overrides?.night ?? options.night
    const cacheKey = `${eraId}:${desiredNight === undefined ? 'auto' : String(desiredNight)}`
    const cachedPlan = plans.get(cacheKey as EraId)
    if (cachedPlan !== undefined) {
      return cachedPlan
    }
    const plan = planEraProps(layout, { eraId, seed: options.seed, night: desiredNight })
    plans.set(cacheKey as EraId, plan)
    return plan
  }

  const layerFor = (
    eraId: EraId,
    overrides?: { night?: boolean; qualityTier?: QualityTierName },
  ): BuiltPropsLayer => {
    const existing = layers.get(eraId)
    if (existing !== undefined) {
      return existing
    }
    const plan = planFor(eraId, overrides)
    const built = buildPropsObject(plan, {
      cache,
      qualityTier: overrides?.qualityTier ?? options.qualityTier,
    })
    layers.set(eraId, built)
    root.add(built.root)
    while (layers.size > (options.maxCachedEras ?? RUNTIME_ERA_CACHE_LIMIT)) {
      const oldest = [...layers.keys()].find((era) => era !== currentEra)
      if (oldest === undefined) {
        break
      }
      const stale = layers.get(oldest)
      if (stale !== undefined) {
        stale.root.removeFromParent()
        disposeBuiltLayer(stale)
      }
      layers.delete(oldest)
    }
    return built
  }

  const showOnly = (eraId: EraId): void => {
    for (const [key, layer] of layers) {
      layer.root.visible = key === eraId
    }
    currentEra = eraId
    currentBuilt = layers.get(eraId) ?? null
    if (currentBuilt !== null) {
      settleBuiltLayer(currentBuilt)
    }
  }

  const runtime: PropsRuntime = {
    layout,
    root,
    options,
    get eraId() {
      return currentEra
    },
    get plan() {
      return currentEra === null ? null : planFor(currentEra)
    },
    get built() {
      return currentBuilt
    },
    get stats() {
      return currentBuilt?.stats ?? null
    },
    get cachedEras() {
      return [...layers.keys()]
    },
    applyEra(eraId, overrides) {
      const layer = layerFor(eraId, overrides)
      showOnly(layer.eraId)
      return layer.plan
    },
    applyEraTransition(input, overrides) {
      const fromLayer = layerFor(input.from, overrides)
      const toLayer = layerFor(input.to, overrides)
      const reducedMotion = overrides?.reducedMotion ?? options.reducedMotion ?? false
      const frame = planTransition(
        layout,
        { ...input, reducedMotion },
        { seed: options.seed, night: overrides?.night ?? options.night, qualityTier: overrides?.qualityTier ?? options.qualityTier },
      )
      fromLayer.root.visible = true
      toLayer.root.visible = true
      currentEra = input.to
      currentBuilt = toLayer

      const settled = frame.props
      // Retire everything first, then apply the frame's own weights, so props
      // that neither era shows at this instant disappear instead of lingering.
      for (const prop of frame.fromPlan.props) {
        setPropTransform(fromLayer, prop.key, transformOf(prop, 0))
      }
      for (const prop of frame.toPlan.props) {
        setPropTransform(toLayer, prop.key, transformOf(prop, 0))
      }
      for (const staged of settled) {
        const layer = staged.source === 'from' ? fromLayer : toLayer
        setPropTransform(layer, staged.prop.key, {
          position: staged.prop.position,
          rotationY: staged.prop.rotationY,
          scale: staged.prop.scale,
          weight: staged.weight,
        })
      }
      return frame
    },
    inspectEra(eraId) {
      return planFor(eraId)
    },
    dispose() {
      for (const layer of layers.values()) {
        layer.root.removeFromParent()
        disposeBuiltLayer(layer)
      }
      layers.clear()
      plans.clear()
      currentEra = null
      currentBuilt = null
      cache.dispose()
      root.clear()
    },
  }

  return runtime
}

/** Releases a mounted layer's meshes, materials and lights. */
export function disposeBuiltLayer(layer: BuiltPropsLayer): void {
  for (const batch of layer.batches) {
    batch.mesh.removeFromParent()
    batch.mesh.dispose()
  }
  for (const material of layer.materials) {
    material.dispose()
  }
  for (const light of layer.lights) {
    light.removeFromParent()
    light.dispose()
  }
  layer.root.clear()
}

/* ------------------------------------------------------------------------- *
 * Barrel entry points used by the transition director
 * ------------------------------------------------------------------------- */

/**
 * Shows one era immediately.
 *
 * ```ts
 * const runtime = createPropsRuntime(layout)
 * applyEra('1985', { runtime })
 * ```
 */
export function applyEra(eraId: EraId, context: PropsApplyContext): PropsLayerPlan {
  return context.runtime.applyEra(eraId, { night: context.night })
}

/**
 * Applies one frame of a staged era switch.
 *
 * Under reduced motion the frame collapses to an instant swap at the halfway
 * point, which is exactly what the accessibility path asks for: props appear,
 * transform and retire progressively for everyone else.
 */
export function applyEraTransition(
  input: PropsTransitionInput,
  context: PropsApplyContext,
): PropsTransitionPlan {
  return context.runtime.applyEraTransition(input, {
    night: context.night,
    reducedMotion: context.reducedMotion,
  })
}

/* ------------------------------------------------------------------------- *
 * React component
 * ------------------------------------------------------------------------- */

/** Imperative handle the scene integration and the harness read back. */
export interface PropsLayerHandle {
  readonly runtime: PropsRuntime | null
  applyEra(eraId: EraId): PropsLayerPlan | null
  applyEraTransition(input: PropsTransitionInput): PropsTransitionPlan | null
  getStats(): PropsLayerStats | null
}

/** Props of {@link PropsLayer}. */
export interface PropsLayerProps {
  /** The canonical block; the layer only reads it. */
  readonly layout: BlockLayout
  readonly eraId: EraId
  /** Staged switch to apply instead of a settled era, when the director asks. */
  readonly transition?: PropsTransitionInput | null
  /** Overrides the era's own night state (the lighting rig owns the real one). */
  readonly night?: boolean
  readonly reducedMotion?: boolean
  readonly qualityTier?: QualityTierName
  readonly seed?: string | number
  readonly onStats?: (stats: PropsLayerStats) => void
  readonly onReady?: (runtime: PropsRuntime) => void
}

/**
 * React mount point for the props layer.
 *
 * Renders a single group and attaches the runtime's root to it, so the layer can
 * be dropped into any three.js scene (the composed application's world group, the
 * harness page's canvas, or a test scene) without knowing about the renderer.
 */
export const PropsLayer = forwardRef<PropsLayerHandle, PropsLayerProps>(function PropsLayer(
  props,
  ref,
): ReactElement {
  const groupRef = useRef<THREE.Group | null>(null)
  const runtimeRef = useRef<PropsRuntime | null>(null)
  const { layout, eraId, transition, night, reducedMotion, qualityTier, seed, onStats, onReady } = props

  const runtimeOptions = useMemo<PropsRuntimeOptions>(
    () => ({ seed, qualityTier, night, reducedMotion }),
    [night, qualityTier, reducedMotion, seed],
  )

  useEffect(() => {
    const runtime = createPropsRuntime(layout, runtimeOptions)
    runtimeRef.current = runtime
    groupRef.current?.add(runtime.root)
    onReady?.(runtime)
    return () => {
      runtimeRef.current = null
      runtime.dispose()
    }
  }, [layout, onReady, runtimeOptions])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (runtime === null) {
      return
    }
    if (transition !== undefined && transition !== null) {
      runtime.applyEraTransition(transition, { night, reducedMotion, qualityTier })
    } else {
      runtime.applyEra(eraId, { night, qualityTier })
    }
    const stats = runtime.stats
    if (stats !== null) {
      onStats?.(stats)
    }
  }, [eraId, night, onStats, qualityTier, reducedMotion, runtimeOptions, transition])

  useImperativeHandle(
    ref,
    () => ({
      get runtime() {
        return runtimeRef.current
      },
      applyEra: (nextEra: EraId) => runtimeRef.current?.applyEra(nextEra) ?? null,
      applyEraTransition: (input: PropsTransitionInput) =>
        runtimeRef.current?.applyEraTransition(input) ?? null,
      getStats: () => runtimeRef.current?.stats ?? null,
    }),
    [],
  )

  const onGroupRef = useCallback((node: THREE.Group | null) => {
    groupRef.current = node
    const runtime = runtimeRef.current
    if (runtime !== null && node !== null && runtime.root.parent !== node) {
      node.add(runtime.root)
    }
  }, [])

  return <group ref={onGroupRef} name="props-layer-mount" userData={{ eraId }} />
})
