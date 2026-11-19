import React, { useState } from 'react'
import PropTypes from 'prop-types'

/**
 * A password field with a show/hide toggle.
 *
 * One component for every password box in the app — login, the admin user form, SMTP settings and
 * both portal password screens — rather than the same eye-icon plumbing copied six times.
 *
 * It takes and forwards the raw change EVENT, like a plain `<input>`, so it drops into existing
 * forms without rewriting their handlers. Anything else passed (required, onKeyDown, maxLength…)
 * lands on the input untouched.
 *
 * Hidden by default, always: the toggle exists so someone can check what they typed, not so a
 * password sits in plain view on a shared screen. The state is local and per-field, so revealing
 * one box never reveals another and nothing is remembered between page loads.
 */
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
        // aria-pressed rather than a changing label, so a screen reader announces the control's
        // state instead of the reader having to infer it from the icon.
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
