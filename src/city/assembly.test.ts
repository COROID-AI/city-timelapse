/**
 * Assembly composition test — mounts the REAL modules together against the
 * real era contracts and proves the integrated experience:
 *
 * 1. every declared module mounts into one block corner aligned by the
 *    shared slot constants (streets, sidewalks, bays, lanes, crowd lanes);
 * 2. the pickable registry is wired from every content module and the
 *    era-aware callout provider returns different copy per era;
 * 3. a single slider move drives one full transition that reaches EVERY
 *    registered transformable, in staged order
 *    (facades → signage → fleet → crowd → lights), with the configured
 *    `sound` step riding the shared core;
 * 4. module sound hooks reach the audio director's documented bus;
 * 5. scrubbing the slider without a transition still dispatches a full
 *    frame (the scene always tracks the timeline).
 *
 * The test runs headless (jsdom): scene graph + contracts only, no GPU.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { createCityScene } from '../scene/shell';
import {
  ERA_MORPH_STAGES,
  createEraMorphSystem,
  type EraMorphStage,
  type EraMorphSystem,
  type EraTransformable,
} from '../era/contracts';
import { yearToPosition, type EraBlend } from '../era/timeline';
import {
  createSceneNavigation,
  type CalloutContent,
  type SceneNavigation,
} from '../controls/navigation';
import { mountTimelineUI, type TimelineUI } from '../ui/timeline';
import { createAudioHookBus, type AudioHookBus } from '../audio/hooks';
import { AudioDirector } from '../audio/director';
import {
  BLOCK_ALIGNMENT,
  BUILDING_LOTS,
  FRONTAGE_LINE,
  STREET_HALF_WIDTH,
} from './buildings/index';
import { LANE_CENTERS } from './vehicles/index';
import {
  DRIVE_LANE_CENTERS,
  SIDEWALK_WALK_LANE_CENTER,
  STREET_LAYOUT,
  STREET_WIDTH,
  isPropPresent,
} from './street/index';
import { STOREFRONT_AUDIO_HOOKS } from './storefronts/index';
import {
  CROWD_CROSSING_X,
  CROWD_CURB_Z,
  STREET_ORIGIN_OFFSET,
  TRAFFIC_STREET_HALF_LENGTH,
  createCityBlock,
  type CityBlock,
} from './block';
import {
  CITY_MORPH_CHOREOGRAPHY,
  auditChoreography,
  createStagedEraPump,
  stageLabel,
  stageWindow,
  type StagedEraPump,
} from './choreography';

/* -------------------------------------------------------------------------- */
/* Morph recorder — wraps every registry member's applyEraBlend                */
/* -------------------------------------------------------------------------- */

interface MorphCall {
  readonly frame: number;
  readonly stage: EraMorphStage;
  readonly progress: number;
  readonly blend: EraBlend;
}

const recorded = new Map<EraTransformable, MorphCall[]>();
const originals = new Map<EraTransformable, EraTransformable['applyEraBlend']>();
let recorderFrame = 0;

function attachMorphRecorder(members: readonly EraTransformable[]): void {
  for (const member of members) {
    const calls: MorphCall[] = [];
    recorded.set(member, calls);
    const original = member.applyEraBlend;
    originals.set(member, original);
    member.applyEraBlend = (blend, offset, progress): void => {
      calls.push({
        frame: recorderFrame,
        stage: member.stage,
        progress,
        blend: { from: blend.from, to: blend.to, fraction: blend.fraction },
      });
      original.call(member, blend, offset, progress);
    };
  }
}

function restoreMorphRecorder(): void {
  for (const [member, original] of originals) member.applyEraBlend = original;
  originals.clear();
}

/** First frame where any member of `stage` received progress > 0. */
function firstMovingFrame(stage: EraMorphStage): number {
  let best = Number.POSITIVE_INFINITY;
  for (const [member, calls] of recorded) {
    if (member.stage !== stage) continue;
    const move = calls.find((call) => call.progress > 0);
    if (move) best = Math.min(best, move.frame);
  }
  return best;
}

function totalCalls(): number {
  let total = 0;
  for (const calls of recorded.values()) total += calls.length;
  return total;
}

/* -------------------------------------------------------------------------- */
/* Shared fixtures                                                             */
/* -------------------------------------------------------------------------- */

const stagedOrder: readonly EraMorphStage[] = ['facade', 'signage', 'fleet', 'crowd', 'lights'];

const f = {} as {
  scene: ReturnType<typeof createCityScene>;
  eraSystem: EraMorphSystem;
  block: CityBlock;
  pump: StagedEraPump;
  timeline: TimelineUI;
  navigation: SceneNavigation;
  overlay: HTMLElement;
  camera: THREE.PerspectiveCamera;
  audioBus: AudioHookBus;
  audio: AudioDirector;
  disconnectAudio: () => void;
  sampleIds: Record<string, string>;
  samplesAt1945: Record<string, CalloutContent>;
  counters: { storefrontDoorHooks: number; streetRingtoneHooks: number; hornHooks: number; signSwaps: number };
};

function pick(id: string): import('../controls/navigation').PickableDescriptor {
  const descriptor = f.block.pickables.find((entry) => entry.id === id);
  if (!descriptor) throw new Error(`pickable ${id} not registered`);
  return descriptor;
}

function describeSample(id: string): CalloutContent {
  return f.block.calloutContentProvider(pick(id), new THREE.Vector3());
}

describe('choreography configuration (one place)', () => {
  it('spells out facades → signage → fleet → crowd → lights → sound, matching the contract', () => {
    expect(CITY_MORPH_CHOREOGRAPHY.map((step) => step.stage)).toEqual([...ERA_MORPH_STAGES]);
    expect(CITY_MORPH_CHOREOGRAPHY.map((step) => step.label)).toEqual([
      'Facades',
      'Signage',
      'Fleet',
      'Crowd',
      'Lights',
      'Sound',
    ]);
    expect(CITY_MORPH_CHOREOGRAPHY.map((step) => step.driver)).toEqual([
      'registry',
      'registry',
      'registry',
      'registry',
      'registry',
      'timeline-core',
    ]);
    expect(stageLabel('crowd')).toBe('Crowd');
  });

  it('gives every stage an equal consecutive window', () => {
    expect(stageWindow('facade')).toEqual({ start: 0, end: 1 / 6 });
    expect(stageWindow('signage').start).toBeCloseTo(1 / 6, 9);
    expect(stageWindow('fleet').start).toBeCloseTo(2 / 6, 9);
    expect(stageWindow('crowd').start).toBeCloseTo(3 / 6, 9);
    expect(stageWindow('lights').start).toBeCloseTo(4 / 6, 9);
    expect(stageWindow('sound').start).toBeCloseTo(5 / 6, 9);
    expect(stageWindow('sound').end).toBeCloseTo(1, 9);
  });
});

describe('composed city block', () => {
  beforeAll(() => {
    const scene = createCityScene();
    const eraSystem = createEraMorphSystem();

    const block = createCityBlock({
      scene: scene.scene,
      cityRoot: scene.cityRoot,
      eraSystem,
      renderer: null,
      container: null,
      quality: 'medium',
    });

    // Recorder before any transition so every dispatch below is observed.
    attachMorphRecorder(eraSystem.registry.members);

    const pump = createStagedEraPump(eraSystem);

    // Timeline UI sharing the core (app-owned frame pump).
    const host = document.createElement('div');
    document.body.appendChild(host);
    const timeline = mountTimelineUI({
      container: host,
      core: eraSystem.core,
      autoAdvance: false,
    });

    // Navigation with the block's callout provider and pickable registry.
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
    camera.position.set(26, 20, 26);
    camera.lookAt(0, 1, 0);
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    const updaters = new Set<(deltaSeconds: number) => void>();
    const navigation = createSceneNavigation({
      domElement: document.createElement('div'),
      camera,
      onUpdate: (callback) => {
        updaters.add(callback);
        return () => updaters.delete(callback);
      },
      overlayRoot: overlay,
      calloutContentProvider: block.calloutContentProvider,
      bounds: block.navigationBounds(),
    });
    block.registerPickables(navigation);

    // Audio director on the shared core + module hook bridge.
    const audioBus = createAudioHookBus();
    const counters = {
      storefrontDoorHooks: 0,
      streetRingtoneHooks: 0,
      hornHooks: 0,
      signSwaps: 0,
    };
    // The storefront bridge always carries `gain`; the street bridge omits it,
    // which disambiguates the two sources on the shared `door` event.
    audioBus.on('door', (event) => {
      if (event.gain !== undefined) counters.storefrontDoorHooks += 1;
    });
    audioBus.on('ringtone', () => {
      counters.streetRingtoneHooks += 1;
    });
    audioBus.on('street-horn', () => {
      counters.hornHooks += 1;
    });
    const audio = new AudioDirector({
      core: eraSystem.core,
      hooks: audioBus,
      gestureTarget: null,
    });
    const disconnectAudio = block.connectAudio(audio);
    const firstRow = block.storefrontRows[0];
    firstRow.module.onAudioEvent((event) => {
      if (event.type === STOREFRONT_AUDIO_HOOKS.SIGN_SWAP) counters.signSwaps += 1;
    });

    // Sample descriptors from every content module, captured at 1945.
    const sampleIds = {
      building: block.pickables.find((entry) => entry.id.startsWith('building:'))!.id,
      storefront: block.pickables.find(
        (entry) => entry.id.includes('shopfront:bay') && entry.id.includes('@'),
      )!.id,
      vehicle: block.pickables.find((entry) => entry.id.startsWith('vehicle:'))!.id,
      street: block.pickables.find((entry) => entry.id.startsWith('street:'))!.id,
      crowd: 'crowd:pedestrians',
    } satisfies Record<string, string>;

    Object.assign(f, {
      scene,
      eraSystem,
      block,
      pump,
      timeline,
      navigation,
      overlay,
      camera,
      audioBus,
      audio,
      disconnectAudio,
      sampleIds,
      samplesAt1945: Object.fromEntries(
        Object.entries(sampleIds).map(([key, id]) => [key, describeSampleFor(id, block)]),
      ),
      counters,
    });
  });

  afterAll(() => {
    restoreMorphRecorder();
    f.disconnectAudio();
    f.navigation.dispose();
    f.timeline.dispose();
    f.audio.dispose();
    f.block.dispose();
    f.overlay.remove();
    document.querySelectorAll('.timeline-ui').forEach((element) => element.remove());
  });

  it('mounts every declared module into one block corner', () => {
    const { scene, block, eraSystem } = f;
    expect(block.root.name).toBe('city-block');
    expect(scene.cityRoot.getObjectByName('city-block')).toBe(block.root);

    // Buildings: every authored lot mounted.
    expect(block.buildings.buildings.length).toBe(BUILDING_LOTS.length);
    expect(block.buildings.buildings.length).toBeGreaterThanOrEqual(6);
    expect(block.buildings.storefrontBays.length).toBeGreaterThanOrEqual(20);

    // Storefronts: rows cover every authored bay with their own module.
    const covered = block.storefrontRows.flatMap((row) => row.bays.map((bay) => bay.bayId));
    expect(new Set(covered).size).toBe(block.buildings.storefrontBays.length);
    expect(block.storefrontRows.length).toBeGreaterThanOrEqual(3);
    for (const row of block.storefrontRows) {
      expect(row.module.bays.length).toBe(row.slotCount);
      expect(row.slotPositions.length).toBe(row.slotCount);
    }

    // Street, fleet, crowd, atmosphere.
    expect(scene.scene.getObjectByName('street:props')).toBe(block.street.root);
    expect(block.vehicles.states().length).toBeGreaterThan(0);
    expect(block.crowd.getStats().pedestrians).toBeGreaterThanOrEqual(40);
    expect(block.atmosphere.name).toBe('atmosphere');

    // The shared era registry holds members from every registry-driven stage.
    const audit = auditChoreography(eraSystem.registry);
    expect(audit.orderViolations).toEqual([]);
    expect(audit.missingRegistryStages).toEqual([]);
    expect(audit.ok).toBe(true);
    const stages = new Set(eraSystem.registry.members.map((member) => member.stage));
    for (const stage of stagedOrder) expect(stages.has(stage)).toBe(true);
    expect(stages.has('sound')).toBe(false); // sound rides the core (audio director)
    expect(eraSystem.registry.size).toBeGreaterThanOrEqual(40);

    // One coherent per-frame update path across all modules (headless-safe).
    expect(() => block.update(1 / 60, 0, null)).not.toThrow();
  });

  it('aligns streets, sidewalks, bays, lanes, and crowds by the shared slot constants', () => {
    const { scene, block } = f;

    // Cross-module constants agree.
    expect(STREET_WIDTH).toBe(BLOCK_ALIGNMENT.streetWidth);
    expect(FRONTAGE_LINE).toBe(STREET_HALF_WIDTH + BLOCK_ALIGNMENT.sidewalkWidth);
    expect([...LANE_CENTERS]).toEqual([...DRIVE_LANE_CENTERS]);
    expect(CROWD_CURB_Z).toBe(STREET_HALF_WIDTH);

    // Street root translated onto the shared centerline frame.
    expect(block.street.root.position.x).toBe(STREET_ORIGIN_OFFSET.x);
    expect(block.street.root.position.y).toBe(0);
    expect(block.street.root.position.z).toBe(STREET_ORIGIN_OFFSET.z);
    expect(STREET_ORIGIN_OFFSET.x).toBe(BLOCK_ALIGNMENT.streetWidth / 2);

    // Sidewalk outer edges land exactly on the building frontage line.
    const ne = STREET_LAYOUT.sidewalkStrips.find((strip) => strip.name === 'mainNorthEast')!;
    const east = STREET_LAYOUT.sidewalkStrips.find((strip) => strip.name === 'crossEastNorth')!;
    expect(ne.z1 + STREET_ORIGIN_OFFSET.z).toBe(FRONTAGE_LINE);
    expect(east.x1 + STREET_ORIGIN_OFFSET.x).toBe(FRONTAGE_LINE);
    expect(ne.z0 + STREET_ORIGIN_OFFSET.z).toBe(STREET_HALF_WIDTH); // curb side

    // Every building bay sits on its frontage line (facing the sidewalk).
    for (const bay of block.buildings.storefrontBays) {
      if (bay.facing.z < -0.5) expect(bay.position.z).toBe(FRONTAGE_LINE);
      else if (bay.facing.x < -0.5) expect(bay.position.x).toBe(FRONTAGE_LINE);
      else if (bay.facing.x > 0.5) expect(bay.position.x).toBe(-FRONTAGE_LINE);
      else expect(bay.position.z).toBe(-FRONTAGE_LINE);
      expect(bay.baseY).toBe(BLOCK_ALIGNMENT.bayBaseY);
    }

    // Crowd lanes run down the middle of the sidewalk walking band.
    expect(block.crowd.laneConstants.curbZ).toBe(STREET_HALF_WIDTH);
    expect(block.crowd.laneConstants.laneZ).toBeCloseTo(
      STREET_HALF_WIDTH + SIDEWALK_WALK_LANE_CENTER,
      9,
    );
    expect(block.crowd.laneConstants.laneZ).toBeCloseTo((ne.z0 + ne.z1) / 2 + STREET_ORIGIN_OFFSET.z, 9);
    expect(block.crowd.laneConstants.intersectionX).toBe(CROWD_CROSSING_X);

    // Driving lanes sit inside the translated road band; loops fit the road.
    const road = STREET_LAYOUT.mainRoad;
    const bandZ: [number, number] = [road.z0 + STREET_ORIGIN_OFFSET.z, road.z1 + STREET_ORIGIN_OFFSET.z];
    for (const lane of DRIVE_LANE_CENTERS) {
      const worldOffset = lane - STREET_WIDTH / 2;
      expect(worldOffset).toBeGreaterThanOrEqual(bandZ[0]);
      expect(worldOffset).toBeLessThanOrEqual(bandZ[1]);
    }
    const turnRadius = STREET_WIDTH / 6; // vehicle U-turn bulge radius (3)
    expect(TRAFFIC_STREET_HALF_LENGTH + turnRadius).toBeLessThanOrEqual(
      Math.abs(road.x0 + STREET_ORIGIN_OFFSET.x),
    );
    expect(TRAFFIC_STREET_HALF_LENGTH + turnRadius).toBeLessThanOrEqual(
      road.x1 + STREET_ORIGIN_OFFSET.x,
    );

    // Mounted storefront modules land exactly on the building bay slots.
    f.scene.scene.updateMatrixWorld(true);
    for (const row of block.storefrontRows) {
      expect(row.module.group.position.x).toBeCloseTo(row.position.x, 9);
      expect(row.module.group.position.z).toBeCloseTo(row.position.z, 9);
      expect(row.module.group.rotation.y).toBeCloseTo(row.rotationY, 9);
      row.module.bays.forEach((slot, index) => {
        const world = row.module.group.localToWorld(new THREE.Vector3(slot.x, 0, slot.z));
        const expected = row.bays[index].position;
        expect(world.x).toBeCloseTo(expected.x, 6);
        expect(world.z).toBeCloseTo(expected.z, 6);
      });
    }

    // Pavement furniture (kiosk) sits on the sidewalk, never in the road or
    // inside the building: strictly between the curb and the frontage line.
    for (const row of block.storefrontRows) {
      const kiosk = row.module.pickables.find((entry) => entry.id.endsWith('kiosk'));
      if (!kiosk) continue;
      const position = kiosk.object.getWorldPosition(new THREE.Vector3());
      const frontage =
        row.facing === 'south' || row.facing === 'north' ? row.position.z : row.position.x;
      const curb = STREET_HALF_WIDTH * Math.sign(frontage);
      const low = Math.min(curb, frontage) + 0.05;
      const high = Math.max(curb, frontage) - 0.05;
      const along = row.facing === 'south' || row.facing === 'north' ? position.z : position.x;
      expect(along).toBeGreaterThan(low);
      expect(along).toBeLessThan(high);
    }

    // Cross-module depth safety: biased ground can never z-fight the road slab.
    const ground = scene.scene.getObjectByName('ground') as THREE.Mesh;
    expect((ground.material as THREE.Material).polygonOffset).toBe(true);
  });

  it('wires one pickable registry from every content module with era-aware sources', () => {
    const { block, navigation, overlay } = f;
    const ids = block.pickables.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length); // registration-safe unique ids

    expect(ids.some((id) => id.startsWith('building:'))).toBe(true);
    expect(ids.some((id) => id.includes('shopfront:bay') && id.includes('@'))).toBe(true);
    expect(ids.some((id) => id.startsWith('vehicle:'))).toBe(true);
    expect(ids.some((id) => id.startsWith('street:'))).toBe(true);
    expect(ids).toContain('crowd:pedestrians');
    expect(block.pickables.length).toBeGreaterThanOrEqual(40);

    // Focus is the same path a click takes (beginFocus → showCalloutFor →
    // provider → panel); real pointer picking is covered by the browser pass.
    expect(navigation.focus(f.sampleIds.building)).toBe(true);
    expect(navigation.isCalloutOpen).toBe(true);
    const title = overlay.querySelector('[data-testid="callout-title"]');
    expect(title?.textContent).toBe(f.samplesAt1945.building.title);
    const eyebrow = overlay.querySelector('[data-testid="callout-eyebrow"]');
    expect(eyebrow?.textContent).toContain('1945');
    navigation.dismissCallout();
    expect(navigation.isCalloutOpen).toBe(false);

    // Every captured 1945 sample is era-labelled and non-empty.
    for (const [key, content] of Object.entries(f.samplesAt1945)) {
      expect(content.title, key).toBeTruthy();
      expect(content.eyebrow, key).toContain('1945');
      expect(content.facts?.length ?? 0, key).toBeGreaterThan(0);
    }
  });

  it('transforms the entire block in staged order on a single slider move', () => {
    const { eraSystem, pump, timeline, block } = f;

    recorderFrame = 0;
    const framesBefore = totalCalls();

    // One slider interaction: keyboard End on the timeline slider commits via
    // `core.transitionTo` on the SHARED core — no other era input exists.
    f.timeline.slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(eraSystem.core.selectedYear).toBe(2025);
    expect(eraSystem.core.isTransitioning).toBe(true);
    expect(timeline.slider.getAttribute('aria-valuenow')).toBe('2025');

    let steps = 0;
    while (eraSystem.core.isTransitioning && steps < 500) {
      pump.advance(1 / 60);
      block.update(1 / 60, steps / 60, null); // module animations run during the morph
      recorderFrame += 1;
      steps += 1;
    }
    timeline.refresh();

    expect(eraSystem.core.isTransitioning).toBe(false);
    expect(steps).toBeGreaterThan(45); // animated (~90 frames at the 1.5 s default)
    expect(steps).toBeLessThan(500);
    expect(totalCalls()).toBeGreaterThan(framesBefore);

    // Every dispatch reached every registered member — no module left behind.
    const callsPerFrame = new Map<number, number>();
    for (const calls of recorded.values()) {
      for (const call of calls) {
        callsPerFrame.set(call.frame, (callsPerFrame.get(call.frame) ?? 0) + 1);
      }
    }
    expect(callsPerFrame.size).toBeGreaterThan(45);
    for (const [, count] of callsPerFrame) {
      expect(count).toBe(eraSystem.registry.size);
    }

    // Every member started at frame 0 and finished fully morphed.
    for (const [member, calls] of recorded) {
      expect(calls.length, member.stage).toBeGreaterThanOrEqual(2);
      expect(calls[0].frame, member.stage).toBe(0);
      const last = calls[calls.length - 1];
      expect(last.progress).toBeCloseTo(1, 6);
      expect(last.blend.to).toBe(2025);
      expect(last.blend.fraction).toBeCloseTo(1, 6);
    }

    // Staged order: facades first, then signage, then fleet, then crowd,
    // then lights — strictly monotonic first-movement frames.
    const movingFrames = stagedOrder.map((stage) => firstMovingFrame(stage));
    for (const frame of movingFrames) expect(Number.isFinite(frame)).toBe(true);
    expect(movingFrames[0]).toBe(0);
    for (let index = 1; index < movingFrames.length; index += 1) {
      expect(movingFrames[index], `${stagedOrder[index - 1]} → ${stagedOrder[index]}`).toBeGreaterThan(
        movingFrames[index - 1],
      );
    }

    // The configured sound step exists and is core-driven (audio director).
    const sound = CITY_MORPH_CHOREOGRAPHY.find((step) => step.stage === 'sound');
    expect(sound?.driver).toBe('timeline-core');
  });

  it('raises different era-aware callouts in 2025 than it did in 1945', () => {
    const { overlay, navigation } = f;

    const at2025 = Object.fromEntries(
      Object.entries(f.sampleIds).map(([key, id]) => [key, describeSample(id)]),
    );

    // Era label follows the timeline on every content module.
    for (const [key, content] of Object.entries(at2025)) {
      expect(content.title, key).toBeTruthy();
      expect(content.eyebrow, key).toContain('2025');
    }

    // Facts change with the era — real content-module data, not a static card.
    expect(at2025.building.facts).not.toEqual(f.samplesAt1945.building.facts);
    expect(at2025.storefront.facts).not.toEqual(f.samplesAt1945.storefront.facts);
    expect(at2025.vehicle.facts).not.toEqual(f.samplesAt1945.vehicle.facts);
    expect(at2025.crowd.facts).not.toEqual(f.samplesAt1945.crowd.facts);

    // Vehicles distinguish "fleet standard" from "still running" — proven on
    // both a 1945-born and a 2025-born descriptor, in both eras. The shared
    // core is scrubbed directly (the provider reads it; nothing dispatches).
    const era1945Vehicle = f.block.vehicles.pickables.find((entry) => entry.eyebrow === '1945');
    const era2025Vehicle = f.block.vehicles.pickables.find((entry) => entry.eyebrow === '2025');
    expect(era1945Vehicle).toBeDefined();
    expect(era2025Vehicle).toBeDefined();

    // One vehicle pickable framed against both years: the era fact merges the
    // content module's descriptor (the car that occupies the slot now) with
    // the timeline year read at click time.
    const probe = era1945Vehicle!.id;
    const occupant = f.block.vehicles.describePick(pick(probe).object);
    expect(occupant).toBeTruthy();
    const eraFact = (year: number): string =>
      occupant!.eyebrow === String(year)
        ? `${year} fleet standard`
        : `first rolled in ${occupant!.eyebrow}, still running in ${year}`;
    expect(eraFact(1945)).not.toBe(eraFact(2025));
    expect(describeSample(probe).facts?.join(' ')).toContain(eraFact(2025));
    f.eraSystem.core.setPosition(0); // read the 1945 copy without dispatching
    expect(describeSample(probe).facts?.join(' ')).toContain(eraFact(1945));
    f.eraSystem.core.setPosition(1); // restore 2025 for the remaining tests

    // Street props flip presence with the era (charger vs phone booth).
    const charger = f.block.pickables.find(
      (entry) => entry.id.startsWith('street:') && entry.id.includes('ev'),
    )!;
    const booth = f.block.pickables.find(
      (entry) => entry.id.startsWith('street:') && entry.id.includes('phone'),
    )!;
    expect(charger).toBeDefined();
    expect(booth).toBeDefined();
    const chargerKind = f.block.street.pickables.find((entry) => entry.id === charger.id)!.kind;
    const boothKind = f.block.street.pickables.find((entry) => entry.id === booth.id)!.kind;
    expect(isPropPresent(chargerKind, 2025)).toBe(true);
    expect(isPropPresent(chargerKind, 1945)).toBe(false);
    expect(isPropPresent(boothKind, 1945)).toBe(false); // booths have not arrived yet
    expect(isPropPresent(boothKind, 2005)).toBe(true);
    expect(isPropPresent(boothKind, 2025)).toBe(false);
    expect(describeSample(charger.id).facts?.join(' ')).toContain('standing in 2025');
    expect(describeSample(booth.id).facts?.join(' ')).toContain('absent in 2025');
    expect(f.samplesAt1945.street.facts?.join(' ')).toContain('standing in 1945');
    f.eraSystem.core.setPosition(0); // the same props, seen from 1945
    expect(describeSample(booth.id).facts?.join(' ')).toContain('absent in 1945');
    expect(describeSample(charger.id).facts?.join(' ')).toContain('absent in 1945');
    f.eraSystem.core.setPosition(1); // restore 2025 for the focus assertion below

    // The panel itself shows the current era when focused in 2025.
    expect(navigation.focus(f.sampleIds.storefront)).toBe(true);
    const eyebrow = overlay.querySelector('[data-testid="callout-eyebrow"]');
    expect(eyebrow?.textContent).toContain('2025');
    const title = overlay.querySelector('[data-testid="callout-title"]');
    expect(title?.textContent).toBe(at2025.storefront.title);
    navigation.dismissCallout();
  });

  it('bridges module sound hooks to the audio director bus during the morph', () => {
    const { counters, block } = f;
    // The staged 1945 → 2025 morph fired storefront sign swaps and street
    // era hooks; the bridge carried them onto the documented hook bus.
    expect(counters.signSwaps).toBeGreaterThan(0);
    expect(counters.storefrontDoorHooks).toBeGreaterThan(0);
    expect(counters.streetRingtoneHooks).toBeGreaterThan(0);

    // Vehicle horns bridge with world positions.
    expect(block.vehicles.honk()).toBe(true);
    expect(counters.hornHooks).toBeGreaterThanOrEqual(1);
  });

  it('dispatches a full frame when the slider is scrubbed without a transition', () => {
    const { eraSystem, pump, block } = f;

    // Simulate a mid-track drag: position moves, no animation runs.
    eraSystem.core.setPosition(yearToPosition(1985));
    expect(eraSystem.core.isTransitioning).toBe(false);
    expect(eraSystem.core.selectedYear).toBe(1985);

    const before = new Map(
      [...recorded.entries()].map(([member, calls]) => [member, calls.length]),
    );
    pump.advance(1 / 60);
    block.update(1 / 60, 0, null);

    for (const [member, calls] of recorded) {
      expect(calls.length, member.stage).toBeGreaterThan(before.get(member)!);
      const latest = calls[calls.length - 1];
      expect(latest.blend.from, member.stage).toBe(1985);
      expect(latest.progress, member.stage).toBe(1); // idle progress opens every stage window
    }
  });
});

/** Capture a sample before/without touching fixture state. */
function describeSampleFor(id: string, block: CityBlock): CalloutContent {
  const descriptor = block.pickables.find((entry) => entry.id === id);
  if (!descriptor) throw new Error(`pickable ${id} not registered`);
  return block.calloutContentProvider(descriptor, new THREE.Vector3());
}
