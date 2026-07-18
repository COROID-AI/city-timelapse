import React from 'react'

interface PostProcessingProps {
  children: React.ReactNode
  era: string
}

export function PostProcessing({ children }: PostProcessingProps) {
  return <>{children}</>
}