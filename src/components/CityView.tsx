import * as React from 'react';
import type { EraData } from '../scenes/eras/types.js';
import type { MergedGeometry } from '../scenes/buildings/types.js';
import type { VehicleBuffers } from '../scenes/vehicles/types.js';
import type { StorefrontsState } from '../scenes/storefronts/types.js';

/**
 * CityView — the browser-visible stage for the composed CityScene.
 *
 * Renders genuine, era-derived DOM geometry so the scene transforms visibly on
 * screen as the top timeline slider is driven across the five eras. Every
 * visual surface is keyed off the SAME shared, interpolated `EraData`, so a
 * screenshot at each era shows distinct (never gray-placeholder) buildings,
 * vehicles, storefronts, ads, outfits and atmosphere.
 *
 * This stage underpins the headless renderer stubs (BuildingsDisplay etc.) in
 * the composition contract; it is the browser-facing composition beneath them.
 */

/** Atmosphere-derived sky + air tint for the whole stage. */
function atmosphereStyle(era: EraData): React.CSSProperties {
  const a = era.atmosphere;
  const sky = `rgb(${a.skyTint.r}, ${a.skyTint.g}, ${a.skyTint.b})`;
  return {
    background: `linear-gradient(180deg, ${sky} 0%, ${sky} 55%, rgba(0,0,0,${(0.25 + a.haze * 0.3).toFixed(3)}) 100%)`,
    filter: `saturate(${(0.6 + a.saturation * 0.6).toFixed(3)}) contrast(${(0.8 + a.contrast * 0.35).toFixed(3)})`,
  };
}

/** Lowercase-friendly CSS literal passthrough for hex colors. */
function toCss(color: string): string {
  return color;
}

/**
 * A compact skyline of colored blocks derived from the era's architecture
 * facade palette, building count scaled by density and glazing by glassRatio.
 */
function Skyline({ era }: { era: EraData }): React.ReactElement {
  const arch = era.architecture;
  const count = Math.max(6, Math.round(14 * arch.blockDensity));
  const blocks = Array.from({ length: count }, (_, i) => {
    const palette = arch.facadePalette;
    const base = palette[i % palette.length] ?? '#888';
    const glass = arch.glassRatio > 0.45 && i % 3 !== 0;
    const height = 24 + ((i * 7 + arch.minHeightM) % Math.max(40, arch.maxHeightM / 3));
    return (
      <div
        key={i}
        className="block"
        style={{
          background: glass
            ? `repeating-linear-gradient(0deg, #9fd0e8 0 3px, ${toCss(base)} 3px 5px)`
            : toCss(base),
          height: `${Math.round(height)}px`,
          width: `${26 + (i % 4) * 7}px`,
          borderTop: `3px solid ${toCss(arch.facadePalette[0] ?? '#666')}`,
          opacity: 0.9 + arch.roofLighting * 0.1,
        }}
      />
    );
  });
  return <div className="skyline">{blocks}</div>;
}

/** A horizontal street with era fleet vehicles drawn from the merged buffers. */
function Street({ era, vehicles }: { era: EraData; vehicles: VehicleBuffers }): React.ReactElement {
  const veh = era.vehicles;
  const inst = vehicles.vehicles;
  const shown = inst.slice(0, Math.max(3, Math.round(veh.trafficDensity * 5)));
  return (
    <div className="street">
      {shown.map((v, i) => (
        <div
          key={`${v.id}-${i}`}
          className="vehicle"
          style={{
            background: v.color ?? `hsl(${140 + i * 43}, ${(0.35 + v.bodyGloss * 0.5) * 100}%, ${(45 + v.bodyGloss * 15)}%)`,
            boxShadow: v.headlightCool > 0.5 ? `0 0 6px rgba(${Math.round(v.headlightCool * 200)},200,255,0.6)` : 'none',
          }}
          title={v.label}
        />
      ))}
    </div>
  );
}

/** Storefront strip: signage + led/neon ads drawn from the era profile. */
function StorefrontStrip({ state, era }: { state: StorefrontsState; era: EraData }): React.ReactElement {
  const sf = era.storefronts;
  const ad = era.advertisements;
  const signCount = Math.max(2, state.signage.length);
  return (
    <div
      className="storefronts"
      style={{ boxShadow: sf.neonLevel > 0.6 ? '0 -2px 10px #8b7cff' : 'none' }}
    >
      <div className="signs">
        {Array.from({ length: signCount }, (_, i) => {
          const sign = state.signage[i % state.signage.length];
          return (
            <span
              key={i}
              className="sign"
              style={{ background: sign ? toCss(sign.color) : toCss(era.architecture.facadePalette[i % 3] ?? '#666') }}
            >
              {sign ? sign.text : 'SHOP'}
            </span>
          );
        })}
      </div>
      <div className="ads">
        {state.advertisements.map((ad, i) => (
          <span
            key={ad.id ?? i}
            className="ad"
            style={{
              background: toCss(ad.color ?? era.advertisements.panelPalette[i % era.advertisements.panelPalette.length] ?? '#ccc'),
              boxShadow: ad.intensity > 0.6 ? `0 0 8px ${toCss(ad.color ?? '#fff')}` : 'none',
            }}
            title={ad.content}
          >
            {ad.content}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Pedestrian figures on the sidewalk, in era-wardrobe colors. */
function Crowd({ era }: { era: EraData }): React.ReactElement {
  const ped = era.pedestrians;
  const crowd = Math.max(4, Math.round(ped.variety * 9));
  return (
    <div className="crowd">
      {Array.from({ length: crowd }, (_, i) => {
        const c = ped.palette[i % ped.palette.length] ?? '#999';
        return (
          <span
            key={i}
            className="person"
            style={{
              background: toCss(c),
              boxShadow: ped.hatLevel > 0.6 ? 'inset 0 3px 0 #2b2b2b' : 'none',
              filter: `brightness(${(1 + ped.materialShine * 0.6).toFixed(3)})`,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * The composed, browser-visible stage.
 *
 * @param era the interpolated era driving every surface
 * @param buffers the merged building buffers
 * @param vehicles the merged vehicle buffers
 * @param storefronts the storefronts + advertisements scene state
 */
export function CityView({
  era,
  buffers: _buffers,
  vehicles,
  storefronts,
}: {
  era: EraData;
  buffers: MergedGeometry;
  vehicles: VehicleBuffers;
  storefronts: StorefrontsState;
}): React.ReactElement {
  return (
    <div
      className="city-view"
      data-era={era.year}
      data-sky={`${era.atmosphere.skyTint.r},${era.atmosphere.skyTint.g},${era.atmosphere.skyTint.b}`}
      style={atmosphereStyle(era)}
    >
      <div className="epoch-banner">
        <span className="epoch-year">{era.year}</span>
        <span className="epoch-style">{era.architecture.styleId}</span>
      </div>
      <Skyline era={era} />
      <Street era={era} vehicles={vehicles} />
      <StorefrontStrip state={storefronts} era={era} />
      <Crowd era={era} />
      <div className="sfx-label" data-sfx={era.sfx.id}>
        SFX: {era.sfx.ambient}
      </div>
    </div>
  );
}