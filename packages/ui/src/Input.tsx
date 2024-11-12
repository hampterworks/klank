"use client"

import styled, {css} from "styled-components";
import React, {useEffect, useState} from "react";

const ElementWrapper = styled.div<{ $sx?: ReturnType<typeof css> }>`
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    color: ${props => props.theme.textColor};
    ${props => props.$sx}
`

const InputWrapper = styled.div<
  {
    $iconLeft: boolean,
    $iconRight: boolean,
    $isInvalid: boolean,
    $disabled: boolean
  }>
  `
      --text-padding: 36px;
      --input-height: 37px;
      position: relative;

      input {
          height: var(--input-height);
          width: 100%;
          background: ${props => props.theme.background};
          border: 1px solid ${props => props.theme.borderColor};
          border-radius: 4px;
          color-scheme: dark; //TODO: connect to global state

          ${props => {
              if (!props.$iconLeft && !props.$iconRight) {
                  return css`padding: 8px;`
              }
              if (!props.$iconLeft && props.$iconRight) {
                  return css`padding: 8px var(--text-padding) 8px 8px;`
              }
              if (props.$iconLeft && !props.$iconRight) {
                  return css`padding: 8px 8px 8px var(--text-padding);`
              }

              return css`padding: 8px var(--text-padding);`
          }}
          &:focus:invalid {
              border: 3px solid red;
          }

          ${props => props.$isInvalid && css`border: 3px solid red;`}
          &::-webkit-calendar-picker-indicator {
              cursor: pointer;
          }

          &::placeholder {
              color: gray;
              opacity: 1; /* Firefox */
          }

          ${props => props.$disabled && css`
              cursor: not-allowed;
              color: gray;
          `}
      }
  `

const IconCommon = styled.div`
    --icon-size: 18px;
    --icon-padding: 8px;

    position: absolute;
    height: var(--icon-size);
    max-width: var(--icon-size);
    top: calc(50% - (var(--icon-size) / 2));

    svg {
        height: var(--icon-size);
    }

    button {
        position: absolute;
        height: var(--input-height);
    }
`

const IconLeft = styled(IconCommon)`
    left: var(--icon-padding);

    button {
        top: -10px;
        left: -16px;
    }
`

const IconRight = styled(IconCommon)`
    right: var(--icon-padding);

    button {
        top: -10px;
        right: -16px;
    }
`
/**
 * Represents the props for the Input component.
 *
 * @typedef {Object} InputProps
 * @property {string=} label - The label for the input.
 * @property {React.ReactNode=} iconLeft - The React node for the icon on the left side of the input.
 * @property {React.ReactNode=} iconRight - The React node for the icon on the right side of the input.
 * @property {React.ReactNode=} requiredTitle - The React node for the required title of the input.
 * @property {boolean=} isInvalid - Specifies whether the input is invalid or not.
 * @property {(value: string) => void=} onInput - The function to be called when the input value changes.
 * @property {ReturnType<typeof css>=} sx - The style object for the input.
 * @property {React.ComponentPropsWithRef<'input'>} - The additional props for the underlying input element.
 */
type InputProps = {
  label?: string
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode,
  requiredTitle?: React.ReactNode
  isInvalid?: boolean
  onInput?: (value: string) => void
  sx?: ReturnType<typeof css>
} & React.ComponentPropsWithRef<'input'>

/**
 * React functional component that renders an input element with optional label, icons, and validation.
 *
 * @param {object} props - The component props.
 * @param {string} props.id - The ID of the input element.
 * @param {string} [props.type='text'] - The type of the input element.
 * @param {string} props.value - The value of the input element.
 * @param {function} props.onChange - The callback function to handle input value changes.
 * @param {function} [props.onFocus] - The callback function to handle input focus event.
 * @param {function} [props.onBlur] - The callback function to handle input blur event.
 * @param {string} [props.label] - The label text for the input element.
 * @param {ReactNode} [props.iconLeft] - The icon component to be displayed on the left side of the input element.
 * @param {ReactNode} [props.iconRight] - The icon component to be displayed on the right side of the input element.
 * @param {object} [props.sx] - Custom styles for the root element.
 * @param {boolean} [props.required] - Whether the input element is required.
 * @param {string} [props.requiredTitle] - The title attribute for the required label.
 * @param {boolean} [props.isInvalid] - Whether the input is invalid or not.
 * @param {function} [props.onInput] - The callback function to handle input value changes with more control.
 *
 * @returns {JSX.Element} The rendered input component.
 */
const Input: React.ForwardRefRenderFunction<HTMLInputElement, InputProps> = (props, ref) => {
  const {
    id,
    type,
    value,
    onChange,
    onFocus,
    onBlur,
    label,
    iconLeft,
    iconRight,
    sx,
    required,
    requiredTitle,
    isInvalid,
    onInput,
    disabled,
    ...restProps
  } = props

  const [inputValue, setInputValue] = useState(value)

  useEffect(() => {
    if (value !== undefined)
      setInputValue(value)

  }, [value])

  return <ElementWrapper $sx={sx}>
    {
      label !== undefined &&
      <label htmlFor={id}>{label}</label>
    }
    <InputWrapper
      $iconLeft={iconLeft !== undefined}
      $iconRight={iconRight !== undefined}
      $isInvalid={isInvalid ?? false}
      $disabled={disabled ?? false}
    >
      {
        props.iconLeft !== undefined && <IconLeft>
          {props.iconLeft}
        </IconLeft>
      }
      <input
        ref={ref}
        id={id}
        type={type || 'text'}
        value={inputValue ?? ''}
        onChange={onChange ?? ((event) => {
          setInputValue(event.target.value)
          if (onInput !== undefined)
            onInput(event.target.value)
        })}
        onFocus={onFocus}
        onBlur={onBlur}
        required={required}
        disabled={disabled}
        {...restProps}
      />
      {
        props.iconRight !== undefined && <IconRight>
          {props.iconRight}
        </IconRight>
      }
    </InputWrapper>
  </ElementWrapper>
}


export default React.forwardRef(Input)
