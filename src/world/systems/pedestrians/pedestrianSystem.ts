/**
 * Pedestrian System: Era-Dressed Walking Crowds for City Block Layout.
 *
 * Implements the EraSystem contract (`attach`, `update(channel, deltaSeconds)`, `dispose`).
 * Manages low-poly 3D rigs, synchronizes crowd simulation with timeline transitions,
 * and maintains continuous walking, hierarchical walk animations, and storefront shopping.
 */

import { Group, Scene } from 'three';
import type { EraSystem, TimelineChannel } from '../../../era/types';
import type { BlockLayout } from '../../layout/types';
import { CrowdSim, type PedestrianAgent } from './crowdSim';
import { createPedestrianRig, type PedestrianRig } from './pedestrianFactory';

export interface PedestriansSystemInstance extends EraSystem<Scene | Group> {
  readonly group: Group;
  readonly sim: CrowdSim;
  readonly rigs: Map<number, PedestrianRig>;
  getActiveRigCount(): number;
}

/**
 * Factory creating the pedestrians system attached to a given BlockLayout.
 */
export function createPedestriansSystem(layout: BlockLayout): PedestriansSystemInstance {
  const group = new Group();
  group.name = 'pedestrians-system';

  const sim = new CrowdSim(layout);
  const rigs = new Map<number, PedestrianRig>();

  let parentContainer: Scene | Group | null = null;
  let attached = false;
  let disposed = false;

  /**
   * Synchronizes visual 3D rigs with simulated pedestrian agents.
   */
  function syncRigsToAgents(): void {
    const agents = sim.getAgents();

    // 1. Create or update rigs for active agents
    for (const agent of agents) {
      let rig = rigs.get(agent.id);

      if (agent.active) {
        if (!rig) {
          rig = createPedestrianRig(agent.era, agent.seed);
          rigs.set(agent.id, rig);
          group.add(rig.root);
        }

        rig.root.visible = true;

        // Check if reclothing is needed
        if (rig.currentEra !== agent.era || rig.outfitIndex !== agent.outfitIndex) {
          rig.setOutfit(agent.era, agent.outfitIndex, agent.seed);
        }

        // Update position and heading
        rig.root.position.set(agent.position.x, 0, agent.position.z);
        rig.root.rotation.y = agent.heading;

        // Drive procedural walk & idle animation
        const isWalking = agent.state === 'walking';
        const isWindowShopping = agent.state === 'window_shopping';
        rig.updateAnimation(agent.totalDistanceWalked, isWalking, isWindowShopping);
      } else if (rig) {
        // Inactive / pooled agent rig
        rig.root.visible = false;
      }
    }
  }

  return {
    group,
    sim,
    rigs,

    getActiveRigCount(): number {
      let count = 0;
      for (const rig of rigs.values()) {
        if (rig.root.visible) {
          count += 1;
        }
      }
      return count;
    },

    attach(context: Scene | Group): void {
      if (disposed) return;
      if (context && typeof (context as Group).add === 'function') {
        parentContainer = context;
        parentContainer.add(group);
      }
      attached = true;
    },

    update(channel: TimelineChannel, deltaSeconds: number): void {
      if (disposed || !attached) return;

      // Advance crowd simulation with the channel
      sim.update(deltaSeconds, channel);

      // Synchronize 3D representations
      syncRigsToAgents();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      attached = false;

      // Dispose simulation
      sim.dispose();

      // Dispose all rigs and their materials
      for (const rig of rigs.values()) {
        rig.dispose();
      }
      rigs.clear();

      // Remove group from parent
      if (group.parent) {
        group.parent.remove(group);
      }
      parentContainer = null;
    },
  };
}
