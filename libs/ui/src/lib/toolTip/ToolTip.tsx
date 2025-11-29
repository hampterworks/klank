import React, {useState, useRef} from "react";
import styles from './toolTip.module.css';

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
    <div
      className={styles.container}
      {...props}
      ref={wrapperRef}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onMouseMove={handleMouseMove}
    >
      {children}
      {
        isVisible && <div className={styles.tooltip} style={{...position, pointerEvents: 'none'}}>
          {message}
        </div>
      }
    </div>
  )
}

export default ToolTip;
