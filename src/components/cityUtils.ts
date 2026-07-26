import * as THREE from 'three'

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}

export function makeCanvasSign(textTop: string, textBottom: string, accent: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const ctx = c.getContext('2d')!

  const g = ctx.createLinearGradient(0, 0, 0, c.height)
  g.addColorStop(0, 'rgba(10,10,16,0.92)')
  g.addColorStop(1, 'rgba(0,0,0,0.88)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)

  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 6
  ctx.strokeRect(18, 18, c.width - 36, c.height - 36)

  ctx.shadowColor = accent
  ctx.shadowBlur = 18

  ctx.fillStyle = accent
  ctx.font = '800 54px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(textTop, c.width / 2, 92)

  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = '700 34px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto'
  ctx.fillText(textBottom, c.width / 2, 166)

  // scanline effect
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#000'
  for (let y = 0; y < c.height; y += 4) {
    ctx.fillRect(0, y, c.width, 1)
  }
  ctx.globalAlpha = 1

  return new THREE.CanvasTexture(c)
}
