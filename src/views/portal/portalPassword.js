import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { toast } from 'react-toastify'
import { portalPost, readErr } from '../../utils/portalApi'
import PasswordInput from '../../components/PasswordInput'

/** First sign-in: replacing the temporary password an admin issued. */
const PortalPassword = ({ onDone }) => {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const submit = async (e) => {
    e.preventDefault()

    // Checked here as well as on the server.
    if (form.next.length < 8) return setError('Your new password must be at least 8 characters.')
    if (form.next !== form.confirm) return setError('The two new passwords do not match.')
    if (form.next === form.current) return setError('Your new password must be different.')

    setSaving(true)
    setError('')
    try {
      await portalPost('/PortalAccount/ChangePassword', {
        currentPassword: form.current,
        newPassword: form.next,
      })
      toast.success('Your password has been set.', { theme: 'colored', autoClose: 4000 })
      setForm({ current: '', next: '', confirm: '' })
      if (onDone) await onDone()
    } catch (err) {
      setError(readErr(err))
    } finally {
      setSaving(false)
    }
  }

  const field = (id, label, value, key, autoComplete, hint) => (
    <label
      htmlFor={id}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}
    >
      <span style={{ fontSize: 'var(--pt-fs-xs)', fontWeight: 600, color: 'var(--pt-muted)' }}>
        {label}
      </span>
      <PasswordInput
        id={id}
        className=""
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => set({ [key]: e.target.value })}
        style={{
          width: '100%',
          height: 46,
          padding: '0 14px',
          font: 'inherit',
          fontSize: 'var(--pt-fs-body)',
          color: 'var(--pt-ink)',
          background: 'var(--pt-surface)',
          border: '1px solid var(--pt-border)',
          borderRadius: 12,
          outline: 'none',
        }}
      />
      {hint && (
        <span style={{ fontSize: 'var(--pt-fs-xs)', color: 'var(--pt-muted)' }}>{hint}</span>
      )}
    </label>
  )

  return (
    <>
      <div className="pt-head">
        <div>
          <span className="pt-head__eyebrow">One step before you start</span>
          <h1>Set your password</h1>
        </div>
      </div>

      <div className="pt-note pt-note--amber" style={{ maxWidth: 560 }}>
        <span className="pt-note__icon">
          <span className="material-icons">lock</span>
        </span>
        <span>
          <strong>You are using a temporary password</strong>
          <span>
            Choose your own to continue. The rest of the portal opens as soon as you have.
          </span>
        </span>
      </div>

      <div className="pt-card" style={{ maxWidth: 560 }}>
        {error && (
          <div className="pt-note pt-note--amber" style={{ marginBottom: 16 }}>
            <span className="pt-note__icon">
              <span className="material-icons">error_outline</span>
            </span>
            <span>
              <span>{error}</span>
            </span>
          </div>
        )}

        <form onSubmit={submit}>
          {field(
            'pw-current',
            'Temporary password',
            form.current,
            'current',
            'current-password',
            'The one from the email we sent you.',
          )}
          {field(
            'pw-next',
            'New password',
            form.next,
            'next',
            'new-password',
            'At least 8 characters.',
          )}
          {field('pw-confirm', 'Confirm new password', form.confirm, 'confirm', 'new-password')}

          <button
            type="submit"
            className="pt-btn pt-btn--primary"
            disabled={saving || !form.current || !form.next}
          >
            {saving ? 'Saving…' : 'Set password and continue'}
          </button>
        </form>
      </div>
    </>
  )
}

PortalPassword.propTypes = {
  /** Called after a successful change so the shell can re-read /Me and open the portal. */
  onDone: PropTypes.func,
}

export default PortalPassword
