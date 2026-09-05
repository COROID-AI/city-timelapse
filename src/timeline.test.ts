import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ERA_IDS } from './eras'
import { EraStateStore, type EraChangeDetail } from './state'
import { TimelineSlider } from './timeline'

function createHarness() {
  const target = new EventTarget()
  const store = new EraStateStore(target, document)
  const slider = new TimelineSlider({ target })
  document.body.appendChild(slider.root)
  return { target, store, slider }
}

function pointerEvent(
  type: string,
  init: { clientX?: number; pointerId?: number; button?: number; isPrimary?: boolean } = {},
): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    pointerId: init.pointerId ?? 1,
    button: init.button ?? 0,
    isPrimary: init.isPrimary ?? true,
  })
}

const trackRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 400,
  bottom: 20,
  width: 400,
  height: 20,
  toJSON: () => ({}),
} as unknown as DOMRect

describe('TimelineSlider', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders exactly six ticks with the period labels', () => {
    const { slider } = createHarness()
    const labels = Array.from(
      slider.root.querySelectorAll<HTMLElement>('.timeline-era-label'),
    ).map((el) => el.textContent)
    expect(labels).toEqual(['1945', '1965', '1985', '2005', '2025', '2055'])
    expect(labels).toContain('2055')
  })

  it('starts at 1945 with the first tick active', () => {
    const { slider } = createHarness()
    expect(slider.value).toBe('1945')
    const ticks = slider.root.querySelectorAll<HTMLElement>('.timeline-tick')
    expect(ticks[0].classList.contains('is-active')).toBe(true)
    expect(ticks[1].classList.contains('is-active')).toBe(false)
    expect(slider.root.querySelector('.timeline-thumb')?.getAttribute('aria-valuenow')).toBe('0')
  })

  it('is keyboard focusable and screen-reader labelled', () => {
    const { slider } = createHarness()
    const thumb = slider.root.querySelector<HTMLElement>('.timeline-thumb')
    expect(thumb?.getAttribute('role')).toBe('slider')
    expect(thumb?.getAttribute('tabindex')).toBe('0')
    expect(thumb?.getAttribute('aria-label')).toBe('Select time period')
    expect(thumb?.getAttribute('aria-valuemin')).toBe('0')
    expect(thumb?.getAttribute('aria-valuemax')).toBe('5')
    expect(thumb?.getAttribute('aria-valuetext')).toBe('Era 1945')
  })

  it('arrow keys move between eras and dispatch era-change', () => {
    const { target, slider } = createHarness()
    const changes: EraChangeDetail[] = []
    target.addEventListener('era-change', (event) => {
      changes.push((event as CustomEvent<EraChangeDetail>).detail)
    })
    const thumb = slider.root.querySelector<HTMLElement>('.timeline-thumb')!
    const press = (key: string) =>
      thumb.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      )

    press('ArrowRight')
    expect(slider.value).toBe('1965')
    press('ArrowRight')
    expect(slider.value).toBe('1985')
    press('ArrowRight')
    expect(slider.value).toBe('2005')
    press('ArrowRight')
    expect(slider.value).toBe('2025')
    press('ArrowRight')
    expect(slider.value).toBe('2055')
    press('ArrowLeft')
    expect(slider.value).toBe('2025')
    press('ArrowLeft')
    expect(slider.value).toBe('2005')
    press('ArrowUp')
    expect(slider.value).toBe('2025')
    press('ArrowDown')
    expect(slider.value).toBe('2005')

    expect(changes.map((c) => c.era)).toEqual([
      '1965',
      '1985',
      '2005',
      '2025',
      '2055',
      '2025',
      '2005',
      '2025',
      '2005',
    ])
  })

  it('clamps at the first and last eras', () => {
    const { slider } = createHarness()
    const thumb = slider.root.querySelector<HTMLElement>('.timeline-thumb')!
    const press = (key: string) =>
      thumb.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      )
    press('ArrowLeft')
    expect(slider.value).toBe('1945')
    press('Home')
    expect(slider.value).toBe('1945')
    press('End')
    expect(slider.value).toBe('2055')
    press('ArrowRight')
    expect(slider.value).toBe('2055')
  })

  it('clicking a tick selects that era and dispatches era-change', () => {
    const { target, slider } = createHarness()
    const changes: EraChangeDetail[] = []
    target.addEventListener('era-change', (event) => {
      changes.push((event as CustomEvent<EraChangeDetail>).detail)
    })
    const tick = slider.root.querySelector<HTMLElement>(
      '.timeline-tick[data-era="2005"]',
    )!
    tick.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(slider.value).toBe('2005')
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ era: '2005', prev: '1945' })
  })

  it('clicking the current tick does not dispatch', () => {
    const { target, slider } = createHarness()
    let count = 0
    target.addEventListener('era-change', () => {
      count += 1
    })
    const tick = slider.root.querySelector<HTMLElement>(
      '.timeline-tick[data-era="1945"]',
    )!
    tick.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(count).toBe(0)
    expect(slider.value).toBe('1945')
  })

  it('dragging the thumb selects eras from pointer position', () => {
    const { target, slider } = createHarness()
    const changes: EraChangeDetail[] = []
    target.addEventListener('era-change', (event) => {
      changes.push((event as CustomEvent<EraChangeDetail>).detail)
    })
    const track = slider.root.querySelector<HTMLElement>('.timeline-track')!
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(trackRect)

    track.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 10, pointerId: 7 }),
    )
    track.dispatchEvent(
      pointerEvent('pointermove', { clientX: 200, pointerId: 7 }),
    )
    track.dispatchEvent(
      pointerEvent('pointerup', { clientX: 200, pointerId: 7 }),
    )
    // 10/400 ≈ 0.025 → 1945 (no change); 200/400 = 0.5 → index 3 → 2005.
    expect(slider.value).toBe('2005')
    expect(changes.map((c) => c.era)).toEqual(['2005'])

    // A second drag to the far right lands on 2055.
    track.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 200, pointerId: 8 }),
    )
    track.dispatchEvent(
      pointerEvent('pointermove', { clientX: 400, pointerId: 8 }),
    )
    track.dispatchEvent(
      pointerEvent('pointerup', { clientX: 400, pointerId: 8 }),
    )
    expect(slider.value).toBe('2055')
  })

  it('mirrors store state and shows the transitioning indicator', () => {
    const { slider, store } = createHarness()
    const badge = slider.root.querySelector<HTMLElement>(
      '[data-testid="timeline-transitioning"]',
    )!
    expect(badge.hidden).toBe(true)

    store.setEra('2005')
    expect(slider.value).toBe('2005')
    const active = slider.root.querySelector<HTMLElement>(
      '.timeline-tick.is-active',
    )
    expect(active?.dataset.era).toBe('2005')
    expect(badge.hidden).toBe(false)

    store.endTransition()
    expect(badge.hidden).toBe(true)
  })

  it('selected year label is highlighted', () => {
    const { slider } = createHarness()
    const labels = slider.root.querySelectorAll<HTMLElement>('.timeline-era-label')
    expect(labels[0].classList.contains('is-active')).toBe(true)
    expect(labels[3].classList.contains('is-active')).toBe(false)

    const tick = slider.root.querySelector<HTMLElement>(
      '.timeline-tick[data-era="2025"]',
    )!
    tick.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(labels[4].classList.contains('is-active')).toBe(true)
    expect(labels[0].classList.contains('is-active')).toBe(false)
  })

  it('disposes cleanly', () => {
    const { slider } = createHarness()
    slider.dispose()
    expect(slider.root.isConnected).toBe(false)
  })

  it('supports all six eras via keyboard', () => {
    const { slider } = createHarness()
    const thumb = slider.root.querySelector<HTMLElement>('.timeline-thumb')!
    const press = (key: string) =>
      thumb.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      )
    for (let i = 0; i < ERA_IDS.length - 1; i += 1) {
      press('ArrowRight')
    }
    expect(slider.value).toBe('2055')
    for (let i = 0; i < ERA_IDS.length - 1; i += 1) {
      press('ArrowLeft')
    }
    expect(slider.value).toBe('1945')
  })
})