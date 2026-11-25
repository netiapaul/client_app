import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { toast } from 'react-toastify'
import {
  portalGet,
  portalPost,
  portalPut,
  readErr,
  fmtDate,
  PortalSessionEnded,
} from '../../utils/portalApi'
import useConfirm from '../../components/useConfirm'
import PasswordInput from '../../components/PasswordInput'

/** The portal user's own account: who they are, their password, and two-step verification. */

/** A labelled field, matching the portal's form treatment. */
const Field = ({ id, label, value, onChange, type = 'text', hint, disabled, placeholder }) => {
  const boxStyle = {
    width: '100%',
    height: 46,
    padding: '0 14px',
    font: 'inherit',
    fontSize: 'var(--pt-fs-body)',
    color: 'var(--pt-ink)',
    background: disabled ? 'var(--pt-soft)' : 'var(--pt-surface)',
    border: '1px solid var(--pt-border)',
    borderRadius: 12,
    outline: 'none',
  }

  const handle = (e) => onChange && onChange(e.target.value)

  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 'var(--pt-fs-xs)', fontWeight: 600, color: 'var(--pt-muted)' }}>
        {label}
      </span>
      {type === 'password' ? (
        <PasswordInput
          id={id}
          className=""
          style={boxStyle}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={handle}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={handle}
          style={boxStyle}
        />
      )}
      {hint && (
        <span style={{ fontSize: 'var(--pt-fs-xs)', color: 'var(--pt-muted)' }}>{hint}</span>
      )}
    </label>
  )
}

Field.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func,
  type: PropTypes.string,
  hint: PropTypes.node,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
}

const PortalProfile = () => {
  // Replaces window.confirm, which the browser prefixes with its own hostname.
  const [confirm, confirmDialog] = useConfirm()
  const navigate = useNavigate()

  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Details
  const [details, setDetails] = useState({ name: '', phoneNumber: '' })
  const [savingDetails, setSavingDetails] = useState(false)

  // Password
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '', code: '' })
  const [codeSent, setCodeSent] = useState(null)
  const [sendingCode, setSendingCode] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)

  // Two-step
  const [setup, setSetup] = useState(null) // { secret, otpAuthUri, qrCodeDataUri }
  const [tfCode, setTfCode] = useState('')
  const [tfBusy, setTfBusy] = useState(false)
  const [codes, setCodes] = useState(null) // backup codes, shown once

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = await portalGet('/PortalAccount/Profile')
      setMe(p)
      setDetails({ name: p.name ?? '', phoneNumber: p.phoneNumber ?? '' })
      setError('')
    } catch (e) {
      if (e instanceof PortalSessionEnded) {
        navigate('/', { replace: true })
        return
      }
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    load()
  }, [load])

  const saveDetails = async () => {
    if (!details.name.trim()) return setError('Your name is required.')
    setSavingDetails(true)
    setError('')
    try {
      await portalPut('/PortalAccount/Profile', {
        name: details.name.trim(),
        phoneNumber: details.phoneNumber.trim(),
      })
      toast.success('Your details have been updated.', { theme: 'colored', autoClose: 4000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSavingDetails(false)
    }
  }

  const sendCode = async () => {
    setSendingCode(true)
    setError('')
    try {
      const r = await portalPost('/PortalAccount/PasswordCode')
      setCodeSent(r)
      toast.info(r.message, { theme: 'colored', autoClose: 6000 })
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSendingCode(false)
    }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pwd.next.length < 8) return setError('Your new password must be at least 8 characters.')
    if (pwd.next !== pwd.confirm) return setError('The two new passwords do not match.')
    if (!pwd.code.trim()) return setError('Enter the code we emailed you.')

    setSavingPwd(true)
    setError('')
    try {
      await portalPost('/PortalAccount/ChangePassword', {
        currentPassword: pwd.current,
        newPassword: pwd.next,
        code: pwd.code.trim(),
      })
      toast.success('Your password has been updated.', { theme: 'colored', autoClose: 5000 })
      setPwd({ current: '', next: '', confirm: '', code: '' })
      setCodeSent(null)
    } catch (err) {
      setError(readErr(err))
    } finally {
      setSavingPwd(false)
    }
  }

  const startSetup = async () => {
    setTfBusy(true)
    setError('')
    try {
      setSetup(await portalPost('/PortalAccount/TwoFactor/Setup'))
      setTfCode('')
    } catch (e) {
      setError(readErr(e))
    } finally {
      setTfBusy(false)
    }
  }

  const enable = async () => {
    setTfBusy(true)
    setError('')
    try {
      const r = await portalPost('/PortalAccount/TwoFactor/Enable', { code: tfCode.trim() })
      setCodes(r.recoveryCodes ?? [])
      setSetup(null)
      setTfCode('')
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setTfBusy(false)
    }
  }

  const disable = async () => {
    if (!(await confirm('Turn off two-step verification? Your account will be less protected.')))
      return
    setTfBusy(true)
    setError('')
    try {
      await portalPost('/PortalAccount/TwoFactor/Disable', { code: tfCode.trim() })
      toast.success('Two-step verification turned off.', { theme: 'colored', autoClose: 4000 })
      setTfCode('')
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setTfBusy(false)
    }
  }

  const newCodes = async () => {
    setTfBusy(true)
    setError('')
    try {
      const r = await portalPost('/PortalAccount/TwoFactor/RecoveryCodes', { code: tfCode.trim() })
      setCodes(r.recoveryCodes ?? [])
      setTfCode('')
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setTfBusy(false)
    }
  }

  if (loading) return <div className="pt-empty">Loading…</div>

  return (
    <>
      {confirmDialog}

      <div className="pt-head">
        <div>
          <span className="pt-head__eyebrow">Your account</span>
          <h1>Profile</h1>
        </div>
      </div>

      {error && (
        <div className="pt-note pt-note--amber">
          <span className="pt-note__icon">
            <span className="material-icons">error_outline</span>
          </span>
          <span>
            <span>{error}</span>
          </span>
        </div>
      )}

      {/* Who you are */}
      <section className="pt-card">
        <h2 className="pt-card__title">Your details</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
            gap: 14,
            marginTop: 16,
          }}
        >
          <Field
            id="pf-name"
            label="Full name"
            value={details.name}
            onChange={(v) => setDetails((d) => ({ ...d, name: v }))}
          />
          <Field
            id="pf-phone"
            label="Phone"
            value={details.phoneNumber}
            placeholder="07…"
            onChange={(v) => setDetails((d) => ({ ...d, phoneNumber: v }))}
          />
          <Field
            id="pf-email"
            label="Email (your sign-in)"
            value={me?.email ?? ''}
            disabled
            hint="Contact Corebase support to change this — it is also where verification codes go."
          />
        </div>

        <div className="pt-tiles" style={{ marginTop: 16 }}>
          <div className="pt-tile">
            <span className="pt-tile__k">Member since</span>
            <span style={{ fontSize: 'var(--pt-fs-body)', fontWeight: 700 }}>
              {fmtDate(me?.createdAt) ?? '—'}
            </span>
          </div>
          <div className="pt-tile">
            <span className="pt-tile__k">Last sign-in</span>
            <span style={{ fontSize: 'var(--pt-fs-body)', fontWeight: 700 }}>
              {me?.lastLoginAt
                ? new Date(me.lastLoginAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'This is your first'}
            </span>
          </div>
          <div className="pt-tile">
            <span className="pt-tile__k">Companies you can see</span>
            <span style={{ fontSize: 'var(--pt-fs-body)', fontWeight: 700 }}>
              {me?.companies?.length ?? 0}
            </span>
          </div>
        </div>

        {me?.companies?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {me.companies.map((c) => (
              <span key={c.cusCode} className={`pt-tag ${c.isPrimary ? '' : 'pt-tag--muted'}`}>
                {c.companyName || c.cusCode}
                {c.isPrimary && <span style={{ opacity: 0.75 }}>default</span>}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            className="pt-btn pt-btn--primary"
            disabled={savingDetails}
            onClick={saveDetails}
          >
            {savingDetails ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </section>

      {/* Password */}
      <section className="pt-card">
        <h2 className="pt-card__title">Password</h2>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 'var(--pt-fs-sm)',
            color: 'var(--pt-muted)',
            lineHeight: 1.6,
          }}
        >
          For your security we email a short code before changing your password. Being signed in
          shows someone is at the keyboard; the code shows it is you.
        </p>

        <form onSubmit={changePassword} style={{ marginTop: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
              gap: 14,
            }}
          >
            <Field
              id="pw-current"
              label="Current password"
              type="password"
              value={pwd.current}
              onChange={(v) => setPwd((p) => ({ ...p, current: v }))}
            />
            <Field
              id="pw-next"
              label="New password"
              type="password"
              value={pwd.next}
              hint="At least 8 characters."
              onChange={(v) => setPwd((p) => ({ ...p, next: v }))}
            />
            <Field
              id="pw-confirm"
              label="Confirm new password"
              type="password"
              value={pwd.confirm}
              onChange={(v) => setPwd((p) => ({ ...p, confirm: v }))}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 12,
              flexWrap: 'wrap',
              marginTop: 14,
            }}
          >
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <Field
                id="pw-code"
                label="Email verification code"
                value={pwd.code}
                placeholder="6 digits"
                hint={
                  codeSent
                    ? `Sent to ${codeSent.maskedEmail} · expires in ${codeSent.expiresInMinutes} minutes`
                    : 'Request a code to continue.'
                }
                onChange={(v) => setPwd((p) => ({ ...p, code: v }))}
              />
            </div>
            <button
              type="button"
              className="pt-btn"
              style={{ marginBottom: codeSent ? 22 : 22 }}
              disabled={sendingCode}
              onClick={sendCode}
            >
              <span className="material-icons">mail</span>
              {sendingCode ? 'Sending…' : codeSent ? 'Send another code' : 'Email me a code'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              type="submit"
              className="pt-btn pt-btn--primary"
              disabled={savingPwd || !pwd.current || !pwd.next || !pwd.code}
            >
              {savingPwd ? 'Saving…' : 'Change password'}
            </button>
          </div>
        </form>
      </section>

      {/* Two-step verification */}
      <section className="pt-card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <h2 className="pt-card__title">Two-step verification</h2>
          <span className={`pt-pill ${me?.twoFactorEnabled ? 'is-active' : 'is-inactive'}`}>
            {me?.twoFactorEnabled ? 'On' : 'Off'}
          </span>
        </div>

        <p
          style={{
            margin: '6px 0 0',
            fontSize: 'var(--pt-fs-sm)',
            color: 'var(--pt-muted)',
            lineHeight: 1.6,
          }}
        >
          Asks for a 6-digit code from an authenticator app when you sign in, so your password alone
          is not enough to reach your account. Use Google Authenticator, Microsoft Authenticator or
          any similar app.
        </p>

        {/* Backup codes, shown once after enabling or regenerating */}
        {codes && (
          <div className="pt-note" style={{ marginTop: 16 }}>
            <span className="pt-note__icon">
              <span className="material-icons">vpn_key</span>
            </span>
            <span>
              <strong>Save your backup codes now</strong>
              <span>
                Each works once if you lose your phone. This is the only time they can be shown —
                only their fingerprints are stored.
              </span>
              <span
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                  gap: 6,
                  marginTop: 10,
                }}
              >
                {codes.map((c) => (
                  <code
                    key={c}
                    style={{
                      padding: '6px 8px',
                      fontSize: 'var(--pt-fs-body)',
                      fontWeight: 700,
                      letterSpacing: 1,
                      textAlign: 'center',
                      background: 'var(--pt-surface)',
                      border: '1px solid var(--pt-border)',
                      borderRadius: 8,
                    }}
                  >
                    {c}
                  </code>
                ))}
              </span>
              <span style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="pt-btn"
                  style={{ height: 36 }}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(codes.join('\n'))
                      toast.info('Copied.', { theme: 'colored', autoClose: 2000 })
                    } catch {
                      /* clipboard blocked — the codes are on screen to copy by hand */
                    }
                  }}
                >
                  Copy codes
                </button>
                <button
                  type="button"
                  className="pt-btn"
                  style={{ height: 36, marginLeft: 8 }}
                  onClick={() => setCodes(null)}
                >
                  I&apos;ve saved them
                </button>
              </span>
            </span>
          </div>
        )}

        {/* Enrolment */}
        {!me?.twoFactorEnabled && !setup && (
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="pt-btn pt-btn--primary"
              disabled={tfBusy}
              onClick={startSetup}
            >
              <span className="material-icons">qr_code_2</span>
              {tfBusy ? 'Preparing…' : 'Set up two-step verification'}
            </button>
          </div>
        )}

        {setup && (
          <div
            style={{
              display: 'flex',
              gap: 20,
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              marginTop: 16,
            }}
          >
            {setup.qrCodeDataUri && (
              <img
                src={setup.qrCodeDataUri}
                alt="Scan this QR code with your authenticator app"
                width={160}
                height={160}
                style={{
                  flex: 'none',
                  background: '#fff',
                  padding: 8,
                  border: '1px solid var(--pt-border)',
                  borderRadius: 12,
                }}
              />
            )}
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 'var(--pt-fs-sm)',
                  color: 'var(--pt-muted)',
                  lineHeight: 1.8,
                }}
              >
                <li>Open your authenticator app and scan the code.</li>
                <li>
                  Can&apos;t scan? Enter this key by hand:{' '}
                  <code style={{ fontWeight: 700, color: 'var(--pt-ink)', wordBreak: 'break-all' }}>
                    {setup.secret}
                  </code>
                </li>
                <li>Type the 6-digit code it shows, below.</li>
              </ol>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-end',
                  flexWrap: 'wrap',
                  marginTop: 14,
                }}
              >
                <div style={{ flex: '0 1 180px' }}>
                  <Field
                    id="tf-code"
                    label="Code from the app"
                    value={tfCode}
                    placeholder="6 digits"
                    onChange={setTfCode}
                  />
                </div>
                <button
                  type="button"
                  className="pt-btn pt-btn--primary"
                  disabled={tfBusy || tfCode.trim().length < 6}
                  onClick={enable}
                >
                  {tfBusy ? 'Checking…' : 'Turn on'}
                </button>
                <button
                  type="button"
                  className="pt-btn"
                  disabled={tfBusy}
                  onClick={() => setSetup(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Managing 2FA once it is on */}
        {me?.twoFactorEnabled && (
          <div style={{ marginTop: 16 }}>
            <div className="pt-tiles">
              <div className="pt-tile">
                <span className="pt-tile__k">Backup codes left</span>
                <span className="pt-tile__v">{me.recoveryCodesRemaining}</span>
                {me.recoveryCodesRemaining <= 2 && (
                  <span className="pt-tile__note" style={{ color: 'var(--pt-red-fg)' }}>
                    Running low — generate a new set
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                marginTop: 14,
              }}
            >
              <div style={{ flex: '0 1 200px' }}>
                <Field
                  id="tf-manage"
                  label="Code from the app"
                  value={tfCode}
                  placeholder="6 digits or a backup code"
                  onChange={setTfCode}
                />
              </div>
              <button
                type="button"
                className="pt-btn"
                disabled={tfBusy || !tfCode.trim()}
                onClick={newCodes}
              >
                New backup codes
              </button>
              <button
                type="button"
                className="pt-btn"
                style={{ color: 'var(--pt-red-fg)', borderColor: 'var(--pt-red-fg)' }}
                disabled={tfBusy || !tfCode.trim()}
                onClick={disable}
              >
                Turn off
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}

export default PortalProfile
