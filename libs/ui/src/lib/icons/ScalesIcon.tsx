import * as React from 'react'

export const ScalesIcon: React.FC<React.ComponentPropsWithoutRef<'svg'>> = (props) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Vertical string lines */}
    <line x1="6" y1="3" x2="6" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="18" y1="3" x2="18" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Horizontal fret lines */}
    <line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Scale degree dots */}
    <circle cx="6" cy="9.5" r="2" fill="currentColor" />
    <circle cx="12" cy="14.5" r="2" fill="currentColor" />
    <circle cx="18" cy="9.5" r="2" fill="currentColor" />
  </svg>
)
