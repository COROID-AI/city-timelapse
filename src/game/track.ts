import * as THREE from 'three';

import type { TrackData, TrackHandle as BaseTrackHandle } from './contracts';

/** Configuration options for track generation. */
export interface TrackOptions {
  /** Track width in meters. Defaults to 14. */
  width?: number;
  /** Number of dense waypoints sampled along the circuit. Defaults to 250. */
  waypointCount?: number;
  /** Number of cross-sections for the ribbon mesh. Defaults to 360. */
  meshSegments?: number;
  /** Number of ordered checkpoints around the circuit. Defaults to 10. */
  checkpointCount?: number;
  /** Distance fog color. Defaults to 0x050714. */
  fogColor?: number;
  /** Distance fog density. Defaults to 0.0035. */
  fogDensity?: number;
}

/** Complete handle returned by buildTrack. */
export interface TrackHandle extends BaseTrackHandle {
  /** Dense, immutable track data (startLine, waypoints, checkpoints, width, closed). */
  readonly data: TrackData;
  /** Three.js group containing all track, props, buildings, lights, and set dressing. */
  readonly group: THREE.Group;
  /** Distance fog configured for the night circuit. */
  readonly fog: THREE.FogExp2;
  /** Procedural high-contrast night-city equirectangular environment texture. */
  readonly envMap: THREE.DataTexture;
  /** Main asphalt road mesh material tuned for wet reflections. */
  readonly asphaltMaterial: THREE.MeshStandardMaterial;
  /** All emissive neon signs lining the circuit. */
  readonly signs: THREE.Object3D[];
  /** All street lamp assemblies lining the circuit. */
  readonly lamps: THREE.Object3D[];
  /** City skyscrapers and backdrop buildings. */
  readonly buildings: THREE.Object3D[];
  /** Scene lights created for the track environment. */
  readonly lights: THREE.Light[];
  /** Releases all GPU geometries, materials, and textures. */
  dispose: () => void;
}

/** Neon sign specification along the circuit. */
interface NeonSignDef {
  /** Waypoint index around the track loop (0 to waypointCount - 1). */
  waypointIndex: number;
  /** Lateral offset from centerline (meters, positive = right, negative = left). */
  lateralOffset: number;
  /** Height above the road (meters). */
  height: number;
  /** Style of the neon sign. */
  type: 'gantry' | 'billboard' | 'chevron_cluster' | 'blade' | 'arch';
  /** Primary neon emissive color (hex). */
  primaryColor: number;
  /** Secondary neon emissive color (hex). */
  secondaryColor: number;
  /** Descriptive label text / theme. */
  label: string;
}

/** Control points defining the nighttime city street circuit (X/Z ground plane). */
const DEFAULT_CONTROL_POINTS: readonly THREE.Vector3[] = [
  new THREE.Vector3(0, 0, 0), // 0: Start / Finish line (heading East +X)
  new THREE.Vector3(80, 0, 0), // 1: Main start straightaway
  new THREE.Vector3(150, 0, 20), // 2: Turn 1 high-speed entry
  new THREE.Vector3(200, 0, 80), // 3: Turn 1 sweeping right
  new THREE.Vector3(190, 0, 160), // 4: Turn 1 exit / south avenue
  new THREE.Vector3(140, 0, 220), // 5: Chicane left turn
  new THREE.Vector3(90, 0, 200), // 6: Chicane right turn
  new THREE.Vector3(40, 0, 260), // 7: Downtown corner entry
  new THREE.Vector3(-40, 0, 280), // 8: South avenue straight
  new THREE.Vector3(-120, 0, 260), // 9: Hairpin entry
  new THREE.Vector3(-170, 0, 180), // 10: Hairpin apex
  new THREE.Vector3(-150, 0, 100), // 11: Hairpin exit / northbound
  new THREE.Vector3(-100, 0, 50), // 12: Plaza turn
  new THREE.Vector3(-80, 0, -30), // 13: North expressway
  new THREE.Vector3(-30, 0, -20), // 14: Final sweeper back to main straight
];

/** Rich palette of 12 emissive neon signs in magenta, cyan, and purple. */
const NEON_SIGN_DEFS: readonly NeonSignDef[] = [
  {
    waypointIndex: 0,
    lateralOffset: 0,
    height: 8.5,
    type: 'gantry',
    primaryColor: 0xff00aa, // Hot magenta
    secondaryColor: 0x00f0ff, // Electric cyan
    label: 'NEON GRAND PRIX',
  },
  {
    waypointIndex: 22,
    lateralOffset: 12,
    height: 6.5,
    type: 'billboard',
    primaryColor: 0x00f0ff, // Electric cyan
    secondaryColor: 0x9d00ff, // Vivid purple
    label: 'CYBER DYNAMICS',
  },
  {
    waypointIndex: 38,
    lateralOffset: 11,
    height: 3.5,
    type: 'chevron_cluster',
    primaryColor: 0xff007f, // Neon magenta
    secondaryColor: 0xff007f,
    label: 'TURN 1 CHEVRONS',
  },
  {
    waypointIndex: 58,
    lateralOffset: 0,
    height: 8.0,
    type: 'arch',
    primaryColor: 0x9d00ff, // Deep purple
    secondaryColor: 0x00ffff, // Cyan
    label: 'NEO-SHINJUKU 2055',
  },
  {
    waypointIndex: 82,
    lateralOffset: -12,
    height: 7.0,
    type: 'billboard',
    primaryColor: 0x00ffff, // Bright cyan
    secondaryColor: 0xff1493, // Deep pink / magenta
    label: 'NITRO BOOST ZONE',
  },
  {
    waypointIndex: 104,
    lateralOffset: 13,
    height: 12.0,
    type: 'blade',
    primaryColor: 0xbf00ff, // Bright purple / violet
    secondaryColor: 0x00e5ff, // Cyan
    label: 'HYPERION MOTORS',
  },
  {
    waypointIndex: 125,
    lateralOffset: 11,
    height: 3.5,
    type: 'chevron_cluster',
    primaryColor: 0x00e5ff, // Bright cyan
    secondaryColor: 0x00e5ff,
    label: 'CORNER 4 CHEVRONS',
  },
  {
    waypointIndex: 148,
    lateralOffset: -12,
    height: 6.5,
    type: 'billboard',
    primaryColor: 0xff00aa, // Magenta
    secondaryColor: 0x8a2be2, // Purple / blue-violet
    label: 'SYNTH SPEEDWAY',
  },
  {
    waypointIndex: 168,
    lateralOffset: 11,
    height: 4.0,
    type: 'chevron_cluster',
    primaryColor: 0xff0055, // Deep magenta
    secondaryColor: 0x9d00ff, // Purple
    label: 'HAIRPIN CHEVRONS',
  },
  {
    waypointIndex: 185,
    lateralOffset: 0,
    height: 8.0,
    type: 'gantry',
    primaryColor: 0x9d00ff, // Purple
    secondaryColor: 0xff00aa, // Magenta
    label: 'APEX DRIFT ZONE',
  },
  {
    waypointIndex: 208,
    lateralOffset: 13,
    height: 7.0,
    type: 'billboard',
    primaryColor: 0x00f0ff, // Cyan
    secondaryColor: 0xff007f, // Magenta
    label: 'QUANTUM OVERDRIVE',
  },
  {
    waypointIndex: 232,
    lateralOffset: -12,
    height: 11.0,
    type: 'blade',
    primaryColor: 0x8a2be2, // Purple
    secondaryColor: 0x00ffff, // Cyan
    label: 'VICTORY LANE',
  },
];

/**
 * Creates a procedural equirectangular night-city environment texture.
 * Features a dark indigo sky, glowing neon horizon bands in magenta, cyan, and purple,
 * and dark ground bounce with specular neon bleed.
 */
function createNightCityEnvMap(): THREE.DataTexture {
  const width = 128;
  const height = 64;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1); // 0 (zenith) to 1 (nadir)
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1); // 0 to 1 (360-degree horizontal azimuth)
      const idx = (y * width + x) * 4;

      let r = 0;
      let g = 0;
      let b = 0;

      if (v < 0.45) {
        // Sky zenith down to horizon
        const skyT = v / 0.45;
        r = 3 + skyT * 8;
        g = 5 + skyT * 10;
        b = 16 + skyT * 28;
      } else if (v >= 0.45 && v <= 0.6) {
        // Horizon band with city neon glow hotspots
        const horizT = 1 - Math.abs((v - 0.525) / 0.075);
        r = 16 + horizT * 26;
        g = 18 + horizT * 32;
        b = 42 + horizT * 65;

        // Magenta neon hotspot 1 (~45 deg)
        const dMag1 = Math.abs(u - 0.125);
        if (dMag1 < 0.055) {
          const intensity = (1 - dMag1 / 0.055) * horizT;
          r += intensity * 230;
          g += intensity * 20;
          b += intensity * 190;
        }

        // Cyan neon hotspot 1 (~135 deg)
        const dCyan1 = Math.abs(u - 0.375);
        if (dCyan1 < 0.065) {
          const intensity = (1 - dCyan1 / 0.065) * horizT;
          r += intensity * 0;
          g += intensity * 235;
          b += intensity * 255;
        }

        // Purple neon hotspot 1 (~215 deg)
        const dPurp1 = Math.abs(u - 0.6);
        if (dPurp1 < 0.055) {
          const intensity = (1 - dPurp1 / 0.055) * horizT;
          r += intensity * 170;
          g += intensity * 20;
          b += intensity * 255;
        }

        // Magenta neon hotspot 2 (~295 deg)
        const dMag2 = Math.abs(u - 0.82);
        if (dMag2 < 0.055) {
          const intensity = (1 - dMag2 / 0.055) * horizT;
          r += intensity * 255;
          g += intensity * 35;
          b += intensity * 160;
        }

        // Cyan neon hotspot 2 (~345 deg)
        const dCyan2 = Math.abs(u - 0.96);
        if (dCyan2 < 0.045) {
          const intensity = (1 - dCyan2 / 0.045) * horizT;
          r += intensity * 0;
          g += intensity * 225;
          b += intensity * 245;
        }
      } else {
        // Ground nadir / road bounce
        const groundT = (v - 0.6) / 0.4;
        r = Math.max(0, 14 - groundT * 10);
        g = Math.max(0, 16 - groundT * 12);
        b = Math.max(0, 26 - groundT * 18);
      }

      data[idx] = Math.min(255, Math.floor(r));
      data[idx + 1] = Math.min(255, Math.floor(g));
      data[idx + 2] = Math.min(255, Math.floor(b));
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a procedural building window grid texture with lit neon office windows.
 */
function createBuildingWindowTexture(): THREE.DataTexture {
  const width = 64;
  const height = 64;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const isWinY = (y % 8) >= 2 && (y % 8) <= 6;
    for (let x = 0; x < width; x++) {
      const isWinX = (x % 8) >= 2 && (x % 8) <= 6;
      const idx = (y * width + x) * 4;

      if (isWinY && isWinX) {
        const seed = (x * 47 + y * 83) % 100;
        if (seed < 25) {
          // Cyan lit window
          data[idx] = 0;
          data[idx + 1] = 220;
          data[idx + 2] = 255;
        } else if (seed < 45) {
          // Amber lit window
          data[idx] = 255;
          data[idx + 1] = 195;
          data[idx + 2] = 90;
        } else if (seed < 65) {
          // Magenta lit window
          data[idx] = 255;
          data[idx + 1] = 45;
          data[idx + 2] = 175;
        } else if (seed < 78) {
          // Purple lit window
          data[idx] = 165;
          data[idx + 1] = 40;
          data[idx + 2] = 255;
        } else {
          // Dark unlit window
          data[idx] = 12;
          data[idx + 1] = 16;
          data[idx + 2] = 25;
        }
      } else {
        // Dark concrete frame
        data[idx] = 8;
        data[idx + 1] = 10;
        data[idx + 2] = 16;
      }
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Builds the closed-loop nighttime street circuit.
 *
 * Returns a TrackHandle containing the scene group, TrackData (startLine pose,
 * dense closed racing-line waypoints, ordered checkpoint planes starting at the start line),
 * and dispose() that releases all geometries and materials.
 */
export function buildTrack(options: TrackOptions = {}): TrackHandle {
  const width = options.width ?? 14.0;
  const waypointCount = options.waypointCount ?? 250;
  const meshSegments = options.meshSegments ?? 360;
  const checkpointCount = options.checkpointCount ?? 10;
  const fogColor = options.fogColor ?? 0x050714;
  const fogDensity = options.fogDensity ?? 0.0035;

  const group = new THREE.Group();
  group.name = 'NightCircuitTrackGroup';

  // Distance fog for nighttime atmosphere depth
  const fog = new THREE.FogExp2(fogColor, fogDensity);

  // Procedural night city environment map for wet road reflections
  const envMap = createNightCityEnvMap();
  const windowTexture = createBuildingWindowTexture();

  // Closed-loop Catmull-Rom spline curve for the circuit
  const curve = new THREE.CatmullRomCurve3(
    [...DEFAULT_CONTROL_POINTS],
    true,
    'catmullrom',
    0.5,
  );

  // --- 1. Dense Waypoints & TrackData ---------------------------------------
  // getSpacedPoints(N) returns N + 1 points where [0] equals [N] for closed curves.
  const rawWaypoints = curve.getSpacedPoints(waypointCount);
  const waypoints = rawWaypoints.slice(0, waypointCount);

  // Start line pose at waypoint 0
  const tangent0 = curve.getTangent(0).normalize();
  const startHeading = Math.atan2(tangent0.x, tangent0.z);
  const startPosition = waypoints[0].clone();

  // Ordered checkpoints starting at waypoint 0
  const checkpoints: THREE.Vector3[] = [];
  for (let i = 0; i < checkpointCount; i++) {
    const wpIdx = Math.floor((i / checkpointCount) * waypoints.length);
    checkpoints.push(waypoints[wpIdx].clone());
  }

  const trackData: TrackData = {
    startLine: {
      position: startPosition,
      heading: startHeading,
    },
    waypoints,
    checkpoints,
    closed: true,
    width,
  };

  // --- 2. Track Frames along the Spline ------------------------------------
  interface TrackFrame {
    point: THREE.Vector3;
    tangent: THREE.Vector3;
    binormal: THREE.Vector3;
    normal: THREE.Vector3;
  }

  const frames: TrackFrame[] = [];
  const upVector = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= meshSegments; i++) {
    const t = (i / meshSegments) % 1.0;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, upVector).normalize();
    frames.push({
      point,
      tangent,
      binormal,
      normal: upVector.clone(),
    });
  }

  // --- 3. Dark Wet Asphalt Road Mesh ----------------------------------------
  const roadPositions: number[] = [];
  const roadNormals: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  const halfWidth = width / 2;

  for (let i = 0; i <= meshSegments; i++) {
    const frame = frames[i];
    const left = frame.point.clone().addScaledVector(frame.binormal, -halfWidth);
    const right = frame.point.clone().addScaledVector(frame.binormal, halfWidth);

    roadPositions.push(left.x, left.y, left.z);
    roadPositions.push(right.x, right.y, right.z);

    roadNormals.push(0, 1, 0, 0, 1, 0);

    const vCoord = i * 0.4;
    roadUvs.push(0, vCoord, 1, vCoord);

    if (i < meshSegments) {
      const row1 = i * 2;
      const row2 = (i + 1) * 2;
      roadIndices.push(row1, row1 + 1, row2);
      roadIndices.push(row1 + 1, row2 + 1, row2);
    }
  }

  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(roadPositions, 3),
  );
  roadGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
  roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeometry.setIndex(roadIndices);

  // High-gloss PBR wet asphalt material with env-map reflections
  const asphaltMaterial = new THREE.MeshStandardMaterial({
    color: 0x0e1119,
    roughness: 0.1, // Low roughness for wet gloss sheen
    metalness: 0.35, // Tuned specular reflectivity for rain-slick tarmac
    envMap,
    envMapIntensity: 2.2, // Vibrant ground reflections of neon night city
  });
  asphaltMaterial.name = 'WetReflectiveAsphaltMaterial';

  const roadMesh = new THREE.Mesh(roadGeometry, asphaltMaterial);
  roadMesh.name = 'WetAsphaltRoad';
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // --- 4. Lane Markings & Curbs ---------------------------------------------
  // Center dashed yellow/white line
  const dashPositions: number[] = [];
  const dashNormals: number[] = [];
  const dashIndices: number[] = [];
  const dashHalfWidth = 0.18;
  const dashElevation = 0.02;

  // Outer solid white edge lines
  const edgeLinePositions: number[] = [];
  const edgeLineNormals: number[] = [];
  const edgeLineIndices: number[] = [];
  const edgeLineHalfWidth = 0.15;
  const edgeOffset = halfWidth - 0.45;

  for (let i = 0; i <= meshSegments; i++) {
    const frame = frames[i];
    const isDashOn = (i % 8) < 4; // Repeating dash pattern

    if (isDashOn && i < meshSegments) {
      const nextFrame = frames[i + 1];
      const p1L = frame.point
        .clone()
        .addScaledVector(frame.binormal, -dashHalfWidth)
        .add(new THREE.Vector3(0, dashElevation, 0));
      const p1R = frame.point
        .clone()
        .addScaledVector(frame.binormal, dashHalfWidth)
        .add(new THREE.Vector3(0, dashElevation, 0));
      const p2L = nextFrame.point
        .clone()
        .addScaledVector(nextFrame.binormal, -dashHalfWidth)
        .add(new THREE.Vector3(0, dashElevation, 0));
      const p2R = nextFrame.point
        .clone()
        .addScaledVector(nextFrame.binormal, dashHalfWidth)
        .add(new THREE.Vector3(0, dashElevation, 0));

      const baseIdx = dashPositions.length / 3;
      dashPositions.push(
        p1L.x, p1L.y, p1L.z,
        p1R.x, p1R.y, p1R.z,
        p2L.x, p2L.y, p2L.z,
        p2R.x, p2R.y, p2R.z,
      );
      dashNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      dashIndices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx + 1, baseIdx + 3, baseIdx + 2);
    }

    // Left and right white edge lines
    if (i < meshSegments) {
      const nextFrame = frames[i + 1];
      // Left edge stripe
      const left1A = frame.point
        .clone()
        .addScaledVector(frame.binormal, -edgeOffset - edgeLineHalfWidth)
        .add(new THREE.Vector3(0, dashElevation, 0));
      const left1B = frame.point
        .clone()
        .addScaledVector(frame.binormal, -edgeOffset + edgeLineHalfWidth)
        .add(new THREE.Vector3(0, dashElevation, 0));
      const left2A = nextFrame.point
        .clone()
        .addScaledVector(nextFrame.binormal, -edgeOffset - edgeLineHalfWidth)
        .add(new THREE.Vector3(0, dashElevation, 0));
      const left2B = nextFrame.point
        .clone()
        .addScaledVector(nextFrame.binormal, -edgeOffset + edgeLineHalfWidth)
        .add(new THREE.Vector3(0, dashElevation, 0));

      const bIdxL = edgeLinePositions.length / 3;
      edgeLinePositions.push(
        left1A.x, left1A.y, left1A.z,
        left1B.x, left1B.y, left1B.z,
        left2A.x, left2A.y, left2A.z,
        left2B.x, left2B.y, left2B.z,
      );
      edgeLineNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      edgeLineIndices.push(bIdxL, bIdxL + 1, bIdxL + 2, bIdxL + 1, bIdxL + 3, bIdxL + 2);

      // Right edge stripe
      const right1A = frame.point
        .clone()
        .addScaledVector(frame.binormal, edgeOffset - edgeLineHalfWidth)
        .add(new THREE.Vector3(0, dashElevation, 0));
      const right1B = frame.point
        .clone()
        .addScaledVector(frame.binormal, edgeOffset + edgeLineHalfWidth)
        .add(new THREE.Vector3(0, dashElevation, 0));
      const right2A = nextFrame.point
        .clone()
        .addScaledVector(nextFrame.binormal, edgeOffset - edgeLineHalfWidth)
        .add(new THREE.Vector3(0, dashElevation, 0));
      const right2B = nextFrame.point
        .clone()
        .addScaledVector(nextFrame.binormal, edgeOffset + edgeLineHalfWidth)
        .add(new THREE.Vector3(0, dashElevation, 0));

      const bIdxR = edgeLinePositions.length / 3;
      edgeLinePositions.push(
        right1A.x, right1A.y, right1A.z,
        right1B.x, right1B.y, right1B.z,
        right2A.x, right2A.y, right2A.z,
        right2B.x, right2B.y, right2B.z,
      );
      edgeLineNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      edgeLineIndices.push(bIdxR, bIdxR + 1, bIdxR + 2, bIdxR + 1, bIdxR + 3, bIdxR + 2);
    }
  }

  // Dashed center line mesh
  const dashGeometry = new THREE.BufferGeometry();
  dashGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dashPositions, 3));
  dashGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(dashNormals, 3));
  dashGeometry.setIndex(dashIndices);
  const dashMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe033,
    roughness: 0.25,
    metalness: 0.2,
    emissive: 0x443300,
    emissiveIntensity: 0.8,
  });
  const dashMesh = new THREE.Mesh(dashGeometry, dashMaterial);
  dashMesh.name = 'CenterLineDashes';
  group.add(dashMesh);

  // Edge line mesh
  const edgeLineGeometry = new THREE.BufferGeometry();
  edgeLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgeLinePositions, 3));
  edgeLineGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(edgeLineNormals, 3));
  edgeLineGeometry.setIndex(edgeLineIndices);
  const edgeLineMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.25,
    metalness: 0.2,
    emissive: 0x222222,
    emissiveIntensity: 0.5,
  });
  const edgeLineMesh = new THREE.Mesh(edgeLineGeometry, edgeLineMaterial);
  edgeLineMesh.name = 'EdgeLines';
  group.add(edgeLineMesh);

  // Checkered Start / Finish Line Grid Banner
  const startFrame = frames[0];
  const sfWidth = width;
  const sfLength = 2.4;
  const sfHalfLen = sfLength / 2;
  const sfPos: number[] = [];
  const sfNorm: number[] = [];
  const sfIdx: number[] = [];

  const cols = 14;
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isWhite = (r + c) % 2 === 0;
      if (isWhite) {
        const u1 = -halfWidth + (c / cols) * sfWidth;
        const u2 = -halfWidth + ((c + 1) / cols) * sfWidth;
        const v1 = -sfHalfLen + (r / rows) * sfLength;
        const v2 = -sfHalfLen + ((r + 1) / rows) * sfLength;

        const p1 = startFrame.point
          .clone()
          .addScaledVector(startFrame.binormal, u1)
          .addScaledVector(startFrame.tangent, v1)
          .add(new THREE.Vector3(0, 0.03, 0));
        const p2 = startFrame.point
          .clone()
          .addScaledVector(startFrame.binormal, u2)
          .addScaledVector(startFrame.tangent, v1)
          .add(new THREE.Vector3(0, 0.03, 0));
        const p3 = startFrame.point
          .clone()
          .addScaledVector(startFrame.binormal, u1)
          .addScaledVector(startFrame.tangent, v2)
          .add(new THREE.Vector3(0, 0.03, 0));
        const p4 = startFrame.point
          .clone()
          .addScaledVector(startFrame.binormal, u2)
          .addScaledVector(startFrame.tangent, v2)
          .add(new THREE.Vector3(0, 0.03, 0));

        const base = sfPos.length / 3;
        sfPos.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z, p4.x, p4.y, p4.z);
        sfNorm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        sfIdx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
  }
  const sfGeom = new THREE.BufferGeometry();
  sfGeom.setAttribute('position', new THREE.Float32BufferAttribute(sfPos, 3));
  sfGeom.setAttribute('normal', new THREE.Float32BufferAttribute(sfNorm, 3));
  sfGeom.setIndex(sfIdx);
  const sfMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2,
    emissive: 0x333333,
    emissiveIntensity: 0.6,
  });
  const sfMesh = new THREE.Mesh(sfGeom, sfMat);
  sfMesh.name = 'StartFinishCheckeredLine';
  group.add(sfMesh);

  // Curbs / Rumble Strips (Alternating Red/White with beveled outer curb)
  const curbWidth = 1.2;
  const curbHeight = 0.08;
  const curbRedPositions: number[] = [];
  const curbRedNormals: number[] = [];
  const curbRedIndices: number[] = [];
  const curbWhitePositions: number[] = [];
  const curbWhiteNormals: number[] = [];
  const curbWhiteIndices: number[] = [];

  for (let i = 0; i < meshSegments; i++) {
    const frame = frames[i];
    const nextFrame = frames[i + 1];
    const isRed = (i % 6) < 3;
    const targetPos = isRed ? curbRedPositions : curbWhitePositions;
    const targetNorm = isRed ? curbRedNormals : curbWhiteNormals;
    const targetIdx = isRed ? curbRedIndices : curbWhiteIndices;

    // Left curb
    const l1A = frame.point
      .clone()
      .addScaledVector(frame.binormal, -halfWidth)
      .add(new THREE.Vector3(0, curbHeight, 0));
    const l1B = frame.point
      .clone()
      .addScaledVector(frame.binormal, -halfWidth - curbWidth)
      .add(new THREE.Vector3(0, curbHeight, 0));
    const l2A = nextFrame.point
      .clone()
      .addScaledVector(nextFrame.binormal, -halfWidth)
      .add(new THREE.Vector3(0, curbHeight, 0));
    const l2B = nextFrame.point
      .clone()
      .addScaledVector(nextFrame.binormal, -halfWidth - curbWidth)
      .add(new THREE.Vector3(0, curbHeight, 0));

    let base = targetPos.length / 3;
    targetPos.push(l1A.x, l1A.y, l1A.z, l1B.x, l1B.y, l1B.z, l2A.x, l2A.y, l2A.z, l2B.x, l2B.y, l2B.z);
    targetNorm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    targetIdx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);

    // Right curb
    const r1A = frame.point
      .clone()
      .addScaledVector(frame.binormal, halfWidth)
      .add(new THREE.Vector3(0, curbHeight, 0));
    const r1B = frame.point
      .clone()
      .addScaledVector(frame.binormal, halfWidth + curbWidth)
      .add(new THREE.Vector3(0, curbHeight, 0));
    const r2A = nextFrame.point
      .clone()
      .addScaledVector(nextFrame.binormal, halfWidth)
      .add(new THREE.Vector3(0, curbHeight, 0));
    const r2B = nextFrame.point
      .clone()
      .addScaledVector(nextFrame.binormal, halfWidth + curbWidth)
      .add(new THREE.Vector3(0, curbHeight, 0));

    base = targetPos.length / 3;
    targetPos.push(r1A.x, r1A.y, r1A.z, r1B.x, r1B.y, r1B.z, r2A.x, r2A.y, r2A.z, r2B.x, r2B.y, r2B.z);
    targetNorm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    targetIdx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  const curbRedGeom = new THREE.BufferGeometry();
  curbRedGeom.setAttribute('position', new THREE.Float32BufferAttribute(curbRedPositions, 3));
  curbRedGeom.setAttribute('normal', new THREE.Float32BufferAttribute(curbRedNormals, 3));
  curbRedGeom.setIndex(curbRedIndices);
  const curbRedMat = new THREE.MeshStandardMaterial({
    color: 0xdd1828,
    roughness: 0.25,
    metalness: 0.3,
    emissive: 0x330508,
    envMap,
    envMapIntensity: 1.5,
  });
  group.add(new THREE.Mesh(curbRedGeom, curbRedMat));

  const curbWhiteGeom = new THREE.BufferGeometry();
  curbWhiteGeom.setAttribute('position', new THREE.Float32BufferAttribute(curbWhitePositions, 3));
  curbWhiteGeom.setAttribute('normal', new THREE.Float32BufferAttribute(curbWhiteNormals, 3));
  curbWhiteGeom.setIndex(curbWhiteIndices);
  const curbWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf5f5f8,
    roughness: 0.25,
    metalness: 0.3,
    emissive: 0x222225,
    envMap,
    envMapIntensity: 1.5,
  });
  group.add(new THREE.Mesh(curbWhiteGeom, curbWhiteMat));

  // Sidewalks flanking curbs
  const sidewalkWidth = 4.5;
  const sidewalkHeight = 0.12;
  const swPositions: number[] = [];
  const swNormals: number[] = [];
  const swIndices: number[] = [];

  for (let i = 0; i < meshSegments; i++) {
    const frame = frames[i];
    const nextFrame = frames[i + 1];

    // Left sidewalk
    const l1A = frame.point
      .clone()
      .addScaledVector(frame.binormal, -halfWidth - curbWidth)
      .add(new THREE.Vector3(0, sidewalkHeight, 0));
    const l1B = frame.point
      .clone()
      .addScaledVector(frame.binormal, -halfWidth - curbWidth - sidewalkWidth)
      .add(new THREE.Vector3(0, sidewalkHeight, 0));
    const l2A = nextFrame.point
      .clone()
      .addScaledVector(nextFrame.binormal, -halfWidth - curbWidth)
      .add(new THREE.Vector3(0, sidewalkHeight, 0));
    const l2B = nextFrame.point
      .clone()
      .addScaledVector(nextFrame.binormal, -halfWidth - curbWidth - sidewalkWidth)
      .add(new THREE.Vector3(0, sidewalkHeight, 0));

    let base = swPositions.length / 3;
    swPositions.push(l1A.x, l1A.y, l1A.z, l1B.x, l1B.y, l1B.z, l2A.x, l2A.y, l2A.z, l2B.x, l2B.y, l2B.z);
    swNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    swIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);

    // Right sidewalk
    const r1A = frame.point
      .clone()
      .addScaledVector(frame.binormal, halfWidth + curbWidth)
      .add(new THREE.Vector3(0, sidewalkHeight, 0));
    const r1B = frame.point
      .clone()
      .addScaledVector(frame.binormal, halfWidth + curbWidth + sidewalkWidth)
      .add(new THREE.Vector3(0, sidewalkHeight, 0));
    const r2A = nextFrame.point
      .clone()
      .addScaledVector(nextFrame.binormal, halfWidth + curbWidth)
      .add(new THREE.Vector3(0, sidewalkHeight, 0));
    const r2B = nextFrame.point
      .clone()
      .addScaledVector(nextFrame.binormal, halfWidth + curbWidth + sidewalkWidth)
      .add(new THREE.Vector3(0, sidewalkHeight, 0));

    base = swPositions.length / 3;
    swPositions.push(r1A.x, r1A.y, r1A.z, r1B.x, r1B.y, r1B.z, r2A.x, r2A.y, r2A.z, r2B.x, r2B.y, r2B.z);
    swNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    swIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  const swGeom = new THREE.BufferGeometry();
  swGeom.setAttribute('position', new THREE.Float32BufferAttribute(swPositions, 3));
  swGeom.setAttribute('normal', new THREE.Float32BufferAttribute(swNormals, 3));
  swGeom.setIndex(swIndices);
  const swMat = new THREE.MeshStandardMaterial({
    color: 0x161822,
    roughness: 0.5,
    metalness: 0.2,
    envMap,
    envMapIntensity: 1.0,
  });
  group.add(new THREE.Mesh(swGeom, swMat));

  // --- 5. Scene Lights (Ambient & Moonlight) --------------------------------
  const lights: THREE.Light[] = [];

  // Deep midnight ambient illumination
  const ambientLight = new THREE.AmbientLight(0x0a1024, 0.45);
  ambientLight.name = 'NightAmbientLight';
  group.add(ambientLight);
  lights.push(ambientLight);

  // Soft directional moonlight casting high-angle wet highlights
  const moonLight = new THREE.DirectionalLight(0x283858, 0.65);
  moonLight.position.set(120, 160, 60);
  moonLight.name = 'DirectionalMoonLight';
  group.add(moonLight);
  lights.push(moonLight);

  // --- 6. Street Lamps ------------------------------------------------------
  const lamps: THREE.Object3D[] = [];
  const lampInterval = Math.max(6, Math.floor(waypointCount / 32));

  const lampPostMaterial = new THREE.MeshStandardMaterial({
    color: 0x222630,
    metalness: 0.85,
    roughness: 0.25,
  });
  const lampBulbMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff0c8,
    toneMapped: false,
  });

  for (let i = 0; i < waypointCount; i += lampInterval) {
    const t = i / waypointCount;
    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, upVector).normalize();

    // Alternate left / right sidewalk
    const isRight = (i / lampInterval) % 2 === 0;
    const lateralDist = isRight ? halfWidth + curbWidth + 1.2 : -(halfWidth + curbWidth + 1.2);
    const lampPos = pt.clone().addScaledVector(binormal, lateralDist);

    const lampGroup = new THREE.Group();
    lampGroup.name = `StreetLamp_${i}`;
    lampGroup.position.copy(lampPos);

    // Vertical pole (height 7.2m)
    const poleGeom = new THREE.CylinderGeometry(0.1, 0.14, 7.2, 8);
    const poleMesh = new THREE.Mesh(poleGeom, lampPostMaterial);
    poleMesh.position.set(0, 3.6, 0);
    lampGroup.add(poleMesh);

    // Cantilever arm arching over road
    const armDir = isRight ? -1 : 1;
    const armGeom = new THREE.BoxGeometry(2.4, 0.12, 0.12);
    const armMesh = new THREE.Mesh(armGeom, lampPostMaterial);
    armMesh.position.set(armDir * 1.0, 7.2, 0);
    armMesh.quaternion.setFromAxisAngle(
      upVector,
      Math.atan2(binormal.x, binormal.z),
    );
    lampGroup.add(armMesh);

    // Glowing lamp fixture
    const bulbGeom = new THREE.BoxGeometry(0.5, 0.12, 0.8);
    const bulbMesh = new THREE.Mesh(bulbGeom, lampBulbMaterial);
    const bulbWorldOffset = binormal.clone().multiplyScalar(armDir * 2.0);
    bulbMesh.position.set(bulbWorldOffset.x, 7.1, bulbWorldOffset.z);
    lampGroup.add(bulbMesh);

    // Downward street lamp light pool on wet asphalt
    const lampLight = new THREE.PointLight(0xffe8b8, 28, 26, 1.8);
    lampLight.position.set(bulbWorldOffset.x, 6.8, bulbWorldOffset.z);
    lampLight.name = `StreetLampLight_${i}`;
    lampGroup.add(lampLight);
    lights.push(lampLight);

    group.add(lampGroup);
    lamps.push(lampGroup);
  }

  // --- 7. Emissive Neon Signs in Magenta / Cyan / Purple --------------------
  const signs: THREE.Object3D[] = [];

  const trussMaterial = new THREE.MeshStandardMaterial({
    color: 0x181c26,
    metalness: 0.9,
    roughness: 0.2,
  });

  for (let sIdx = 0; sIdx < NEON_SIGN_DEFS.length; sIdx++) {
    const def = NEON_SIGN_DEFS[sIdx];
    const t = (def.waypointIndex / waypointCount) % 1.0;
    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, upVector).normalize();

    const signGroup = new THREE.Group();
    signGroup.name = `NeonSign_${sIdx}_${def.label}`;

    // Base position
    const signCenter = pt
      .clone()
      .addScaledVector(binormal, def.lateralOffset)
      .add(new THREE.Vector3(0, def.height, 0));
    signGroup.position.copy(signCenter);

    // Orientation: align with track tangent or facing oncoming racers
    const headingAngle = Math.atan2(tangent.x, tangent.z);
    signGroup.rotation.y = headingAngle;

    // Emissive materials for glowing neon
    const primaryNeonMat = new THREE.MeshStandardMaterial({
      color: def.primaryColor,
      emissive: new THREE.Color(def.primaryColor),
      emissiveIntensity: 3.5,
      roughness: 0.1,
      metalness: 0.1,
      toneMapped: false,
    });
    const secondaryNeonMat = new THREE.MeshStandardMaterial({
      color: def.secondaryColor,
      emissive: new THREE.Color(def.secondaryColor),
      emissiveIntensity: 3.5,
      roughness: 0.1,
      metalness: 0.1,
      toneMapped: false,
    });

    if (def.type === 'gantry') {
      // Overhead gantry spanning full track width
      const span = width + 4.0;
      // Steel truss frame
      const gantryBeamGeom = new THREE.BoxGeometry(span, 0.4, 0.4);
      const beamTop = new THREE.Mesh(gantryBeamGeom, trussMaterial);
      beamTop.position.set(0, 1.2, 0);
      beamTop.rotation.y = Math.PI / 2;
      signGroup.add(beamTop);

      const beamBottom = new THREE.Mesh(gantryBeamGeom, trussMaterial);
      beamBottom.position.set(0, -1.2, 0);
      beamBottom.rotation.y = Math.PI / 2;
      signGroup.add(beamBottom);

      // Support pillars on left and right
      const pillarGeom = new THREE.BoxGeometry(0.5, def.height + 2, 0.5);
      const pillarL = new THREE.Mesh(pillarGeom, trussMaterial);
      pillarL.position.set(-span / 2, -(def.height / 2), 0);
      pillarL.rotation.y = Math.PI / 2;
      signGroup.add(pillarL);

      const pillarR = new THREE.Mesh(pillarGeom, trussMaterial);
      pillarR.position.set(span / 2, -(def.height / 2), 0);
      pillarR.rotation.y = Math.PI / 2;
      signGroup.add(pillarR);

      // Main glowing neon banner panel
      const neonPanelGeom = new THREE.BoxGeometry(span - 2.0, 1.8, 0.2);
      const neonPanel = new THREE.Mesh(neonPanelGeom, primaryNeonMat);
      neonPanel.rotation.y = Math.PI / 2;
      signGroup.add(neonPanel);

      // Secondary glowing neon border trims
      const trimTopGeom = new THREE.BoxGeometry(span - 1.6, 0.15, 0.25);
      const trimTop = new THREE.Mesh(trimTopGeom, secondaryNeonMat);
      trimTop.position.set(0, 1.0, 0);
      trimTop.rotation.y = Math.PI / 2;
      signGroup.add(trimTop);

      const trimBottom = new THREE.Mesh(trimTopGeom, secondaryNeonMat);
      trimBottom.position.set(0, -1.0, 0);
      trimBottom.rotation.y = Math.PI / 2;
      signGroup.add(trimBottom);

      // PointLight illuminating track surface below gantry
      const neonLight1 = new THREE.PointLight(def.primaryColor, 35, 28, 1.8);
      neonLight1.position.set(0, -1.0, -1.5);
      neonLight1.name = `GantryNeonLight1_${sIdx}`;
      signGroup.add(neonLight1);
      lights.push(neonLight1);

      const neonLight2 = new THREE.PointLight(def.secondaryColor, 30, 24, 1.8);
      neonLight2.position.set(0, -1.0, 1.5);
      neonLight2.name = `GantryNeonLight2_${sIdx}`;
      signGroup.add(neonLight2);
      lights.push(neonLight2);
    } else if (def.type === 'chevron_cluster') {
      // 3 or 4 glowing neon arrow chevrons for sharp corners
      const chevronCount = 3;
      for (let c = 0; c < chevronCount; c++) {
        const cOffset = (c - 1) * 3.2;
        const chevGroup = new THREE.Group();
        chevGroup.position.set(0, 0, cOffset);

        // Arrow backplate
        const plateGeom = new THREE.BoxGeometry(0.2, 2.4, 2.4);
        const plate = new THREE.Mesh(plateGeom, trussMaterial);
        chevGroup.add(plate);

        // Arrow chevron arms forming '>'
        const armGeom = new THREE.BoxGeometry(0.25, 0.35, 1.4);
        const upperArm = new THREE.Mesh(armGeom, primaryNeonMat);
        upperArm.position.set(0.1, 0.45, -0.35);
        upperArm.rotation.x = Math.PI / 4;
        chevGroup.add(upperArm);

        const lowerArm = new THREE.Mesh(armGeom, primaryNeonMat);
        lowerArm.position.set(0.1, -0.45, -0.35);
        lowerArm.rotation.x = -Math.PI / 4;
        chevGroup.add(lowerArm);

        signGroup.add(chevGroup);
      }

      // Corner glow light
      const chevLight = new THREE.PointLight(def.primaryColor, 40, 30, 1.8);
      chevLight.position.set(0, 0, 0);
      chevLight.name = `ChevronLight_${sIdx}`;
      signGroup.add(chevLight);
      lights.push(chevLight);
    } else if (def.type === 'blade') {
      // Tall vertical neon blade sign on building facade
      const bladeHeight = 14.0;
      const bladeGeom = new THREE.BoxGeometry(0.4, bladeHeight, 2.2);
      const bladeBacking = new THREE.Mesh(bladeGeom, trussMaterial);
      signGroup.add(bladeBacking);

      // Glowing vertical neon strip bars
      const barGeom = new THREE.BoxGeometry(0.45, bladeHeight - 1.0, 0.35);
      const bar1 = new THREE.Mesh(barGeom, primaryNeonMat);
      bar1.position.set(0.1, 0, -0.6);
      signGroup.add(bar1);

      const bar2 = new THREE.Mesh(barGeom, secondaryNeonMat);
      bar2.position.set(0.1, 0, 0.6);
      signGroup.add(bar2);

      const bladeLight = new THREE.PointLight(def.primaryColor, 35, 32, 1.8);
      bladeLight.position.set(0, 0, 0);
      bladeLight.name = `BladeNeonLight_${sIdx}`;
      signGroup.add(bladeLight);
      lights.push(bladeLight);
    } else if (def.type === 'arch') {
      // Highway neon arch
      const archSpan = width + 6.0;
      const archGeom = new THREE.TorusGeometry(archSpan / 2, 0.4, 8, 24, Math.PI);
      const archMesh = new THREE.Mesh(archGeom, trussMaterial);
      archMesh.rotation.y = Math.PI / 2;
      signGroup.add(archMesh);

      // Glowing neon ribbon along arch
      const neonArchGeom = new THREE.TorusGeometry(archSpan / 2, 0.25, 8, 24, Math.PI);
      const neonArch = new THREE.Mesh(neonArchGeom, primaryNeonMat);
      neonArch.position.set(0, 0, 0.1);
      neonArch.rotation.y = Math.PI / 2;
      signGroup.add(neonArch);

      const archLight = new THREE.PointLight(def.primaryColor, 35, 28, 1.8);
      archLight.position.set(0, 0, 0);
      archLight.name = `ArchNeonLight_${sIdx}`;
      signGroup.add(archLight);
      lights.push(archLight);
    } else {
      // Billboard on support pylon
      const pylonGeom = new THREE.CylinderGeometry(0.3, 0.3, def.height, 8);
      const pylon = new THREE.Mesh(pylonGeom, trussMaterial);
      pylon.position.set(0, -def.height / 2, 0);
      signGroup.add(pylon);

      // Billboard backing
      const bbGeom = new THREE.BoxGeometry(0.3, 4.0, 8.0);
      const bbBacking = new THREE.Mesh(bbGeom, trussMaterial);
      signGroup.add(bbBacking);

      // Glowing neon display face
      const faceGeom = new THREE.BoxGeometry(0.35, 3.4, 7.4);
      const faceMesh = new THREE.Mesh(faceGeom, primaryNeonMat);
      signGroup.add(faceMesh);

      // Secondary neon frame trim
      const trimGeom = new THREE.BoxGeometry(0.4, 3.8, 0.25);
      const trimL = new THREE.Mesh(trimGeom, secondaryNeonMat);
      trimL.position.set(0, 0, -3.8);
      signGroup.add(trimL);
      const trimR = new THREE.Mesh(trimGeom, secondaryNeonMat);
      trimR.position.set(0, 0, 3.8);
      signGroup.add(trimR);

      const bbLight = new THREE.PointLight(def.primaryColor, 32, 28, 1.8);
      bbLight.position.set(0.5, 0, 0);
      bbLight.name = `BillboardNeonLight_${sIdx}`;
      signGroup.add(bbLight);
      lights.push(bbLight);
    }

    group.add(signGroup);
    signs.push(signGroup);
  }

  // --- 8. City Skyline Backdrop & High-Rise Buildings -----------------------
  const buildings: THREE.Object3D[] = [];

  /** Checks whether a candidate (x, z) location is safely outside track buffer. */
  const isSafeFromTrack = (x: number, z: number, clearance = 20.0): boolean => {
    for (let i = 0; i < waypointCount; i += 3) {
      const wp = waypoints[i];
      const dx = wp.x - x;
      const dz = wp.z - z;
      if (dx * dx + dz * dz < clearance * clearance) {
        return false;
      }
    }
    return true;
  };

  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0x090b14,
    roughness: 0.35,
    metalness: 0.4,
    map: windowTexture,
    envMap,
    envMapIntensity: 1.2,
  });

  const rooftopBeaconMat = new THREE.MeshBasicMaterial({
    color: 0xff0022,
    toneMapped: false,
  });

  // Inner & Outer City Grid Blocks
  for (let gx = -240; gx <= 260; gx += 28) {
    for (let gz = -100; gz <= 340; gz += 28) {
      const jitterX = ((gx * 37 + gz * 67) % 10) - 5;
      const jitterZ = ((gx * 73 + gz * 41) % 10) - 5;
      const bx = gx + jitterX;
      const bz = gz + jitterZ;

      const distFromOrigin = Math.hypot(bx, bz);
      const isPerimeter = distFromOrigin > 220;
      const clearance = isPerimeter ? 18.0 : 22.0;

      if (!isSafeFromTrack(bx, bz, clearance)) {
        continue;
      }

      // Height variation: taller on outer skyline, medium along street canyon
      const heightSeed = Math.abs((bx * 13 + bz * 29) % 100) / 100;
      const bHeight = isPerimeter
        ? 70 + heightSeed * 90 // Tall skyline silhouette (70m - 160m)
        : 25 + heightSeed * 55; // Roadside street high-rise (25m - 80m)

      const bWidth = 16 + ((bx * 17) % 8);
      const bDepth = 16 + ((bz * 19) % 8);

      const bGeom = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
      const bMesh = new THREE.Mesh(bGeom, buildingMaterial);
      bMesh.position.set(bx, bHeight / 2, bz);
      bMesh.name = `Skyscraper_${bx}_${bz}`;
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;

      // Rooftop antenna with glowing red hazard beacon
      const antennaGeom = new THREE.CylinderGeometry(0.15, 0.15, 8.0, 4);
      const antennaMesh = new THREE.Mesh(antennaGeom, trussMaterial);
      antennaMesh.position.set(0, bHeight / 2 + 4.0, 0);
      bMesh.add(antennaMesh);

      const beaconGeom = new THREE.SphereGeometry(0.4, 6, 6);
      const beaconMesh = new THREE.Mesh(beaconGeom, rooftopBeaconMat);
      beaconMesh.position.set(0, bHeight / 2 + 8.2, 0);
      bMesh.add(beaconMesh);

      group.add(bMesh);
      buildings.push(bMesh);
    }
  }

  // --- 9. Dispose Implementation -------------------------------------------
  let disposed = false;

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;

    // Traverse and dispose all geometries, materials, and textures
    group.traverse((obj) => {
      const meshObj = obj as THREE.Mesh;
      if (meshObj.geometry) {
        meshObj.geometry.dispose();
      }
      if (meshObj.material) {
        if (Array.isArray(meshObj.material)) {
          for (const mat of meshObj.material) {
            mat.dispose();
          }
        } else {
          meshObj.material.dispose();
        }
      }
    });

    // Explicitly dispose shared procedural textures
    envMap.dispose();
    windowTexture.dispose();

    // Clear group hierarchy
    group.clear();
  };

  return {
    get data() {
      return trackData;
    },
    get group() {
      return group;
    },
    get fog() {
      return fog;
    },
    get envMap() {
      return envMap;
    },
    get asphaltMaterial() {
      return asphaltMaterial;
    },
    get signs() {
      return signs;
    },
    get lamps() {
      return lamps;
    },
    get buildings() {
      return buildings;
    },
    get lights() {
      return lights;
    },
    dispose,
  };
}
