import * as React from "react";

/** Clock face — toggles the menu between artist grouping and recently-played order. */
export const SortRecentIcon: React.FC<React.ComponentPropsWithoutRef<'svg'>> = (props) =>
  <svg width="18px" height="18px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
