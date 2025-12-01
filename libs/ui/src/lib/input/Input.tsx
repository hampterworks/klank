import styles from './input.module.css';
import React, {useEffect, useState} from "react";

type InputProps = {
  label?: string
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode,
} & React.ComponentPropsWithRef<'input'>

const Input = (props: InputProps) => {
  const {
    id,
    type,
    value,
    label,
    iconLeft,
    iconRight,
    ref,
    ...restProps
  } = props

  const [inputValue, setInputValue] = useState(value)

  useEffect(() => {
    if (value !== undefined)
      setInputValue(value)
  }, [value])

  return <div className={styles.container}>
    {
      label !== undefined &&
      <label htmlFor={id}>{label}</label>
    }
    <div className={styles.inputWrapper}>
      {
        iconLeft !== undefined && iconLeft
      }
      <input
        ref={ref}
        id={id}
        type={type || 'text'}
        value={inputValue ?? ''}
        onChange={(e) => setInputValue(e.target.value)}
        {...restProps}
      />
      {
        iconRight !== undefined && iconRight
      }
    </div>
  </div>
}

export default Input
