import styles from './increment.module.css'
import React from 'react'
import { MinIcon } from '../icons/MinIcon'
import { PlusIcon } from '../icons/PlusIcon'

type IncrementButtonProps = {
  icon: React.ReactNode
  value: number
  setValue: (value: number) => void
  min?: number
  max?: number
} & React.ComponentPropsWithRef<'div'>

const IncrementButton: React.FC<IncrementButtonProps> = ({icon, value, setValue, min, max, ...props}) => {
  const handleDecrement = () => {
    const newValue = value - 1
    if (min !== undefined && newValue < min) return
    setValue(newValue)
  }

  const handleIncrement = () => {
    const newValue = value + 1
    if (max !== undefined && newValue > max) return
    setValue(newValue)
  }

  return (
    <div className={styles.container} {...props}>
      {icon}
      <div>
        <button onClick={handleDecrement} disabled={min !== undefined ? value <= min : false}>
          <MinIcon/>
        </button>
        <span>{value ?? 0}</span>
        <button onClick={handleIncrement} disabled={max !== undefined ? value >= max : false}>
          <PlusIcon/>
        </button>
      </div>
    </div>
  )
}

export default IncrementButton
