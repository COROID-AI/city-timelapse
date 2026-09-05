/**
 * Top-center timeline slider for era selection.
 *
 * A custom, keyboard-accessible slider (role="slider") with exactly five tick
 * stops (1945, 1965, 1985, 2005, 2025). Clicking a tick, dragging the thumb,
 * or pressing the arrow keys selects an era and dispatches an `era-change`
 * CustomEvent that the era state store consumes.
 *
 * The component is intentionally view-only: it never mutates the store
 * directly. The store's `era-state-change` event is mirrored back so the
 * slider reflects authoritative state (including changes from other sources).
 */

import {
  ERA_IDS,
  getEraSpec,
  type EraId,
} from './eras'
import {
  ERA_CHANGE_EVENT,
  ERA_STATE_CHANGE_EVENT,
  type EraChangeDetail,
  type EraStateChangeDetail,
} from './state'

export interface TimelineSliderOptions {
  /** Event target the slider listens on for era-state-change; defaults to window. */
  target?: EventTarget
  /** Document to create elements in; defaults to the global document. */
  doc?: Document
  /** Initial selected era; defaults to the first registry era (1945). */
  initialEra?: EraId
  /** Called when the slider selects an era (after dispatching era-change). */
  onSelect?: (era: EraId) => void
}

const TICK_COUNT = ERA_IDS.length

export class TimelineSlider {
  readonly root: HTMLElement
  private readonly target: EventTarget
  private readonly doc: Document
  private readonly onSelect?: (era: EraId) => void
  private readonly track: HTMLDivElement
  private readonly fill: HTMLDivElement
  private readonly ticks: HTMLElement[]
  private readonly eraLabels: HTMLElement[]
  private readonly transitioningBadge: HTMLDivElement
  private readonly ariaValue: HTMLSpanElement
  private readonly slider: HTMLDivElement
  private era: EraId
  private readonly onStateChange: (event: Event) => void
  private readonly onKeyDown: (event: KeyboardEvent) => void
  private readonly onPointerDown: (event: PointerEvent) => void
  private readonly onPointerMove: (event: PointerEvent) => void
  private readonly onPointerUp: (event: PointerEvent) => void
  private readonly onPointerCancel: (event: PointerEvent) => void
  private readonly onClick: (event: MouseEvent) => void
  private readonly onBlur: () => void
  private dragging = false
  private disposed = false

  constructor(options: TimelineSliderOptions = {}) {
    this.target = options.target ?? window
    this.doc = options.doc ?? document
    this.onSelect = options.onSelect
    this.era = options.initialEra ?? ERA_IDS[0]

    this.root = this.doc.createElement('div')
    this.root.className = 'timeline-slider'
    this.root.setAttribute('role', 'group')
    this.root.setAttribute('aria-label', 'Time period timeline')
    this.root.setAttribute('data-testid', 'timeline-slider')

    const heading = this.doc.createElement('div')
    heading.className = 'timeline-heading'
    heading.textContent = 'Era'
    this.root.appendChild(heading)

    const widget = this.doc.createElement('div')
    widget.className = 'timeline-widget'

    this.track = this.doc.createElement('div')
    this.track.className = 'timeline-track'
    this.track.setAttribute('data-testid', 'timeline-track')

    this.fill = this.doc.createElement('div')
    this.fill.className = 'timeline-fill'
    this.fill.setAttribute('aria-hidden', 'true')
    this.track.appendChild(this.fill)

    this.slider = this.doc.createElement('div')
    this.slider.className = 'timeline-thumb'
    this.slider.setAttribute('role', 'slider')
    this.slider.setAttribute('tabindex', '0')
    this.slider.setAttribute('aria-label', 'Select time period')
    this.slider.setAttribute('aria-valuemin', '0')
    this.slider.setAttribute('aria-valuemax', String(TICK_COUNT - 1))
    this.slider.setAttribute('aria-valuenow', String(ERA_IDS.indexOf(this.era)))
    this.slider.setAttribute('aria-valuetext', `Era ${getEraSpec(this.era).label}`)
    this.track.appendChild(this.slider)

    this.ariaValue = this.doc.createElement('span')
    this.ariaValue.className = 'sr-only'
    this.ariaValue.setAttribute('aria-hidden', 'true')
    this.slider.appendChild(this.ariaValue)

    widget.appendChild(this.track)

    const ticksRow = this.doc.createElement('div')
    ticksRow.className = 'timeline-ticks'
    ticksRow.setAttribute('data-testid', 'timeline-ticks')

    this.ticks = []
    this.eraLabels = []
    for (const id of ERA_IDS) {
      const spec = getEraSpec(id)
      const slotPercent = (ERA_IDS.indexOf(id) / (TICK_COUNT - 1)) * 100
      const tick = this.doc.createElement('button')
      tick.type = 'button'
      tick.className = 'timeline-tick'
      tick.dataset.era = id
      tick.style.left = `${slotPercent}%`
      tick.setAttribute('aria-label', `Go to ${spec.label}`)
      tick.title = `${spec.label} — ${spec.description}`
      tick.appendChild(this.doc.createTextNode(''))
      this.ticks.push(tick)
      ticksRow.appendChild(tick)

      const label = this.doc.createElement('span')
      label.className = 'timeline-era-label'
      label.dataset.era = id
      label.style.left = `${slotPercent}%`
      label.textContent = spec.label
      this.eraLabels.push(label)
      ticksRow.appendChild(label)
    }

    widget.appendChild(ticksRow)
    this.root.appendChild(widget)

    this.transitioningBadge = this.doc.createElement('div')
    this.transitioningBadge.className = 'timeline-transitioning'
    this.transitioningBadge.setAttribute('role', 'status')
    this.transitioningBadge.setAttribute('aria-live', 'polite')
    this.transitioningBadge.setAttribute('data-testid', 'timeline-transitioning')
    this.transitioningBadge.textContent = 'Transitioning…'
    this.transitioningBadge.hidden = true
    this.root.appendChild(this.transitioningBadge)

    this.onStateChange = (event: Event) => {
      const detail = (event as CustomEvent<EraStateChangeDetail>).detail
      if (!detail) return
      if (detail.era && detail.era !== this.era) {
        this.setEra(detail.era, { emit: false })
      }
      this.transitioningBadge.hidden = !detail.transitioning
    }
    this.target.addEventListener(ERA_STATE_CHANGE_EVENT, this.onStateChange)

    this.onKeyDown = (event: KeyboardEvent) => {
      if (event.target !== this.slider) return
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault()
        this.selectRelative(1)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault()
        this.selectRelative(-1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        this.selectEra(ERA_IDS[0])
      } else if (event.key === 'End') {
        event.preventDefault()
        this.selectEra(ERA_IDS[TICK_COUNT - 1])
      }
    }
    this.slider.addEventListener('keydown', this.onKeyDown)

    this.onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return
      event.preventDefault()
      this.dragging = true
      this.track.setPointerCapture(event.pointerId)
      this.slider.focus()
      this.commitFromClientX(event.clientX)
    }
    this.track.addEventListener('pointerdown', this.onPointerDown)

    this.onPointerMove = (event: PointerEvent) => {
      if (!this.dragging) return
      event.preventDefault()
      this.commitFromClientX(event.clientX)
    }
    this.track.addEventListener('pointermove', this.onPointerMove)

    this.onPointerUp = (event: PointerEvent) => {
      if (!this.dragging) return
      this.dragging = false
      if (this.track.hasPointerCapture(event.pointerId)) {
        this.track.releasePointerCapture(event.pointerId)
      }
    }
    this.track.addEventListener('pointerup', this.onPointerUp)

    this.onPointerCancel = (event: PointerEvent) => {
      if (!this.dragging) return
      this.dragging = false
      if (this.track.hasPointerCapture(event.pointerId)) {
        this.track.releasePointerCapture(event.pointerId)
      }
    }
    this.track.addEventListener('pointercancel', this.onPointerCancel)

    this.onClick = (event: MouseEvent) => {
      if (this.dragging) return
      const tick = (event.target as HTMLElement).closest<HTMLElement>('.timeline-tick')
      if (!tick || !tick.dataset.era) return
      this.selectEra(tick.dataset.era as EraId)
    }
    this.ticksRow = ticksRow
    ticksRow.addEventListener('click', this.onClick)

    this.onBlur = () => {
      if (this.dragging) {
        this.dragging = false
      }
    }
    this.slider.addEventListener('blur', this.onBlur)

    this.render()
  }

  private ticksRow: HTMLDivElement

  /** Current selected era. */
  get value(): EraId {
    return this.era
  }

  /** Programmatic selection: updates UI and dispatches era-change. */
  selectEra(era: EraId): void {
    if (this.disposed) return
    if (this.era === era) return
    this.setEra(era, { emit: true })
  }

  private selectRelative(delta: number): void {
    const index = ERA_IDS.indexOf(this.era)
    const next = index + delta
    if (next < 0 || next >= TICK_COUNT) return
    this.selectEra(ERA_IDS[next])
  }

  private setEra(era: EraId, opts: { emit: boolean }): void {
    const prev = this.era
    this.era = era
    this.render()
    if (opts.emit && prev !== era) {
      this.target.dispatchEvent(
        new CustomEvent<EraChangeDetail>(ERA_CHANGE_EVENT, {
          detail: { era, prev },
        }),
      )
      this.onSelect?.(era)
    }
  }

  private commitFromClientX(clientX: number): void {
    const rect = this.track.getBoundingClientRect()
    if (rect.width <= 0) return
    const ratio = (clientX - rect.left) / rect.width
    const clamped = Math.min(1, Math.max(0, ratio))
    const index = Math.round(clamped * (TICK_COUNT - 1))
    this.selectEra(ERA_IDS[index])
  }

  private render(): void {
    const index = ERA_IDS.indexOf(this.era)
    const percent = (index / (TICK_COUNT - 1)) * 100
    this.fill.style.width = `${percent}%`
    this.slider.style.left = `${percent}%`
    this.slider.setAttribute('aria-valuenow', String(index))
    this.slider.setAttribute('aria-valuetext', `Era ${getEraSpec(this.era).label}`)
    this.ariaValue.textContent = getEraSpec(this.era).label

    for (let i = 0; i < TICK_COUNT; i += 1) {
      const active = i === index
      this.ticks[i].classList.toggle('is-active', active)
      this.ticks[i].setAttribute('aria-pressed', String(active))
      this.eraLabels[i].classList.toggle('is-active', active)
      this.ticks[i].setAttribute('tabindex', active ? '-1' : '0')
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.target.removeEventListener(ERA_STATE_CHANGE_EVENT, this.onStateChange)
    this.slider.removeEventListener('keydown', this.onKeyDown)
    this.track.removeEventListener('pointerdown', this.onPointerDown)
    this.track.removeEventListener('pointermove', this.onPointerMove)
    this.track.removeEventListener('pointerup', this.onPointerUp)
    this.track.removeEventListener('pointercancel', this.onPointerCancel)
    this.ticksRow.removeEventListener('click', this.onClick)
    this.slider.removeEventListener('blur', this.onBlur)
    this.root.remove()
  }
}