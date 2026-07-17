import React from 'react'
import { Era } from '../lib/types'

interface PostProcessingProps {
  era: Era
}

// CSS-based effects and bloom simulation through emissive materials
// The scene uses emissive materials on buildings/vehicles for glow effects
export const PostProcessing: React.FC<PostProcessingProps> = () => {
  // Post-processing with drei's newer versions requires different setup
  // Using emissive materials in meshes for bloom-like effect
  return null
}