import React, { useState } from 'react'
import PropTypes from 'prop-types'

/** A password field with a show/hide toggle. */
const PasswordInput = ({
  id,
  value,
  onChange,
  className = 'form-control form-control-sm rounded-0',
  style,
  placeholder,
  autoComplete = 'off',
  disabled = false,
  ...rest
}) => {
  const [shown, setShown] = useState(false)

  return (
    <span className="pw-field">
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        className={className}
        style={style}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={onChange}
        {...rest}
      />
      <button
        type="button"
        className="pw-field__btn"
        // aria-pressed rather than a changing label.
        aria-pressed={shown}
        aria-label={shown ? 'Hide password' : 'Show password'}
        title={shown ? 'Hide password' : 'Show password'}
        disabled={disabled}
        onClick={() => setShown((s) => !s)}
      >
        <span className="material-icons">{shown ? 'visibility_off' : 'visibility'}</span>
      </button>
    </span>
  )
}

PasswordInput.propTypes = {
  id: PropTypes.string,
  value: PropTypes.string,
  /** Receives the change event, as a plain input would. */
  onChange: PropTypes.func,
  /** Defaults to the admin form styling; pass your own for a different context. */
  className: PropTypes.string,
  style: PropTypes.object,
  placeholder: PropTypes.string,
  autoComplete: PropTypes.string,
  disabled: PropTypes.bool,
}

export default PasswordInput
