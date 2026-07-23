import * as THREE from 'three'
import type { EraConfig } from '../app/types'

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function interpolateEraConfig(from: EraConfig, to: EraConfig, t: number): EraConfig {
  const tc = THREE.MathUtils.clamp(t, 0, 1)

  const fromPalette = from.palette
  const toPalette = to.palette

  const skyTop = `#${new THREE.Color(fromPalette.skyTop).lerp(new THREE.Color(toPalette.skyTop), tc).getHexString()}`
  const skyBottom = `#${new THREE.Color(fromPalette.skyBottom).lerp(new THREE.Color(toPalette.skyBottom), tc).getHexString()}`
  const buildingBase = `#${new THREE.Color(fromPalette.buildingBase).lerp(new THREE.Color(toPalette.buildingBase), tc).getHexString()}`
  const buildingAccent = `#${new THREE.Color(fromPalette.buildingAccent).lerp(new THREE.Color(toPalette.buildingAccent), tc).getHexString()}`
  const road = `#${new THREE.Color(fromPalette.road).lerp(new THREE.Color(toPalette.road), tc).getHexString()}`
  const billboard = `#${new THREE.Color(fromPalette.billboard).lerp(new THREE.Color(toPalette.billboard), tc).getHexString()}`
  const billboardAlt = `#${new THREE.Color(fromPalette.billboardAlt).lerp(new THREE.Color(toPalette.billboardAlt), tc).getHexString()}`
  const neon = `#${new THREE.Color(fromPalette.neon).lerp(new THREE.Color(toPalette.neon), tc).getHexString()}`
  const vehicleBody = `#${new THREE.Color(fromPalette.vehicleBody).lerp(new THREE.Color(toPalette.vehicleBody), tc).getHexString()}`
  const vehicleAccent = `#${new THREE.Color(fromPalette.vehicleAccent).lerp(new THREE.Color(toPalette.vehicleAccent), tc).getHexString()}`
  const pedestrian = `#${new THREE.Color(fromPalette.pedestrian).lerp(new THREE.Color(toPalette.pedestrian), tc).getHexString()}`

  return {
    ...from,
    // id/year/label are purely display; caller can overwrite.
    id: from.id,
    year: lerp(from.year, to.year, tc),
    label: tc < 0.5 ? from.label : to.label,

    buildingScale: lerp(from.buildingScale, to.buildingScale, tc),
    buildingSaturation: lerp(from.buildingSaturation, to.buildingSaturation, tc),
    windowGlow: lerp(from.windowGlow, to.windowGlow, tc),
    roadWetness: lerp(from.roadWetness, to.roadWetness, tc),
    vehicleDensity: lerp(from.vehicleDensity, to.vehicleDensity, tc),
    vehicleSpeed: lerp(from.vehicleSpeed, to.vehicleSpeed, tc),
    vehicleStyle: tc < 0.5 ? from.vehicleStyle : to.vehicleStyle,
    pedestrianDensity: lerp(from.pedestrianDensity, to.pedestrianDensity, tc),
    billboardMotion: lerp(from.billboardMotion, to.billboardMotion, tc),
    ambientIntensity: lerp(from.ambientIntensity, to.ambientIntensity, tc),

    palette: {
      ...from.palette,
      skyTop,
      skyBottom,
      buildingBase,
      buildingAccent,
      road,
      billboard,
      billboardAlt,
      neon,
      vehicleBody,
      vehicleAccent,
      pedestrian,
    },

    sfxProfile: tc < 0.5 ? from.sfxProfile : to.sfxProfile,
  }
}
