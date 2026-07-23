import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach } from 'vitest'
import { TimelineSlider } from '../TimelineSlider'
import { useAppStore } from '../../app/store'

afterEach(() => {
  cleanup()
  useAppStore.setState({ targetEraId: 0, sfxEnabled: true, reduceMotion: false })
})

describe('TimelineSlider', () => {
  it('renders all six era buttons', () => {
    render(<TimelineSlider />)
    // Each year appears as a button (the bottom button row).
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(6)
    for (const year of [1945, 1965, 1985, 2005, 2025, 2055]) {
      expect(screen.getByText(String(year), { selector: 'button' })).toBeInTheDocument()
    }
  })

  it('has a range slider with correct min/max', () => {
    render(<TimelineSlider />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', '5')
  })

  it('updates the store when clicking an era button', async () => {
    const user = userEvent.setup()
    render(<TimelineSlider />)
    // Click the 2055 button specifically (not the label that also shows 2055).
    const btn = screen.getByText('2055', { selector: 'button' })
    await user.click(btn)
    expect(useAppStore.getState().targetEraId).toBe(5)
  })

  it('updates the store when dragging the slider', () => {
    render(<TimelineSlider />)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '3' } })
    expect(useAppStore.getState().targetEraId).toBe(3)
  })

  it('marks the active era button as pressed', () => {
    render(<TimelineSlider />)
    const btn = screen.getByText('1945', { selector: 'button' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })
})
