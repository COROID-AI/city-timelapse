import { Color } from 'three'

export function hexToColor(hex: string) {
  const c = new Color()
  c.setStyle(hex)
  return c
}

export function lerpHex(a: string, b: string, t: number) {
  const ca = hexToColor(a)
  const cb = hexToColor(b)
  ca.lerp(cb, t)
  return ca.getStyle() // css color string
}
