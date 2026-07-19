import { useMemo } from 'react'
import { EraTimeline, Era, ERA_CONFIGS } from '../types/era'
import { MathUtils, Color } from 'three'

const ERAS = [1945, 1965, 1985, 2005, 2025, 2055] as const

interface TransitionState {
  architecture: string
  vehicle: string
  pedestrian: string
  advertisement: string
  storefront: string
  weather: string
  colorTemp: number
  bloomStrength: number
  filmGrain: number
  // Interpolated values
  buildingHeight: number
  buildingStyle: number // 0-1 blend between styles
  materialRoughness: number
  materialMetalness: number
}

export function useEraTransition(timeline: EraTimeline): TransitionState {
  return useMemo(() => {
    const { year, progress } = timeline
    const currentEraIndex = ERAS.indexOf(year as Era)
    
    const currentConfig = ERA_CONFIGS[year as Era] || ERA_CONFIGS[1945]
    
    // Interpolate between eras
    let nextConfig: typeof currentConfig | null = null
    let prevConfig: typeof currentConfig | null = null
    let t = 0
    
    if (currentEraIndex > 0 && progress > 0) {
      prevConfig = ERA_CONFIGS[ERAS[currentEraIndex - 1]]
      t = progress
    }
    
    if (currentEraIndex < ERAS.length - 1 && progress > 0) {
      nextConfig = ERA_CONFIGS[ERAS[currentEraIndex + 1]]
    }

    // Interpolate numeric values
    const interpolate = (min: number, max: number, factor: number) => 
      min + (max - min) * factor

    const buildingHeight = nextConfig 
      ? interpolate(
          prevConfig!.bloomStrength,
          nextConfig.bloomStrength,
          progress
        )
      : currentConfig.bloomStrength

    const buildingStyle = progress

    const materialRoughness = MathUtils.lerp(
      year === 1945 ? 0.8 : year === 2055 ? 0.2 : 0.4,
      year === 1945 ? 0.8 : year === 2055 ? 0.1 : 0.6,
      progress
    )

    const materialMetalness = MathUtils.lerp(
      year === 1945 ? 0.2 : year === 2055 ? 0.9 : 0.5,
      year === 1945 ? 0.3 : year === 2055 ? 1.0 : 0.7,
      progress
    )

    return {
      architecture: currentConfig.architecture,
      vehicle: currentConfig.vehicle,
      pedestrian: currentConfig.pedestrian,
      advertisement: currentConfig.advertisement,
      storefront: currentConfig.storefront,
      weather: currentConfig.weather,
      colorTemp: currentConfig.colorTemp,
      bloomStrength: currentConfig.bloomStrength,
      filmGrain: currentConfig.filmGrain,
      buildingHeight: buildingHeight || 1,
      buildingStyle,
      materialRoughness,
      materialMetalness,
    }
  }, [timeline.year, timeline.progress])
}