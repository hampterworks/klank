"use client"
import React, {useState, useRef} from "react";
import styled from "styled-components";

const ToolTipWrapper = styled.div`
    position: relative;
    display: inline-block;
`

const ToolTipElement = styled.div`
    position: fixed;
    border: 1px solid ${props => props.theme.borderColor};
    background: ${props => props.theme.secondaryBackground};
    padding: 4px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 400;
    z-index: 2;
    pointer-events: none;
`
type ToolTipProps = {
  message: string
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<'div'>

const ToolTip: React.FC<ToolTipProps> = ({message, children, ...props}) => {
  const [position, setPosition] = useState({left: '0px', top: '0px'})
  const [isVisible, setIsVisible] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)


  const handleMouseMove = (event: React.MouseEvent) => {
    const boundingRect = wrapperRef.current?.getBoundingClientRect()
    if (boundingRect) {
      setPosition({
        left: `${event.clientX + 14}px`,
        top: `${event.clientY + 14}px`,
      })
    }
  }

  return (
    <ToolTipWrapper
      {...props}
      ref={wrapperRef}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onMouseMove={handleMouseMove}
    >
      {children}
      {
        isVisible && <ToolTipElement style={{...position, pointerEvents: 'none'}}>
          {message}
        </ToolTipElement>
      }
    </ToolTipWrapper>
  )
}

export default ToolTip;
