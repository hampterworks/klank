import * as React from 'react'

export const MetronomeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="24px"
    height="24px"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Trapezoidal body */}
    <path
      d="M5 21 L12 3 L19 21 Z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Center staff */}
    <line x1="12" y1="7" x2="12" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Pendulum arm (angled right, mid-swing) */}
    <line x1="12" y1="13" x2="17" y2="8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    {/* Pendulum weight */}
    <circle cx="17" cy="8" r="1.5" fill="currentColor" />
  </svg>
)
