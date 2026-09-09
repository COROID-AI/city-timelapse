/**
 * Vehicles and Traffic EraSystem for City Time Period Timelapse.
 *
 * Implements the EraSystem lifecycle contract (attach, update, dispose):
 * - Procedural era car families cruising the road lanes and parked in BlockLayout parking slots.
 * - 1945: Rounded prewar sedans with bulbous fenders and running boards.
 * - 1965: Tailfin chrome cruisers with wrap-around bumpers and bullet taillights.
 * - 1985: Boxy wedge sedans, wagons, and delivery vans with black urethane bumpers.
 * - 2005: Aerodynamic curved sedans and SUVs with clear polycarbonate headlights.
 * - 2025: Autonomous EV crossovers, micro-pods, and delivery vans with continuous LED light bars.
 * - Instanced mesh geometry per body type with bloom-friendly emissive lighting.
 * - Continuous traffic flow through era swaps via smooth dissolve scaling.
 */

import {
  Group,
  Matrix4,
  Quaternion,
  Vector3,
  type Object3D,
} from 'three';
import { easeInOut } from '../../../era/transition';
import type { EraSystem, TimelineChannel } from '../../../era/types';
import { ERAS, type EraId } from '../../../era/years';
import type { BlockLayout } from '../../layout/types';
import { TrafficSimulation } from './trafficLoop';
import { vehicleEraData } from './vehicleEraData';
import {
  createVehicleInstanceFamily,
  type VehicleInstanceFamily,
} from './vehicleFactory';

const MAX_DRIVING_CAPACITY = 16;
const MAX_PARKED_CAPACITY = 8;
const TOTAL_INSTANCE_CAPACITY = MAX_DRIVING_CAPACITY + MAX_PARKED_CAPACITY; // 24 <= 32

/**
 * Extended interface for VehiclesSystem providing testing/inspection methods.
 */
export interface VehiclesSystem extends EraSystem<unknown> {
  /** Root THREE.Group containing all instanced vehicle families. */
  readonly rootGroup: Group;
  /** Layout instance the traffic system routes over. */
  readonly layout: BlockLayout;
  /** Underlying deterministic traffic simulation. */
  readonly simulation: TrafficSimulation;
  /** Whether the system is currently attached to a 3D scene/group. */
  isAttached(): boolean;
  /** Returns the total active driving vehicles for a specific era. */
  getEraVehicleCount(era: EraId): number;
  /** Returns the number of parked vehicles in the layout. */
  getParkedCount(): number;
}

/**
 * Creates and initializes the VehiclesSystem for a given city BlockLayout.
 */
export function createVehiclesSystem(layout: BlockLayout): VehiclesSystem {
  const rootGroup = new Group();
  rootGroup.name = 'system-vehicles';

  const simulation = new TrafficSimulation(layout, MAX_DRIVING_CAPACITY);
  const families: Map<EraId, VehicleInstanceFamily> = new Map();

  // Instantiate one instanced family per era
  for (const era of ERAS) {
    const spec = vehicleEraData[era];
    const primaryModelType = spec.models[0].type;
    const family = createVehicleInstanceFamily(
      era,
      primaryModelType,
      spec,
      TOTAL_INSTANCE_CAPACITY,
    );
    families.set(era, family);
    rootGroup.add(family.group);
  }

  let parentObject: Object3D | null = null;
  let attached = false;
  let disposed = false;

  // Reusable math objects for matrix composition
  const tempPos = new Vector3();
  const tempQuat = new Quaternion();
  const tempScale = new Vector3();
  const tempMatrix = new Matrix4();
  const UP_AXIS = new Vector3(0, 1, 0);

  /**
   * Updates transforms for a single vehicle family given active count and dissolve weight.
   */
  function applyFamilyTransforms(
    era: EraId,
    weight: number,
  ): void {
    const family = families.get(era);
    if (!family) return;

    if (weight <= 0.001) {
      // Hide all instances of this family
      for (let i = 0; i < TOTAL_INSTANCE_CAPACITY; i += 1) {
        family.hideInstance(i);
      }
      family.commit();
      return;
    }

    const spec = vehicleEraData[era];
    const drivingCount = Math.min(spec.vehicleCount, simulation.drivingAgents.length);

    // 1. Driving Vehicles (indices 0 .. MAX_DRIVING_CAPACITY - 1)
    for (let i = 0; i < MAX_DRIVING_CAPACITY; i += 1) {
      if (i < drivingCount) {
        const agent = simulation.drivingAgents[i];
        const pos = simulation.getAgentPosition(agent);

        tempPos.set(pos.x, 0, pos.z);
        tempQuat.setFromAxisAngle(UP_AXIS, agent.laneInfo.yaw);
        tempScale.set(weight, weight, weight);
        tempMatrix.compose(tempPos, tempQuat, tempScale);

        const color = agent.eraColors[era] ?? spec.bodyColors[0];
        family.setInstance(i, tempMatrix, color);
      } else {
        family.hideInstance(i);
      }
    }

    // 2. Parked Vehicles (indices MAX_DRIVING_CAPACITY .. MAX_DRIVING_CAPACITY + parked - 1)
    for (let p = 0; p < MAX_PARKED_CAPACITY; p += 1) {
      const slotIndex = MAX_DRIVING_CAPACITY + p;
      if (p < simulation.parkedAgents.length) {
        const parked = simulation.parkedAgents[p];

        tempPos.set(parked.position.x, 0, parked.position.z);
        tempQuat.setFromAxisAngle(UP_AXIS, parked.yaw);
        tempScale.set(weight, weight, weight);
        tempMatrix.compose(tempPos, tempQuat, tempScale);

        const color = parked.eraColors[era] ?? spec.bodyColors[0];
        family.setInstance(slotIndex, tempMatrix, color);
      } else {
        family.hideInstance(slotIndex);
      }
    }

    family.commit();
  }

  // Initial positioning in 1945 default state
  applyFamilyTransforms('1945', 1.0);
  for (const era of ERAS) {
    if (era !== '1945') {
      applyFamilyTransforms(era, 0.0);
    }
  }

  return {
    rootGroup,
    layout,
    simulation,

    isAttached(): boolean {
      return attached;
    },

    getEraVehicleCount(era: EraId): number {
      return vehicleEraData[era]?.vehicleCount ?? 0;
    },

    getParkedCount(): number {
      return simulation.parkedAgents.length;
    },

    attach(context: unknown): void {
      if (disposed) return;

      let target: Object3D | null = null;

      if (context && typeof context === 'object') {
        if ('add' in context && typeof (context as Object3D).add === 'function') {
          target = context as Object3D;
        } else if ('scene' in context && context.scene && typeof (context.scene as Object3D).add === 'function') {
          target = context.scene as Object3D;
        } else if ('rootGroup' in context && context.rootGroup && typeof (context.rootGroup as Object3D).add === 'function') {
          target = context.rootGroup as Object3D;
        }
      }

      if (target) {
        target.add(rootGroup);
        parentObject = target;
        attached = true;
      }
    },

    update(channel: TimelineChannel, deltaSeconds: number): void {
      if (disposed) return;

      // 1. Advance traffic simulation
      simulation.step(channel, deltaSeconds);

      // 2. Dissolve / blend across eras
      const fromEra = channel.fromEra;
      const toEra = channel.toEra;
      const rawT = Number.isFinite(channel.t) ? channel.t : 0;
      const clampedT = Math.max(0, Math.min(1, rawT));
      const easedT = easeInOut(clampedT);

      if (fromEra === toEra || clampedT <= 0) {
        // Static Era
        applyFamilyTransforms(fromEra, 1.0);
        for (const era of ERAS) {
          if (era !== fromEra) {
            applyFamilyTransforms(era, 0.0);
          }
        }
      } else if (clampedT >= 1) {
        // Arrived at destination Era
        applyFamilyTransforms(toEra, 1.0);
        for (const era of ERAS) {
          if (era !== toEra) {
            applyFamilyTransforms(era, 0.0);
          }
        }
      } else {
        // Active Transition
        const fromWeight = 1.0 - easedT;
        const toWeight = easedT;

        applyFamilyTransforms(fromEra, fromWeight);
        applyFamilyTransforms(toEra, toWeight);

        for (const era of ERAS) {
          if (era !== fromEra && era !== toEra) {
            applyFamilyTransforms(era, 0.0);
          }
        }
      }
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;

      // Dispose each instanced family
      for (const family of families.values()) {
        family.dispose();
      }
      families.clear();

      // Remove rootGroup from scene
      if (parentObject) {
        parentObject.remove(rootGroup);
        parentObject = null;
      } else if (rootGroup.parent) {
        rootGroup.parent.remove(rootGroup);
      }

      attached = false;
    },
  };
}
