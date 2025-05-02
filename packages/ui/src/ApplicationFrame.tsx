"use client"

import * as React from "react";
import {DefaultTheme, ThemeProvider} from "styled-components";
import theme from "./themes/baseTheme";
import useKlankStore from "web/state/store";

/**
 * Props for the ApplicationFrame component.
 */
type ApplicationFrameProps = {
  children?: React.ReactNode;
}

/**
 * Represents the application frame component.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {ReactNode} props.children - The children components to render within the frame.
 * @returns {ReactElement} The rendered application frame component.
 */
const ApplicationFrame: React.FC<ApplicationFrameProps> = ({children}) => {
  const activeTheme: keyof typeof theme = useKlankStore().theme

  const currentTheme: DefaultTheme = theme[activeTheme]

  return <ThemeProvider theme={currentTheme}>
    {children}
  </ThemeProvider>
}

export default ApplicationFrame
