"use client"
import React, {useState} from "react";
import styled from "styled-components";

const ToolTipWrapper = styled.div`
    position: relative;
`
const HoverEffectSpan = styled.span`
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
`

const ToolTipElement = styled.div`
    position: fixed;
    border: 1px solid ${props => props.theme.borderColor};
    background: ${props => props.theme.secondaryBackground};
    padding: 4px;
    border-radius: 4px;
    z-index: 2;
`
type ToolTipProps = {
  message: string
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<'span'>

const ToolTip: React.FC<ToolTipProps> = ({message, children, ...props}) => {
  const [position, setPosition] = useState({left: '0px', top: '0px'})
  const [isVisible, setIsVisible] = useState(false)

  const handleMouseEnter = () => {
    setIsVisible(true)
  }

  const handleMouseLeave = () => {
    setIsVisible(false)
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    setPosition({
      left: `${event.clientX + 14}px`,
      top: `${event.clientY + 14}px`,
    })
  }

  return (
    <ToolTipWrapper {...props} onMouseMove={handleMouseMove}>
      {children}
      <HoverEffectSpan
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {
          isVisible && <ToolTipElement style={position}>
            {message}
          </ToolTipElement>
        }
      </HoverEffectSpan>
    </ToolTipWrapper>
  )
}

export default ToolTip;
