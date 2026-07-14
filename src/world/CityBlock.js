import * as THREE from 'three';
import { WORLD, ROAD_HALF, BLOCK_INNER, COLORS } from '../core/constants.js';
import { SeededRandom } from '../utils/random.js';
import { BuildingFactory } from '../factories/BuildingFactory.js';
import { VehicleFactory } from '../factories/VehicleFactory.js';
import { PedestrianFactory } from '../factories/PedestrianFactory.js';
import { StreetFurnitureFactory } from '../factories/StreetFurnitureFactory.js';
import { StorefrontFactory } from '../factories/StorefrontFactory.js';
import { AdvertisementFactory } from '../factories/AdvertisementFactory.js';
import { AtmosphereFactory } from '../factories/AtmosphereFactory.js';

// Assembles a complete era scene (buildings, vehicles, peds, furniture, ads)
// into a single Group whose top-level children carry `userData.fadeAnchor`.
export class CityBlock {
  constructor(era, eraKey) {
    this.era = era;
    this.eraKey = eraKey;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.renderOrder = 0;
    this.fadeNodes = []; // flat list of { obj, anchor } for the transition wave
    this.updaters = []; // moving things (vehicles, peds)
    this.rng = new SeededRandom(parseInt(eraKey, 10) * 7919 + 13);

    this._build();
  }

  _addFadeNode(obj, anchor) {
    obj.userData.fadeAnchor = anchor.clone();
    this.group.add(obj);
    this.fadeNodes.push({ obj, anchor });
  }

  _registerUpdater(fn) {
    this.updaters.push(fn);
  }

  _build() {
    const buildingF = new BuildingFactory(this.era);
    const vehicleF = new VehicleFactory(this.era);
    const pedF = new PedestrianFactory(this.era);
    const furnF = new StreetFurnitureFactory(this.era);
    const storeF = new StorefrontFactory(this.era);
    const adF = new AdvertisementFactory(this.era);

    // Building plots in 4 quadrants. Each quadrant is a grid.
    const plots = this._generatePlots();
    const buildings = [];
    for (const plot of plots) {
      const b = buildingF.create(plot, this.rng);
      this._addFadeNode(b, new THREE.Vector3(plot.x, 0, plot.z));
      buildings.push({ group: b, plot });
    }

    // Storefronts on ground floor of some street-facing buildings
    const streetFacing = buildings.filter((b) => this._isStreetFacing(b.plot));
    for (let i = 0; i < streetFacing.length; i++) {
      if (this.rng.chance(0.7)) {
        const s = storeF.create(streetFacing[i], this.rng);
        this._addFadeNode(s.group, s.anchor);
      }
    }

    // Ads on some buildings
    for (const b of buildings) {
      if (this.rng.chance(0.4)) {
        const a = adF.create(b, this.rng);
        if (a) {
          this._addFadeNode(a.group, a.anchor);
          if (a.group.userData.holoUpdate) this._registerUpdater(a.group.userData.holoUpdate);
        }
      }
    }

    // Vehicles on both roads
    const vCount = this.era.vehicle.count;
    for (let i = 0; i < vCount; i++) {
      const axisNS = this.rng.chance(0.5);
      const v = vehicleF.create({ axisNS, rng: this.rng });
      this._addFadeNode(v.group, v.anchor);
      this._registerUpdater(v.update);
    }

    // Pedestrians on sidewalks
    const pCount = this.era.pedestrian.count;
    for (let i = 0; i < pCount; i++) {
      const p = pedF.create(this.rng);
      this._addFadeNode(p.group, p.anchor);
      this._registerUpdater(p.update);
    }

    // Street furniture: lamp posts at intervals along roads
    const lamps = furnF.createLamps(this.rng);
    for (const l of lamps) {
      this._addFadeNode(l.group, l.anchor);
    }
    const lights = furnF.createTrafficLights(this.rng);
    for (const t of lights) {
      this._addFadeNode(t.group, t.anchor);
    }

    // Atmospheric particles — rendered via THREE.Points (single GPU-instanced
    // draw call per era). Adds era-specific visual character: dust, neon haze,
    // digital debris, etc.
    const atm = new AtmosphereFactory(this.era, this.eraKey).create();
    atm.obj.renderOrder = 40;
    this.group.add(atm.obj);
    this._registerUpdater(atm.update);
    this._atmosphere = atm.obj;
  }

  _generatePlots() {
    const plots = [];
    const minF = this.era.building.minFoot;
    const maxF = this.era.building.maxFoot;
    const H = WORLD.half;
    // Four quadrants. For each, walk a grid from BLOCK_INNER to H - margin.
    const quads = [
      { sx: 1, sz: 1 }, { sx: -1, sz: 1 },
      { sx: 1, sz: -1 }, { sx: -1, sz: -1 },
    ];
    for (const q of quads) {
      let cx = BLOCK_INNER + 2;
      while (cx < H - WORLD.edgeMargin) {
        let cz = BLOCK_INNER + 2;
        const pw = this.rng.range(minF, maxF);
        const stepX = pw + this.rng.range(2, 5);
        while (cz < H - WORLD.edgeMargin) {
          const pd = this.rng.range(minF, maxF);
          const stepZ = pd + this.rng.range(2, 5);
          plots.push({
            x: q.sx * (cx + pw / 2),
            z: q.sz * (cz + pd / 2),
            w: pw, d: pd,
          });
          cz += stepZ;
        }
        cx += stepX;
      }
    }
    return plots;
  }

  _isStreetFacing(plot) {
    // Close to a road centerline (x near 0 or z near 0)
    return Math.abs(plot.x) - plot.w / 2 < ROAD_HALF + WORLD.sidewalkWidth + 3 ||
           Math.abs(plot.z) - plot.d / 2 < ROAD_HALF + WORLD.sidewalkWidth + 3;
  }

  update(dt, elapsed) {
    for (let i = 0; i < this.updaters.length; i++) this.updaters[i](dt, elapsed);
  }
}
