import React, { useRef, useLayoutEffect } from 'react'
import PropTypes from 'prop-types'
import {
  cleanNumeric,
  groupDigits,
  countNumericChars,
  caretAfterNumericChars,
  DEFAULT_CURRENCY,
} from '../utils/money'

/**
 * An amount box that groups digits as they are typed — 10000 reads as 10,000 before you finish.
 *
 * It is a TEXT input, not `type="number"`: browsers render a number input's value raw, so thousands
 * separators are simply not possible there. `inputMode="decimal"` still brings up the numeric
 * keypad on a phone, which is the part of `type="number"` worth keeping.
 *
 * The value handed back is a clean numeric STRING ("10000.50"), never the formatted text, so the
 * caller never has to strip commas before sending it anywhere.
 *
 * The caret is the fiddly part: inserting a comma shifts every character after it, and the naive
 * version sends the caret to the end on every keystroke. This counts the numeric characters before
 * the caret, reformats, then puts the caret back after that same count.
 */
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

  // Derived, not stored: the displayed text is always the grouped form of the value the parent
  // holds, so the two can never drift apart.
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
    <span className="money-field">
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
  /** Shown as a prefix inside the box. Pass null to hide it. */
  currency: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
}

export default MoneyInput
