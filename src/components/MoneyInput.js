import React, { useRef, useLayoutEffect } from 'react'
import PropTypes from 'prop-types'
import {
  cleanNumeric,
  groupDigits,
  countNumericChars,
  caretAfterNumericChars,
  DEFAULT_CURRENCY,
} from '../utils/money'

/** An amount box that groups digits as they are typed — 10000 reads as 10,000 before you finish. */
const MoneyInput = ({
  id,
  value,
  onChange,
  currency = DEFAULT_CURRENCY,
  className = 'form-control form-control-sm rounded-0',
  style,
  placeholder = '0.00',
  disabled = false,
  ...rest
}) => {
  const inputRef = useRef(null)
  const caretRef = useRef(null)

  // Derived, not stored: the display is always the grouped form of the parent's value.
  const display = groupDigits(value ?? '')

  useLayoutEffect(() => {
    if (caretRef.current !== null && inputRef.current) {
      const pos = caretRef.current
      caretRef.current = null
      inputRef.current.setSelectionRange(pos, pos)
    }
  })

  const handleChange = (e) => {
    const el = e.target
    const before = countNumericChars(el.value.slice(0, el.selectionStart ?? el.value.length))
    const cleaned = cleanNumeric(el.value)
    caretRef.current = caretAfterNumericChars(groupDigits(cleaned), before)
    if (onChange) onChange(cleaned)
  }

  return (
    <span className={`money-field${currency ? ' money-field--ccy' : ''}`}>
      {currency && <span className="money-field__ccy">{currency}</span>}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={className}
        style={style}
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleChange}
        {...rest}
      />
    </span>
  )
}

MoneyInput.propTypes = {
  id: PropTypes.string,
  /** A clean numeric string, e.g. "10000.50". */
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** Receives the cleaned numeric string — commas already stripped. */
  onChange: PropTypes.func,
  /** Shown as a prefix inside the box. */
  currency: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
}

export default MoneyInput
