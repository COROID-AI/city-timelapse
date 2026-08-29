/**
 * Streetlight rig for the environment subsystem.
 *
 * The lamp posts evolve with the era: 1945 cast-iron gas lamps, 1965 sodium
 * cobra heads, 1985 HPS, 2005 fluorescent/HPS, 2025 LED. The rig owns a set
 * of posts around the block (positions derived from the shared block extent
 * config) plus one point light per post. `applyLightBlend` lerps the light
 * color and intensity across era transitions, and `setLightStyle` swaps the
 * lamp head geometry so the fixture itself matches the era.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
} from 'three';
import type { Material } from 'three';
import type { RgbColor } from '../engine/eras';
import { getLampPositions } from './layout';

const clamp = MathUtils.clamp;

/** Streetlight fixture styles, one per era. */
export type StreetlightStyle = 'gas' | 'sodium' | 'hps' | 'fluorescent' | 'led';

/** The rig's era state for one era. */
export interface EraLightState {
  readonly style: StreetlightStyle;
  readonly color: RgbColor;
  readonly poolColor: RgbColor;
  readonly intensity: number;
}

/** One erected lamp post: pole + head group + point light. */
export interface LampPost {
  readonly group: Group;
  readonly light: PointLight;
  readonly head: Group;
}

/**
 * Builds the streetlight rig. Every post is placed from the shared block
 * extent config; the head geometry and light values come from the era state.
 */
export function buildStreetlightRig(state: EraLightState, count = 8): Group {
  const rig = new Group();
  rig.name = 'environment-streetlights';

  const poleMaterial = new MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.55, metalness: 0.7 });
  const positions = getLampPositions(count);

  for (const pos of positions) {
    const post = buildLampPost(state, poleMaterial);
    post.group.position.set(pos.x, 0, pos.z);
    rig.add(post.group);
  }
  return rig;
}

/** Builds a single lamp post group with its point light. */
export function buildLampPost(state: EraLightState, poleMaterial: Material): LampPost {
  const group = new Group();
  group.name = 'environment-lamp-post';

  const pole = new Mesh(new CylinderGeometry(0.07, 0.1, 3.4, 8), poleMaterial);
  pole.position.y = 1.7;
  group.add(pole);

  const base = new Mesh(new CylinderGeometry(0.24, 0.3, 0.18, 8), poleMaterial);
  base.position.y = 0.09;
  group.add(base);

  const head = new Group();
  head.name = 'environment-lamp-head';
  head.position.y = 3.4;
  group.add(head);

  const light = new PointLight(
    new Color().setRGB(state.color.r, state.color.g, state.color.b),
    state.intensity,
    14,
    1.6,
  );
  light.name = 'environment-lamp-light';
  light.position.y = 3.5;
  group.add(light);

  setHeadStyle(head, state.style);
  return { group, light, head };
}

/**
 * Rebuilds the lamp head geometry for the given fixture style. Keeps the
 * head group identity so callers can keep references while swapping parts.
 */
export function setHeadStyle(head: Group, style: StreetlightStyle): void {
  for (const child of [...head.children]) {
    head.remove(child);
    disposeMesh(child as Mesh);
  }

  const dark = new MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.6, metalness: 0.6 });
  const glass = new MeshStandardMaterial({
    color: 0xfff6e0,
    emissive: 0xffd9a0,
    emissiveIntensity: 0.9,
    roughness: 0.35,
    transparent: true,
    opacity: 0.95,
  });

  if (style === 'gas') {
    // Cast-iron gas lamp: fluted column stub + glass lantern + finial.
    const neck = new Mesh(new CylinderGeometry(0.05, 0.07, 0.5, 8), dark);
    neck.position.y = 0.25;
    head.add(neck);
    const lantern = new Mesh(new CylinderGeometry(0.16, 0.16, 0.42, 8), glass);
    lantern.position.y = 0.62;
    head.add(lantern);
    const finial = new Mesh(new SphereGeometry(0.05, 8, 6), dark);
    finial.position.y = 0.88;
    head.add(finial);
  } else if (style === 'sodium') {
    // Mid-century cobra head with a warm sodium lamp.
    const arm = new Mesh(new CylinderGeometry(0.05, 0.05, 0.7, 8), dark);
    arm.rotation.z = Math.PI / 2 - 0.35;
    arm.position.set(0.3, 0.3, 0);
    head.add(arm);
    const cobra = new Mesh(new CapsuleGeometry(0.14, 0.5, 4, 8), dark);
    cobra.rotation.z = -0.35;
    cobra.position.set(0.55, 0.15, 0);
    head.add(cobra);
    const lamp = new Mesh(new BoxGeometry(0.42, 0.14, 0.2), glass);
    lamp.position.set(0.55, 0.02, 0);
    head.add(lamp);
  } else if (style === 'hps') {
    // High-pressure sodium cobra head: sealed rectangular housing.
    const arm = new Mesh(new CylinderGeometry(0.05, 0.05, 0.6, 8), dark);
    arm.rotation.z = Math.PI / 2 - 0.3;
    arm.position.set(0.28, 0.28, 0);
    head.add(arm);
    const housing = new Mesh(new BoxGeometry(0.5, 0.16, 0.24), dark);
    housing.position.set(0.5, 0.16, 0);
    head.add(housing);
    const lamp = new Mesh(new BoxGeometry(0.44, 0.08, 0.18), glass);
    lamp.position.set(0.5, 0.04, 0);
    head.add(lamp);
  } else if (style === 'fluorescent') {
    // Fluorescent/HPS twin-tube fixture on a short mast arm.
    const mast = new Mesh(new CylinderGeometry(0.04, 0.05, 0.5, 8), dark);
    mast.position.set(0.18, 0.25, 0);
    head.add(mast);
    const arm = new Mesh(new BoxGeometry(0.7, 0.06, 0.08), dark);
    arm.position.set(0.45, 0.5, 0);
    head.add(arm);
    const tubeA = new Mesh(new BoxGeometry(0.6, 0.05, 0.1), glass);
    tubeA.position.set(0.45, 0.44, -0.06);
    head.add(tubeA);
    const tubeB = new Mesh(new BoxGeometry(0.6, 0.05, 0.1), glass);
    tubeB.position.set(0.45, 0.44, 0.06);
    head.add(tubeB);
  } else {
    // LED: slim modern arm with a flat rectangular panel.
    const arm = new Mesh(new CylinderGeometry(0.035, 0.045, 0.8, 8), dark);
    arm.rotation.z = Math.PI / 2 - 0.18;
    arm.position.set(0.36, 0.32, 0);
    head.add(arm);
    const panel = new Mesh(new BoxGeometry(0.42, 0.07, 0.16), dark);
    panel.position.set(0.72, 0.18, 0);
    head.add(panel);
    const lens = new Mesh(new BoxGeometry(0.36, 0.05, 0.13), glass);
    lens.position.set(0.72, 0.13, 0);
    head.add(lens);
  }
}

/**
 * Applies a light state to the rig's lights and lamp heads. Used for initial
 * build and (through `applyLightBlend`) for era transitions.
 */
export function applyLightState(rig: Group, state: EraLightState): void {
  for (const post of collectPosts(rig)) {
    post.light.color.setRGB(state.color.r, state.color.g, state.color.b);
    post.light.intensity = state.intensity;
    setHeadStyle(post.head, state.style);
  }
}

/**
 * Lerps two light states at progress `t` and writes the result into the
 * rig's point lights and lamp heads.
 */
export function applyLightBlend(rig: Group, from: EraLightState, to: EraLightState, t: number): void {
  const k = clamp(t, 0, 1);
  const color = new Color().lerpColors(
    new Color().setRGB(from.color.r, from.color.g, from.color.b),
    new Color().setRGB(to.color.r, to.color.g, to.color.b),
    k,
  );
  const intensity = MathUtils.lerp(from.intensity, to.intensity, k);
  const style = k < 0.5 ? from.style : to.style;

  for (const post of collectPosts(rig)) {
    post.light.color.copy(color);
    post.light.intensity = intensity;
    setHeadStyle(post.head, style);
  }
}

/** Collects the lamp posts inside a rig group. */
export function collectPosts(rig: Group): LampPost[] {
  const posts: LampPost[] = [];
  rig.traverse((child) => {
    if (child.name === 'environment-lamp-post' && child instanceof Group) {
      const light = child.getObjectByName('environment-lamp-light') as PointLight | undefined;
      const head = child.getObjectByName('environment-lamp-head') as Group | undefined;
      if (light && head) {
        posts.push({ group: child, light, head });
      }
    }
  });
  return posts;
}

/** Disposes a mesh's geometry and material if owned by the head. */
function disposeMesh(mesh: Mesh): void {
  mesh.geometry.dispose();
  const material = mesh.material;
  if (Array.isArray(material)) {
    for (const m of material) m.dispose();
  } else if (material) {
    material.dispose();
  }
}