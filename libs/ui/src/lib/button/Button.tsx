import * as React from "react";
import styles from './button.module.css';

type ButtonProps = ({
  label: React.ReactNode
  size?: 'small' | 'medium' | 'large'
  icon?: React.ReactElement
  iconDirection?: 'left' | 'right'
  iconButton?: false
} | {
  label?: never
  size?: never
  icon: React.ReactElement
  iconDirection?: never
  iconButton: true
}) & React.ComponentPropsWithRef<'button'>

const Button: React.FC<ButtonProps> = ({label, size, icon, iconDirection, iconButton, className
,                                         ...props}) => {
  const direction = iconDirection === undefined || iconDirection === 'left' ? 'left' : 'right'

  const buttonClassName = [
    iconButton ? styles.iconContainer : styles.container,
    className || ''
  ].filter(Boolean).join(' ')

  return <button
    className={buttonClassName}
    type={props.type ?? 'button'}
    style={{
      '--button-size': size,
    } as React.CSSProperties & Record<string, string | number>}
    {...props}
  >
    {(icon !== undefined && direction === 'left') && icon}
    {label !== undefined && label}
    {(icon !== undefined && direction === 'right') && icon}
  </button>
}

export default Button
