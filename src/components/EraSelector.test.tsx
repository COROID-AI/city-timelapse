import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EraSelector } from './EraSelector'
import { Era } from '../App'

describe('EraSelector', () => {
  const eras: Era[] = ['1945', '1965', '1985', '2005', '2025', '2055']
  const mockChange = (era: Era) => {}

  it('renders the era selector with title', () => {
    render(<EraSelector eras={eras} currentEra="1945" onEraChange={mockChange} />)
    
    expect(screen.getByText('City Evolution: 1945-2055')).toBeInTheDocument()
  })

  it('shows current era in the display', () => {
    render(<EraSelector eras={eras} currentEra="1985" onEraChange={mockChange} />)
    
    // Check for the label showing era
    expect(screen.getByText('1985', { selector: '.text-2xl' })).toBeInTheDocument()
  })

  it('renders all era jump buttons', () => {
    render(<EraSelector eras={eras} currentEra="1945" onEraChange={mockChange} />)
    
    // Check for all aria-labels
    expect(screen.getByLabelText('Jump to 1945')).toBeInTheDocument()
    expect(screen.getByLabelText('Jump to 1965')).toBeInTheDocument()
    expect(screen.getByLabelText('Jump to 1985')).toBeInTheDocument()
    expect(screen.getByLabelText('Jump to 2005')).toBeInTheDocument()
    expect(screen.getByLabelText('Jump to 2025')).toBeInTheDocument()
    expect(screen.getByLabelText('Jump to 2055')).toBeInTheDocument()
  })
})