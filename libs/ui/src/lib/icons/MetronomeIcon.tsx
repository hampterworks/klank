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
    {/* Trapezoidal body: wide base, narrower top */}
    <path
      d="M5 20 L12 4 L19 20 Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Flat base line (bottom of body) */}
    <line
      x1="5"
      y1="20"
      x2="19"
      y2="20"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Center vertical staff from apex down */}
    <line
      x1="12"
      y1="4"
      x2="12"
      y2="19"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Pendulum arm angled right — implies a mid-swing position */}
    <line
      x1="12"
      y1="11"
      x2="16"
      y2="7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Pendulum weight: small filled circle at the tip of the arm */}
    <circle cx="16" cy="7" r="1.5" fill="currentColor" />
  </svg>
)
