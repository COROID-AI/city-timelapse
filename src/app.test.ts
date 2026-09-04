import { describe, expect, it } from 'vitest'

describe('placeholder app', () => {
  it('defines the six era labels for the timeline', () => {
    const eras = ['1945', '1965', '1985', '2005', '2025', '2055']
    expect(eras).toHaveLength(6)
    expect(eras[0]).toBe('1945')
    expect(eras[eras.length - 1]).toBe('2055')
  })
})