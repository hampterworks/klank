import * as React from 'react'

export const KeyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="24px"
    height="24px"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Round bow / head of the key */}
    <circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.75" />
    {/* Shaft running from the head toward the teeth */}
    <line
      x1="11.25"
      y1="11.25"
      x2="20"
      y2="20"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    {/* Teeth notches near the tip of the shaft */}
    <line
      x1="16.5"
      y1="15.5"
      x2="18.5"
      y2="13.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <line
      x1="18.5"
      y1="17.5"
      x2="20.5"
      y2="15.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
)
