/**
 * Era state store.
 *
 * The store is decoupled from any view: the timeline slider dispatches an
 * `era-change` CustomEvent, the store listens, validates the era against the
 * five-era registry, and re-emits the canonical event on a dedicated
 * `window`-level channel (`era-state-change`) so scene/audio modules can react
 * without importing UI code. It also announces the change to assistive
 * technology via an aria-live region.
 */

import { ERA_IDS, getEraSpec, isEraId, type EraId } from './eras'

export const ERA_CHANGE_EVENT = 'era-change'
export const ERA_STATE_CHANGE_EVENT = 'era-state-change'

export interface EraState {
  /** Currently selected era id. */
  era: EraId
  /** 0-based position of the selected era within the ordered registry. */
  index: number
  /** True while a scene morph between eras is in flight. */
  transitioning: boolean
}

export interface EraChangeDetail {
  era: EraId
  prev: EraId
}

export interface EraStateChangeDetail extends EraChangeDetail {
  index: number
  prevIndex: number
  source: 'timeline' | 'store'
  /** True while the scene morph between eras is in flight. */
  transitioning: boolean
}

const INITIAL_ERA: EraId = '1945'

function createInitialState(): EraState {
  return {
    era: INITIAL_ERA,
    index: ERA_IDS.indexOf(INITIAL_ERA),
    transitioning: false,
  }
}

function ensureLiveRegion(target: Document): HTMLElement | null {
  if (!target.body) return null
  let region = target.querySelector<HTMLElement>('#era-live-region')
  if (!region) {
    region = target.createElement('div')
    region.id = 'era-live-region'
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('role', 'status')
    region.style.position = 'absolute'
    region.style.width = '1px'
    region.style.height = '1px'
    region.style.overflow = 'hidden'
    region.style.clip = 'rect(0 0 0 0)'
    region.style.whiteSpace = 'nowrap'
    region.style.border = '0'
    region.style.margin = '-1px'
    region.style.padding = '0'
    target.body.appendChild(region)
  }
  return region
}

function announce(target: Document, message: string): void {
  const region = ensureLiveRegion(target)
  if (!region) return
  region.textContent = ''
  // Force a reflow so repeated identical messages still announce.
  void region.offsetWidth
  region.textContent = message
}

export class EraStateStore {
  readonly state: EraState
  private readonly target: EventTarget
  private readonly doc: Document
  private readonly onEraChange: (event: Event) => void
  private disposed = false

  constructor(target: EventTarget = window, doc: Document = document) {
    this.target = target
    this.doc = doc
    this.state = createInitialState()
    this.onEraChange = (event: Event) => {
      const detail = (event as CustomEvent<EraChangeDetail>).detail
      if (detail && isEraId(detail.era)) {
        this.setEra(detail.era, 'timeline')
      }
    }
    this.target.addEventListener(ERA_CHANGE_EVENT, this.onEraChange)
  }

  /** Select an era by id. Dispatches the canonical store-level event. */
  setEra(era: EraId, source: 'timeline' | 'store' = 'store'): void {
    if (this.disposed) return
    if (this.state.era === era) return
    const prev = this.state.era
    const prevIndex = this.state.index
    const spec = getEraSpec(era)
    this.state.era = era
    this.state.index = ERA_IDS.indexOf(era)
    this.state.transitioning = true

    const detail: EraStateChangeDetail = {
      era,
      prev,
      index: this.state.index,
      prevIndex,
      source,
      transitioning: true,
    }
    this.target.dispatchEvent(
      new CustomEvent<EraStateChangeDetail>(ERA_STATE_CHANGE_EVENT, {
        detail,
      }),
    )
    announce(this.doc, `Timeline moved to ${spec.label}`)
  }

  /** Transition finished: clears the transitioning flag. */
  endTransition(): void {
    if (this.disposed) return
    if (!this.state.transitioning) return
    this.state.transitioning = false
    const detail: EraStateChangeDetail = {
      era: this.state.era,
      prev: this.state.era,
      index: this.state.index,
      prevIndex: this.state.index,
      source: 'store',
      transitioning: false,
    }
    this.target.dispatchEvent(
      new CustomEvent<EraStateChangeDetail>(ERA_STATE_CHANGE_EVENT, {
        detail,
      }),
    )
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.target.removeEventListener(ERA_CHANGE_EVENT, this.onEraChange)
  }
}