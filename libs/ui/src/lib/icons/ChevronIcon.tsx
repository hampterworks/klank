import * as React from "react";

export const ChevronIcon: React.FC<React.ComponentPropsWithoutRef<'svg'>> = (props) =>
  <svg width="14px" height="14px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="24" height="24"/>
    <path d="M17 9.5L12 14.5L7 9.5" stroke="#000000" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
