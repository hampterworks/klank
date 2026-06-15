import React, {useState, useRef} from "react";
import styles from './toolTip.module.css';

type ToolTipProps = {
  message: string
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<'div'>

export const ToolTip: React.FC<ToolTipProps> = ({message, children, ...props}) => {
  const [position, setPosition] = useState({left: '0px', top: '0px'})
  const [isVisible, setIsVisible] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)


  const handlePointerMove = (event: React.PointerEvent) => {
    if (event.pointerType === 'touch') return
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
      onPointerEnter={(e) => { if (e.pointerType !== 'touch') setIsVisible(true) }}
      onPointerLeave={() => setIsVisible(false)}
      onPointerMove={handlePointerMove}
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
