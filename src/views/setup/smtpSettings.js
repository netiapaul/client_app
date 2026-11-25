import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { toast } from 'react-toastify'
import PasswordInput from '../../components/PasswordInput'
import { getToken } from '../../utils/session'
const axios = require('axios')

/** The outgoing mail server. */
const BLANK = {
  host: '',
  port: 587,
  username: '',
  password: '',
  fromName: '',
  fromAddress: '',
  supportEmail: '',
  bccAddresses: '',
  useSsl: true,
  ignoreSslErrors: false,
  throttleDelayMs: 0,
  enabled: true,
}

const api = `${process.env.REACT_APP_URL_CONFIG}/api/Email`

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})

const SmtpSettings = ({ onStatus }) => {
  const [form, setForm] = useState(BLANK)
  const [passwordSet, setPasswordSet] = useState(false)
  const [exists, setExists] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await axios.get(`${api}/SmtpConfig`, { headers: authHeaders() })
      const c = r.data ?? {}

      setExists(!!c.exists)

      if (c.exists) {
        setForm({
          host: c.host ?? '',
          port: c.port ?? 587,
          username: c.username ?? '',
          password: '', // never returned; blank = keep existing
          fromName: c.fromName ?? '',
          fromAddress: c.fromAddress ?? '',
          supportEmail: c.supportEmail ?? '',
          bccAddresses: c.bccAddresses ?? '',
          useSsl: !!c.useSsl,
          ignoreSslErrors: !!c.ignoreSslErrors,
          throttleDelayMs: c.throttleDelayMs ?? 0,
          enabled: !!c.enabled,
        })
        setPasswordSet(!!c.passwordSet)
      } else {
        setForm(BLANK)
        setPasswordSet(false)
      }

      // "Off" and "not set up" are different states.
      if (onStatus) {
        const configured = !!c.exists && !!c.host && !!c.passwordSet
        onStatus({
          ok: configured && !!c.enabled,
          label: !c.exists
            ? 'Not set up'
            : !configured
            ? 'Incomplete'
            : !c.enabled
            ? 'Set up, switched off'
            : `On — ${c.host}`,
        })
      }
    } catch (e) {
      setError(readErr(e))
      if (onStatus) onStatus({ ok: false, label: 'Could not load' })
    } finally {
      setLoading(false)
    }
  }, [onStatus])

  useEffect(() => {
    load()
  }, [load])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await axios.put(
        `${api}/SmtpConfig`,
        {
          host: form.host,
          port: Number(form.port) || 587,
          username: form.username,
          password: form.password, // blank = backend keeps existing
          fromName: form.fromName,
          fromAddress: form.fromAddress,
          supportEmail: form.supportEmail,
          bccAddresses: form.bccAddresses,
          useSsl: form.useSsl,
          ignoreSslErrors: form.ignoreSslErrors,
          throttleDelayMs: Number(form.throttleDelayMs) || 0,
          enabled: form.enabled,
        },
        { headers: authHeaders() },
      )

      toast.success('SMTP settings saved.', { theme: 'colored', autoClose: 5000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card rounded-0 mb-2">
      <div className="card-header py-2" style={{ fontSize: 13, fontWeight: 600 }}>
        <span className="material-icons" style={{ fontSize: 16, verticalAlign: -3 }}>
          email
        </span>{' '}
        Outgoing mail server
      </div>

      <div className="card-body">
        {loading ? (
          <div className="cb-fs-meta text-muted">Loading…</div>
        ) : (
          <>
            {error && <div className="alert alert-danger rounded-0 py-2 cb-fs-body">{error}</div>}

            {!exists && (
              <div className="alert alert-warning rounded-0 py-2 cb-fs-body">
                SMTP is not configured. New emails are stored as <strong>Failed</strong> until it is
                — once set up, use <strong>Resend Failed</strong> on the Emails screen to send them.
              </div>
            )}

            <div className="row g-2" style={{ fontSize: 12 }}>
              <div className="col-md-6">
                <label className="form-label mb-0" htmlFor="smtp-host">
                  Host
                </label>
                <input
                  id="smtp-host"
                  className="form-control form-control-sm rounded-0"
                  value={form.host}
                  onChange={(e) => set('host', e.target.value)}
                  placeholder="mail.example.com"
                />
              </div>

              <div className="col-md-2">
                <label className="form-label mb-0" htmlFor="smtp-port">
                  Port
                </label>
                <input
                  id="smtp-port"
                  type="number"
                  className="form-control form-control-sm rounded-0"
                  value={form.port}
                  onChange={(e) => set('port', e.target.value)}
                  placeholder="465 / 587"
                />
              </div>

              <div className="col-md-4">
                <label className="form-label mb-0" htmlFor="smtp-throttle">
                  Throttle (ms between sends)
                </label>
                <input
                  id="smtp-throttle"
                  type="number"
                  className="form-control form-control-sm rounded-0"
                  value={form.throttleDelayMs}
                  onChange={(e) => set('throttleDelayMs', e.target.value)}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label mb-0" htmlFor="smtp-user">
                  Username
                </label>
                <input
                  id="smtp-user"
                  className="form-control form-control-sm rounded-0"
                  value={form.username}
                  onChange={(e) => set('username', e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="col-md-6">
                <label className="form-label mb-0" htmlFor="smtp-pass">
                  Password{' '}
                  {passwordSet && (
                    <span className="text-muted" style={{ fontSize: 10 }}>
                      (set — leave blank to keep)
                    </span>
                  )}
                </label>
                <PasswordInput
                  id="smtp-pass"
                  className="form-control form-control-sm rounded-0"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder={passwordSet ? '••••••••' : ''}
                  autoComplete="new-password"
                />
              </div>

              <div className="col-md-6">
                <label className="form-label mb-0" htmlFor="smtp-fromname">
                  From name
                </label>
                <input
                  id="smtp-fromname"
                  className="form-control form-control-sm rounded-0"
                  value={form.fromName}
                  onChange={(e) => set('fromName', e.target.value)}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label mb-0" htmlFor="smtp-fromaddr">
                  From address
                </label>
                <input
                  id="smtp-fromaddr"
                  className="form-control form-control-sm rounded-0"
                  value={form.fromAddress}
                  onChange={(e) => set('fromAddress', e.target.value)}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label mb-0" htmlFor="smtp-support">
                  Support email{' '}
                  <span className="text-muted" style={{ fontSize: 10 }}>
                    (new-client notifications)
                  </span>
                </label>
                <input
                  id="smtp-support"
                  className="form-control form-control-sm rounded-0"
                  value={form.supportEmail}
                  onChange={(e) => set('supportEmail', e.target.value)}
                />
              </div>

              <div className="col-md-12">
                <label className="form-label mb-0" htmlFor="smtp-bcc">
                  BCC addresses{' '}
                  <span className="text-muted" style={{ fontSize: 10 }}>
                    (copied on every outbound email — separate with commas or semicolons)
                  </span>
                </label>
                <input
                  id="smtp-bcc"
                  className="form-control form-control-sm rounded-0"
                  value={form.bccAddresses}
                  onChange={(e) => set('bccAddresses', e.target.value)}
                  placeholder="admin@corebase.co.ke; records@corebase.co.ke"
                />
              </div>

              <div className="col-md-12 d-flex flex-wrap gap-3 mt-1">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="smtp-ssl"
                    checked={form.useSsl}
                    onChange={(e) => set('useSsl', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="smtp-ssl">
                    Use SSL/TLS (port 465 = implicit, 587 = STARTTLS)
                  </label>
                </div>

                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="smtp-ignoressl"
                    checked={form.ignoreSslErrors}
                    onChange={(e) => set('ignoreSslErrors', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="smtp-ignoressl">
                    Ignore SSL certificate errors
                  </label>
                </div>

                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="smtp-enabled"
                    checked={form.enabled}
                    onChange={(e) => set('enabled', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="smtp-enabled">
                    Enabled
                  </label>
                </div>
              </div>
            </div>

            <div className="d-flex gap-2 mt-3 pt-2 border-top">
              <button
                className="btn btn-sm add-btn rounded-0"
                onClick={save}
                disabled={saving}
                type="button"
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

SmtpSettings.propTypes = {
  /** Reports configured/not to the Setup tab, so the state is visible without opening it. */
  onStatus: PropTypes.func,
}

export default SmtpSettings
