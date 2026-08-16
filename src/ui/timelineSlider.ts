import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export class TimelineSlider {
  private container: HTMLElement
  private currentYear: number = 2025
  private yearButtons: NodeListOf<HTMLButtonElement>
  private onYearChange: (year: number) => void

  constructor(onChange: (year: number) => void) {
    this.onYearChange = onChange
    this.container = document.createElement('div')
    this.container.className = 'timeline'
    
    const years = [1945, 1965, 1985, 2005, 2025, 2055]
    this.yearButtons = []
    
    years.forEach(year => {
      const btn = document.createElement('button')
      btn.className = 'year-btn'
      btn.dataset.year = year.toString()
      btn.textContent = year.toString()
      btn.addEventListener('click', () => this.setYear(year))
      this.container.appendChild(btn)
      this.yearButtons.push(btn)
    })
    
    // Set initial active button
    this.setYear(2025)
  }

  setYear(year: number): void {
    this.currentYear = year
    this.yearButtons.forEach(btn => {
      const btnYear = parseInt(btn.dataset.year || '0')
      btn.classList.toggle('active', btnYear === year)
    })
    this.onYearChange(year)
  }

  getCurrentYear(): number {
    return this.currentYear
  }

  getElement(): HTMLElement {
    return this.container
  }

  resize(): void {
    // Can be extended for responsive behavior
  }
}