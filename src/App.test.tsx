import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App Component', () => {
  it('renders without crashing', () => {
    render(<App />)
  })

  it('displays the timeline slider', () => {
    render(<App />)
    expect(screen.getByText(/City Era Timelapse/)).toBeInTheDocument()
  })

  it('displays year labels', () => {
    render(<App />)
    expect(screen.getByText('1945')).toBeInTheDocument()
    expect(screen.getByText('1965')).toBeInTheDocument()
    expect(screen.getByText('1985')).toBeInTheDocument()
    expect(screen.getByText('2005')).toBeInTheDocument()
    expect(screen.getByText('2025')).toBeInTheDocument()
    expect(screen.getByText('2055')).toBeInTheDocument()
  })
})