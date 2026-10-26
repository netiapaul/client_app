import React, { useState, useEffect, useCallback } from 'react'
import { getToken } from '../../utils/session'

const axios = require('axios')
const BASE_URL = process.env.REACT_APP_URL_CONFIG

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})
const readErr = (e) =>
  e?.response?.data?.message || e?.request?.response || `${e?.code}: ${e?.message}`

// Google Authenticator (TOTP) enrollment + management, embedded in the user's profile.
const TwoFactorSettings = () => {
  const [enabled, setEnabled] = useState(false)
  const [recoveryRemaining, setRecoveryRemaining] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  // 'idle' = show status; 'setup' = enrolling (QR shown); 'codes' = showing one-time backup codes.
  const [mode, setMode] = useState('idle')
  const [setup, setSetup] = useState(null) // { secret, otpAuthUri, qrCodeDataUri }
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState([])

  const err = (e) => setError(readErr(e))
  const flash = (m) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 6000)
  }

  const loadStatus = useCallback(async () => {
    setError('')
    try {
      const r = await axios.get(`${BASE_URL}/api/TwoFactor/Status`, { headers: authHeaders() })
      setEnabled(!!r.data?.enabled)
      setRecoveryRemaining(r.data?.recoveryCodesRemaining ?? 0)
    } catch (e) {
      err(e)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const beginSetup = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await axios.post(`${BASE_URL}/api/TwoFactor/Setup`, {}, { headers: authHeaders() })
      setSetup(r.data)
      setCode('')
      setMode('setup')
    } catch (e) {
      err(e)
    } finally {
      setBusy(false)
    }
  }

  const confirmEnable = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await axios.post(
        `${BASE_URL}/api/TwoFactor/Enable`,
        { code },
        { headers: authHeaders() },
      )
      setRecoveryCodes(r.data?.recoveryCodes ?? [])
      setSetup(null)
      setCode('')
      setMode('codes')
      flash('Two-factor authentication is now on.')
      await loadStatus()
    } catch (e) {
      err(e)
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    const entered = window.prompt(
      'Enter a current authenticator code (or a backup code) to turn 2FA off:',
    )
    if (!entered) return
    setBusy(true)
    setError('')
    try {
      await axios.post(
        `${BASE_URL}/api/TwoFactor/Disable`,
        { code: entered.trim() },
        { headers: authHeaders() },
      )
      flash('Two-factor authentication has been turned off.')
      setMode('idle')
      await loadStatus()
    } catch (e) {
      err(e)
    } finally {
      setBusy(false)
    }
  }

  const regenerate = async () => {
    const entered = window.prompt(
      'Enter a current authenticator code to generate new backup codes:',
    )
    if (!entered) return
    setBusy(true)
    setError('')
    try {
      const r = await axios.post(
        `${BASE_URL}/api/TwoFactor/RecoveryCodes`,
        { code: entered.trim() },
        { headers: authHeaders() },
      )
      setRecoveryCodes(r.data?.recoveryCodes ?? [])
      setMode('codes')
      flash('New backup codes generated. Your old codes no longer work.')
      await loadStatus()
    } catch (e) {
      err(e)
    } finally {
      setBusy(false)
    }
  }

  const copyCodes = () => {
    navigator.clipboard?.writeText(recoveryCodes.join('\n'))
    flash('Backup codes copied to clipboard.')
  }

  return (
    <div className="card rounded-0">
      <div className="card-header py-2 d-flex justify-content-between align-items-center">
        <span style={{ fontSize: 13, fontWeight: 600 }}>Two-Factor Authentication</span>
        <span
          style={{
            background: enabled ? '#2eb85c' : '#6c757d',
            color: '#fff',
            fontSize: 11,
            padding: '2px 10px',
            borderRadius: 3,
            fontWeight: 600,
          }}
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <div className="card-body" style={{ fontSize: 13 }}>
        {error && (
          <div className="alert alert-danger rounded-0 p-2" role="alert" style={{ fontSize: 12 }}>
            {error}
          </div>
        )}
        {msg && (
          <div className="alert alert-success rounded-0 p-2" role="alert" style={{ fontSize: 12 }}>
            {msg}
          </div>
        )}

        {/* IDLE — status + actions */}
        {mode === 'idle' &&
          (!enabled ? (
            <>
              <p className="mb-2">
                Protect your account with an authenticator app (Google Authenticator, Microsoft
                Authenticator, Authy…). After signing in with your password you&apos;ll be asked for
                a 6-digit code from the app.
              </p>
              <button
                className="btn btn-sm add-btn rounded-0"
                onClick={beginSetup}
                disabled={busy}
                type="button"
              >
                {busy ? 'Starting…' : 'Enable Google Authenticator'}
              </button>
            </>
          ) : (
            <>
              <p className="mb-2">
                Two-factor authentication is <strong>on</strong>. You&apos;ll enter a code from your
                authenticator app each time you sign in.
              </p>
              <p className="text-muted mb-3" style={{ fontSize: 12 }}>
                Backup codes remaining: <strong>{recoveryRemaining}</strong>
              </p>
              <button
                className="btn btn-sm cancel-btn rounded-0 me-2"
                onClick={regenerate}
                disabled={busy}
                type="button"
              >
                Regenerate backup codes
              </button>
              <button
                className="btn btn-sm delete-btn rounded-0"
                onClick={disable}
                disabled={busy}
                type="button"
              >
                Disable 2FA
              </button>
            </>
          ))}

        {/* SETUP — scan QR + verify a code */}
        {mode === 'setup' && setup && (
          <div className="row g-3 align-items-start">
            <div className="col-md-auto text-center">
              <img
                src={setup.qrCodeDataUri}
                alt="Authenticator QR code"
                style={{
                  width: 180,
                  height: 180,
                  border: '1px solid var(--cui-border-color, #e6e8ec)',
                  background: '#fff',
                }}
              />
            </div>
            <div className="col-md">
              <ol className="ps-3 mb-2" style={{ fontSize: 12 }}>
                <li>Open your authenticator app and scan this QR code.</li>
                <li>
                  Or enter this key manually:
                  <div
                    className="mt-1 p-2"
                    style={{
                      background: 'var(--cui-secondary-bg, #f6f8fa)',
                      border: '1px solid var(--cui-border-color, #e6e8ec)',
                      color: 'var(--cui-body-color, #22304a)',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                    }}
                  >
                    {setup.secret}
                  </div>
                </li>
                <li className="mt-2">Enter the 6-digit code it shows to finish.</li>
              </ol>
              <div className="d-flex gap-2 align-items-center mt-2" style={{ maxWidth: 320 }}>
                <input
                  className="form-control form-control-sm rounded-0"
                  placeholder="123456"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
                  className="btn btn-sm add-btn rounded-0"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={confirmEnable}
                  disabled={busy || code.trim().length < 6}
                  type="button"
                >
                  {busy ? 'Verifying…' : 'Verify & Enable'}
                </button>
              </div>
              <button
                className="btn btn-sm cancel-btn rounded-0 mt-2"
                onClick={() => {
                  setMode('idle')
                  setSetup(null)
                  setCode('')
                }}
                disabled={busy}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* CODES — one-time backup codes, shown once */}
        {mode === 'codes' && (
          <>
            <p className="mb-2">
              Each code works once. Keep them somewhere safe — they let you sign in if you lose your
              phone. <strong>They won&apos;t be shown again.</strong>
            </p>
            <div
              className="p-3 mb-3"
              style={{
                background: 'var(--cui-secondary-bg, #f6f8fa)',
                border: '1px solid var(--cui-border-color, #e6e8ec)',
                color: 'var(--cui-body-color, #22304a)',
                fontFamily: 'monospace',
                columnCount: 2,
                maxWidth: 360,
              }}
            >
              {recoveryCodes.map((c) => (
                <div key={c}>{c}</div>
              ))}
            </div>
            <button
              className="btn btn-sm cancel-btn rounded-0 me-2"
              onClick={copyCodes}
              type="button"
            >
              Copy codes
            </button>
            <button
              className="btn btn-sm add-btn rounded-0"
              onClick={() => setMode('idle')}
              type="button"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default TwoFactorSettings
