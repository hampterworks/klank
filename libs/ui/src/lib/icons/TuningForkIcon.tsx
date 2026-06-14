import * as React from 'react'

export const TuningForkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="20px"
    height="20px"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Handle / stem: vertical line from bottom center up to mid-body */}
    <line
      x1="12"
      y1="22"
      x2="12"
      y2="13"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Left tine: curves up and out from the stem junction */}
    <path
      d="M12 13 C12 13 8 13 8 9 C8 5 12 4 12 4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Right tine: mirror of left */}
    <path
      d="M12 13 C12 13 16 13 16 9 C16 5 12 4 12 4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
)
