import * as THREE from 'three'

export interface TimelineSliderOptions {
  /** Callback when a year is selected */
  onYearChange: (year: number) => void
  /** Optional: transition duration in seconds (default 2) */
  transitionDuration?: number
  /** Optional: accent color for active year (default from theme) */
  accentColor?: string
}

const DEFAULT_TRANSITION_DURATION = 2
const DEFAULT_ACCENT_COLOR = '#4a90e2'

/**
 * TimelineSlider - A full-width top-of-viewport slider for era selection.
 * 
 * Features:
 * - Semi-transparent dark bar spanning full viewport width (~60px height)
 * - 5 year labels (1945, 1965, 1985, 2005, 2025) evenly spaced
 * - Active era highlighted with accent color and larger font weight
 * - Click-to-jump and drag-to-scrub interactions
 * - Responsive, overlays correctly on 3D canvas without blocking view
 */
export class TimelineSlider {
  private container: HTMLElement
  private currentYear: number = 2025
  private yearButtons: NodeListOf<HTMLButtonElement>
  private onYearChange: (year: number) => void
  private transitionDuration: number
  private accentColor: string
  private isDragging: boolean = false
  private dragStartX: number = 0
  private dragStartYear: number = 2025
  private barWidth: number = 0

  /**
   * Creates a new TimelineSlider instance.
   * @param options Configuration options
   */
  constructor(options: TimelineSliderOptions) {
    this.onYearChange = options.onYearChange
    this.transitionDuration = options.transitionDuration ?? DEFAULT_TRANSITION_DURATION
    this.accentColor = options.accentColor ?? DEFAULT_ACCENT_COLOR
    this.yearButtons = []

    this.container = document.createElement('div')
    this.container.className = 'timeline-slider-container'
    this.container.setAttribute('role', 'region')
    this.container.setAttribute('aria-label', 'Timeline era selector')

    // Build the slider bar with year labels
    this.buildSlider()

    // Add drag-to-scrub event listeners
    this.addEventListeners()
  }

  /**
   * Build the slider bar HTML with year labels.
   * The bar is positioned at the top of the viewport, full width,
   * with semi-transparent dark background and evenly spaced year labels.
   */
  private buildSlider(): void {
    // Create the slider bar element
    const sliderBar = document.createElement('div')
    sliderBar.className = 'timeline-slider-bar'
    sliderBar.setAttribute('aria-label', 'Era timeline slider bar')

    // Year labels data
    const years = [1945, 1965, 1985, 2005, 2025]

    years.forEach(year => {
      const btn = document.createElement('button')
      btn.className = 'timeline-slider-year-btn'
      btn.dataset.year = year.toString()
      btn.textContent = year.toString()
      btn.setAttribute('role', 'menuitemradio')
      btn.setAttribute('aria-checked', 'false')
      btn.tabIndex = 0

      // Set initial active state for first label
      if (year === 2025) {
        btn.classList.add('active')
        btn.setAttribute('aria-checked', 'true')
      }

      // Click handler
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.setYear(year)
      })

      // Hover effects
      btn.addEventListener('mouseenter', () => {
        btn.classList.add('hover')
      })

      btn.addEventListener('mouseleave', () => {
        btn.classList.remove('hover')
      })

      // Drag-to-scrub: track mouse movement on the bar
      btn.addEventListener('mousedown', (e) => {
        this.startDrag(e, year)
      })

      sliderBar.appendChild(btn)
      this.yearButtons.push(btn)
    })

    this.container.appendChild(sliderBar)
  }

  /**
   * Add event listeners for drag-to-scrub and window resize.
   */
  private addEventListeners(): void {
    // Drag start on the bar
    this.container.addEventListener('mousedown', (e) => {
      this.startDrag(e, parseInt(this.yearButtons[0]?.dataset.year || '2025'))
    })

    // Global mouse move and up listeners for drag scrubbing
    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return
      const deltaX = e.clientX - this.dragStartX
      const totalWidth = this.barWidth || this.container.clientWidth
      const yearRange = 2025 - 1945 // 80 years
      const yearStep = yearRange / (this.yearButtons.length - 1)
      
      // Calculate new year based on drag distance
      const dragProgress = deltaX / totalWidth // -1 to 1 across 5 years
      const newYear = Math.max(1945, Math.min(2025, this.dragStartYear + dragProgress * yearRange))
      this.setYear(Math.round(newYear))
    }

    const onMouseUp = () => {
      this.isDragging = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    // Handle window resize
    window.addEventListener('resize', () => {
      this.resize()
    })
  }

  /**
   * Start dragging the slider for scrubbing.
   */
  private startDrag(e: MouseEvent, year: number): void {
    this.isDragging = true
    this.dragStartX = e.clientX
    this.dragStartYear = year
  }

  /**
   * Set the active year and trigger the change callback.
   * Animates the active button state with the configured transition duration.
   * @param year The year to select
   */
  setYear(year: number): void {
    this.currentYear = year

    // Update button active states
    this.yearButtons.forEach(btn => {
      const btnYear = parseInt(btn.dataset.year || '0')
      btn.classList.toggle('active', btnYear === year)
      btn.setAttribute('aria-checked', btnYear === year.toString())
    })

    // Trigger the change callback
    this.onYearChange(year)
  }

  /**
   * Get the root HTML element for the timeline slider.
   * @returns The container HTMLElement to append to the DOM
   */
  getElement(): HTMLElement {
    return this.container
  }

  /**
   * Resize the slider to match current viewport dimensions.
   * Call on window resize or layout changes.
   */
  resize(): void {
    // Update bar width reference
    this.barWidth = this.container.clientWidth
  }
}