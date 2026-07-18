import {
  BoxGeometry,
  Color,
  MeshStandardMaterial,
  PlaneGeometry,
  type WebGLProgramParametersWithUniforms,
} from 'three';

/**
 * Procedural materials & shared geometries.
 *
 * Everything here is created *once* and reused for the lifetime of the scene.
 * Per-frame mutation happens through captured uniform objects (no allocation).
 */

export interface FacadeUniforms {
  uWindowColor: { value: Color };
  uWindowEmissive: { value: number };
  uFloors: { value: number };
  uCols: { value: number };
  uNight: { value: number };
  uTime: { value: number };
  uSeed: { value: number };
  uBaseColor: { value: Color };
}

export interface FacadeMaterial {
  material: MeshStandardMaterial;
  uniforms: FacadeUniforms;
}

/**
 * A MeshStandardMaterial with a procedurally-generated emissive window grid
 * injected via `onBeforeCompile`. Walls still receive full PBR lighting; lit
 * windows add emissive radiance that the bloom pass picks up at night/dusk.
 *
 * Each building gets its own clone (shared compiled program) so per-building
 * seeds and column counts vary, while the GPU shader program is cached once.
 */
export function createFacadeMaterial(
  baseColor: Color,
  seed: number,
  cols: number,
  roughness: number,
  metalness: number,
): FacadeMaterial {
  const material = new MeshStandardMaterial({
    color: baseColor.clone(),
    roughness,
    metalness,
  });

  const uniforms: FacadeUniforms = {
    uWindowColor: { value: new Color(0xffcf87) },
    uWindowEmissive: { value: 0.2 },
    uFloors: { value: 4 },
    uCols: { value: cols },
    uNight: { value: 0 },
    uTime: { value: 0 },
    uSeed: { value: seed },
    uBaseColor: { value: baseColor.clone() },
  };

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    // Bind our uniform objects directly so external mutation reaches the GPU.
    shader.uniforms.uWindowColor = uniforms.uWindowColor;
    shader.uniforms.uWindowEmissive = uniforms.uWindowEmissive;
    shader.uniforms.uFloors = uniforms.uFloors;
    shader.uniforms.uCols = uniforms.uCols;
    shader.uniforms.uNight = uniforms.uNight;
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uSeed = uniforms.uSeed;

    // Inject a custom UV varying — vUv only exists when USE_UV is defined.
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n varying vec2 vFacadeUv;')
      .replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\n vFacadeUv = uv;',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uWindowColor;
        uniform float uWindowEmissive;
        uniform float uFloors;
        uniform float uCols;
        uniform float uNight;
        uniform float uTime;
        uniform float uSeed;
        varying vec2 vFacadeUv;
        float hashWin(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec2 fuv = vFacadeUv;
          float rows = max(1.0, floor(uFloors + 0.5));
          vec2 grid = vec2(uCols, rows);
          vec2 cell = floor(fuv * grid);
          vec2 cellUv = fract(fuv * grid);
          vec2 winMargin = vec2(0.14, 0.16);
          float winMask = step(winMargin.x, cellUv.x) * step(cellUv.x, 1.0 - winMargin.x)
                        * step(winMargin.y, cellUv.y) * step(cellUv.y, 1.0 - winMargin.y);
          float litRandom = hashWin(cell + vec2(uSeed, uSeed * 1.7));
          float lit = step(0.42, litRandom);
          float flicker = 0.88 + 0.12 * sin(uTime * 1.7 + litRandom * 60.0);
          float litIntensity = winMask * lit * uNight;
          totalEmissiveRadiance += uWindowColor * uWindowEmissive * flicker * litIntensity;
          // unlit / daytime windows read as dark glass
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.35, winMask * (1.0 - litIntensity * 0.7));
        }`,
      );
  };

  material.customProgramCacheKey = () => 'facade-window-v1';

  return { material, uniforms };
}

// --- Ground / road material ------------------------------------------------

export interface GroundUniforms {
  uAsphalt: { value: Color };
  uSidewalk: { value: Color };
  uRoadHalf: { value: number };
  uTime: { value: number };
}

export interface GroundMaterial {
  material: MeshStandardMaterial;
  uniforms: GroundUniforms;
}

/**
 * A single large ground plane whose fragment shader paints asphalt, lane
 * markings, crosswalk stripes, and sidewalk bands from world-space XZ coords.
 * One draw call for the entire street surface.
 */
export function createGroundMaterial(asphalt: Color, sidewalk: Color): GroundMaterial {
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0.0,
  });

  const uniforms: GroundUniforms = {
    uAsphalt: { value: asphalt.clone() },
    uSidewalk: { value: sidewalk.clone() },
    uRoadHalf: { value: 4.0 },
    uTime: { value: 0 },
  };

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uAsphalt = uniforms.uAsphalt;
    shader.uniforms.uSidewalk = uniforms.uSidewalk;
    shader.uniforms.uRoadHalf = uniforms.uRoadHalf;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPosXZ;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vWorldPosXZ = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uAsphalt;
        uniform vec3 uSidewalk;
        uniform float uRoadHalf;
        varying vec3 vWorldPosXZ;
        float ghash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1)))*43758.5453); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 p = vWorldPosXZ.xz;
          float rh = uRoadHalf;
          float sw = rh + 2.4;          // sidewalk outer edge
          bool roadX = abs(p.x) < rh;   // N-S road
          bool roadZ = abs(p.y) < rh;   // E-W road
          bool isRoad = roadX || roadZ;
          float minAxis = min(abs(p.x), abs(p.y));
          bool isSidewalk = (!isRoad) && (minAxis < sw);

          vec3 col = uAsphalt;
          // subtle asphalt grain
          col *= 0.92 + 0.08 * ghash(floor(p * 8.0));

          if (isRoad) {
            // dashed center line along the road's long axis
            float center = 0.0;
            float along, across;
            if (roadX && !roadZ) { along = p.y; across = p.x; }
            else if (roadZ && !roadX) { along = p.x; across = p.y; }
            else { along = 0.0; across = 0.0; }
            // lane dashes
            float dash = step(0.5, fract(along * 0.5));
            bool centerLine = (roadX && abs(p.y) < 0.18) || (roadZ && abs(p.x) < 0.18);
            if (centerLine) col = mix(col, vec3(0.95, 0.93, 0.7), dash * 0.85);
            // edge lines (solid white near sidewalk)
            bool edgeX = roadX && (abs(abs(p.y) - (rh - 0.5)) < 0.12);
            bool edgeZ = roadZ && (abs(abs(p.x) - (rh - 0.5)) < 0.12);
            if (edgeX || edgeZ) col = mix(col, vec3(0.9), 0.7);

            // crosswalk stripes near the intersection on each approach
            float ap = abs(along);
            if (ap > rh + 0.4 && ap < rh + 3.0) {
              float stripe = step(0.5, fract(across * 1.2));
              col = mix(col, vec3(0.92), stripe * 0.8);
            }
          } else if (isSidewalk) {
            col = uSidewalk;
            col *= 0.9 + 0.1 * ghash(floor(p * 6.0));
            // expansion joints
            vec2 j = abs(fract(p * 0.5) - 0.5);
            float joint = smoothstep(0.46, 0.5, max(j.x, j.y));
            col *= 1.0 - joint * 0.25;
          } else {
            // block / lot base — dark ground beyond sidewalk
            col = uAsphalt * 0.6;
          }
          diffuseColor.rgb = col;
        }`,
      );
  };

  material.customProgramCacheKey = () => 'ground-road-v1';

  return { material, uniforms };
}

// --- Shared stable geometries (created once) ------------------------------

/** Unit box centred so its base sits on y=0; scale Y for height. */
export const UNIT_BOX = new BoxGeometry(1, 1, 1);
UNIT_BOX.translate(0, 0.5, 0);

/** Large flat ground plane. */
export function makeGroundGeometry(size: number): PlaneGeometry {
  const g = new PlaneGeometry(size, size, 1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Thin box for sidewalk slabs / curbs. */
export const CURB_BOX = new BoxGeometry(1, 1, 1);

// Dispose helper for geometries/materials on unmount.
export function disposeFacade(fm: FacadeMaterial): void {
  fm.material.dispose();
}


