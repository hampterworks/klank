"use client"

import React from "react";
import styled, {css} from "styled-components";

type Headings = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
type Variants = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

const Heading = styled.span<{ $variant?: Variants, $sx?: ReturnType<typeof css> }>`
    font-weight: bold;

    ${props => {
        switch (props.$variant) {
            case 'h1':
                return 'font-size: 2em;';
            case 'h2':
                return 'font-size: 1.5em';
            case 'h3':
                return 'font-size: 1.17em';
            case 'h4':
                return 'font-size: 1em';
            case 'h5':
                return 'font-size: .83em';
            case 'h6':
                return 'font-size: .67em';
            default:
                return '';
        }
    }}

    ${props => props.$sx}
`

/**
 * Represents the props for the Typography component.
 * @typedef {object} TypographyProps
 * @property {Variants} [variant] - The variant of the Typography component.
 * @property {Headings} [component] - The HTML heading element to be used for the Typography component.
 * @property {React.ReactNode} children - The content of the Typography component.
 * @property {ReturnType<typeof css>} [sx] - Additional styles applied to the Typography component using the css() function.
 * @property {React.ComponentPropsWithoutRef<'h1'>} - Additional props passed to the underlying HTML h1 element.
 */
type TypographyProps = {
  variant?: Variants
  component?: Headings
  children: React.ReactNode
  sx?: ReturnType<typeof css>
} & React.ComponentPropsWithoutRef<'h1'>

const Typography: React.FC<TypographyProps> = ({variant, component, children, sx, ...props}) => {

  return <Heading as={component} $variant={variant} $sx={sx} {...props}>
    {children}
  </Heading>
}

export default Typography
