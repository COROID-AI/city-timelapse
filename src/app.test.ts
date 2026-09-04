import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { clampPolar, movementFromKeys } from './scene/camera-rig'

describe('placeholder app', () => {
  it('defines the six era labels for the timeline', () => {
    const eras = ['1945', '1965', '1985', '2005', '2025', '2055']
    expect(eras).toHaveLength(6)
    expect(eras[0]).toBe('1945')
    expect(eras[eras.length - 1]).toBe('2055')
  })
})

describe('camera-rig helpers', () => {
  it('clamps polar angles', () => {
    expect(clampPolar(0.5, 0.1, 1.4)).toBe(0.5)
    expect(clampPolar(-1, 0.1, 1.4)).toBe(0.1)
    expect(clampPolar(3, 0.1, 1.4)).toBe(1.4)
  })

  it('builds a forward movement vector at yaw 0', () => {
    const keys = new Set(['KeyW'])
    const out = movementFromKeys(keys, 0, new Vector3())
    expect(out.z).toBeLessThan(0) // forward is -Z
    expect(out.length()).toBeCloseTo(1, 5)
  })

  it('combines forward and strafe into a normalized diagonal', () => {
    const keys = new Set(['KeyW', 'KeyD'])
    const out = movementFromKeys(keys, 0, new Vector3())
    expect(out.length()).toBeCloseTo(1, 5)
  })

  it('produces no movement when no keys are pressed', () => {
    const out = movementFromKeys(new Set(), 0, new Vector3())
    expect(out.length()).toBe(0)
  })
})