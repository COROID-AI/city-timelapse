/**
 * Buildings for the 2025 smart-city EV era.
 *
 * A sleek glass condo/office tower (new since 2005) with a green-roof
 * terrace, LED facade accent lighting, solar panels, and an EV charging
 * canopy on one lot, plus surviving brick walk-ups restored with modern
 * shopfront glazing and rooftop antennas replaced by 5G small cells.
 */

import { BuildingShell } from '../../types/buildingShell';

/** Kind of a 2025 building. */
export type BuildingKind = 'glass-tower' | 'brick-walkup' | 'glass-office';

/** A 2025-era building placed on a lot shell. */
export interface Building {
  /** Matches the lot shell id it occupies. */
  shellId: string;
  /** Building archetype. */
  kind: BuildingKind;
  /** Display name. */
  name: string;
  /** Height in world units (meters). */
  height: number;
  /** Facade glass colour. */
  glassColor: string;
  /** Whether the building carries LED facade accent lighting. */
  ledAccent: boolean;
  /** Whether the roof hosts a green-roof terrace. */
  greenRoof: boolean;
  /** Whether solar panels are mounted on the roof. */
  solarPanels: boolean;
  /** Whether an EV charging canopy sits on the lot. */
  evCanopy: boolean;
  /** Whether rooftop antennas were replaced by 5G small cells. */
  smallCells5g: boolean;
}

/**
 * Build the 2025 building set across the ten lot shells.
 * Lot 0 hosts the signature glass tower with the EV charging canopy;
 * the remaining lots are restored brick walk-ups and glass offices.
 */
export function buildBuildings(shells: BuildingShell[]): Building[] {
  return shells.map((shell, i) => {
    if (i === 0) {
      return {
        shellId: shell.id,
        kind: 'glass-tower',
        name: 'Vantage Tower',
        height: 52,
        glassColor: '#7fd4f2',
        ledAccent: true,
        greenRoof: true,
        solarPanels: true,
        evCanopy: true,
        smallCells5g: true,
      };
    }
    if (i % 3 === 0) {
      return {
        shellId: shell.id,
        kind: 'glass-office',
        name: 'Nexus Office',
        height: 30,
        glassColor: '#8fd8f5',
        ledAccent: true,
        greenRoof: false,
        solarPanels: true,
        evCanopy: false,
        smallCells5g: true,
      };
    }
    return {
      shellId: shell.id,
      kind: 'brick-walkup',
      name: 'Restored Walk-Up',
      height: 14,
      glassColor: '#a9c4d8',
      ledAccent: false,
      greenRoof: false,
      solarPanels: false,
      evCanopy: false,
      smallCells5g: true,
    };
  });
}