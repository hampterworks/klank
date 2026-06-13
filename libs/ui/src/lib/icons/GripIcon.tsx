import * as React from 'react'

export const GripIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="10"
    height="14"
    viewBox="0 0 10 14"
    fill="currentColor"
    {...props}
  >
    <circle cx="3" cy="2.5" r="1.2" />
    <circle cx="7" cy="2.5" r="1.2" />
    <circle cx="3" cy="7" r="1.2" />
    <circle cx="7" cy="7" r="1.2" />
    <circle cx="3" cy="11.5" r="1.2" />
    <circle cx="7" cy="11.5" r="1.2" />
  </svg>
)
