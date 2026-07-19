import React, { useMemo } from 'react'
import { Era } from '../../contexts/EraContext'
import { Storefront } from './Storefront'

interface StorefrontManagerProps {
  currentEra: Era
  transitionProgress: number
}

const eraStorefronts: Record<Era, { type: string; count: number }[]> = {
  '1945': [
    { type: 'general-store', count: 3 },
    { type: 'pharmacy', count: 2 },
  ],
  '1965': [
    { type: 'department-store', count: 2 },
    { type: 'diner', count: 2 },
  ],
  '1985': [
    { type: 'electronics-store', count: 2 },
    { type: 'fashion-boutique', count: 2 },
  ],
  '2005': [
    { type: 'tech-store', count: 2 },
    { type: 'coffee-shop', count: 2 },
  ],
  '2025': [
    { type: 'smart-retail', count: 3 },
    { type: 'delivery-hub', count: 1 },
  ],
  '2055': [
    { type: 'holo-store', count: 3 },
    { type: 'nutri-bar', count: 1 },
  ],
}

export function StorefrontManager({ currentEra, transitionProgress }: StorefrontManagerProps) {
  const storefronts = useMemo(() => {
    const types = eraStorefronts[currentEra]
    const result: JSX.Element[] = []
    let id = 0

    types.forEach(({ type, count }) => {
      for (let i = 0; i < count; i++) {
        const side = id % 2 === 0 ? -1 : 1
        const buildingPos = Math.floor(id / 3)
        const zPos = (buildingPos - 4) * 6
        result.push(
          <Storefront
            key={id}
            id={id}
            type={type}
            position={[side * 5, 0, zPos]}
            rotation={[0, side === -1 ? Math.PI : 0, 0]}
            transitionProgress={transitionProgress}
          />
        )
        id++
      }
    })

    return result
  }, [currentEra])

  return <group>{storefronts}</group>
}