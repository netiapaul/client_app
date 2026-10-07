import React, { useState, useEffect, useCallback } from 'react'
import { getToken } from '../../utils/session'
import moment from 'moment'

const axios = require('axios')
const BASE_URL = process.env.REACT_APP_URL_CONFIG

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})
const readErr = (e) =>
  e?.response?.data?.message || e?.request?.response || `${e?.code}: ${e?.message}`

const statusBadge = (status) => {
  const map = {
    Sent: { bg: '#1e7e34', label: 'Sent' },
    Pending: { bg: '#6c757d', label: 'Pending' },
    Failed: { bg: '#c0392b', label: 'Failed' },
  }
  const s = map[status] || { bg: '#6c757d', label: status }
  return (
    <span
      style={{
        background: s.bg,
        color: '#fff',
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 3,
        fontWeight: 600,
      }}
    >
      {s.label}
    </span>
  )
}

const Emails = () => {
  const [items, setItems] = useState([])
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  // SMTP settings panel
  const emptySmtp = {
    host: '',
    port: 587,
    username: '',
    password: '',
    fromName: '',
    fromAddress: '',
    supportEmail: '',
    useSsl: true,
    ignoreSslErrors: false,
    throttleDelayMs: 0,
    enabled: true,
  }
  const [smtpOpen, setSmtpOpen] = useState(false)
  const [smtp, setSmtp] = useState(emptySmtp)
  const [smtpPasswordSet, setSmtpPasswordSet] = useState(false)
  const [smtpSaving, setSmtpSaving] = useState(false)

  const err = (e) => setError(readErr(e))
  const flash = (m) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 5000)
  }

  const openSmtp = async () => {
    setError('')
    setSmtpOpen(true)
    try {
      const r = await axios.get(`${BASE_URL}/api/Email/SmtpConfig`, { headers: authHeaders() })
      if (r.data?.exists) {
        setSmtp({
          host: r.data.host ?? '',
          port: r.data.port ?? 587,
          username: r.data.username ?? '',
          password: '', // never returned; blank = keep existing
          fromName: r.data.fromName ?? '',
          fromAddress: r.data.fromAddress ?? '',
          supportEmail: r.data.supportEmail ?? '',
          useSsl: !!r.data.useSsl,
          ignoreSslErrors: !!r.data.ignoreSslErrors,
          throttleDelayMs: r.data.throttleDelayMs ?? 0,
          enabled: !!r.data.enabled,
        })
        setSmtpPasswordSet(!!r.data.passwordSet)
      } else {
        setSmtp(emptySmtp)
        setSmtpPasswordSet(false)
      }
    } catch (e) {
      err(e)
    }
  }

  const saveSmtp = async () => {
    setSmtpSaving(true)
    setError('')
    try {
      await axios.put(
        `${BASE_URL}/api/Email/SmtpConfig`,
        {
          host: smtp.host,
          port: Number(smtp.port) || 587,
          username: smtp.username,
          password: smtp.password, // blank = backend keeps existing
          fromName: smtp.fromName,
          fromAddress: smtp.fromAddress,
          supportEmail: smtp.supportEmail,
          useSsl: smtp.useSsl,
          ignoreSslErrors: smtp.ignoreSslErrors,
          throttleDelayMs: Number(smtp.throttleDelayMs) || 0,
          enabled: smtp.enabled,
        },
        { headers: authHeaders() },
      )
      flash('SMTP settings saved.')
      setSmtpOpen(false)
      await load()
    } catch (e) {
      err(e)
    } finally {
      setSmtpSaving(false)
    }
  }

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await axios.get(`${BASE_URL}/api/Email/Queue?take=200`, { headers: authHeaders() })
      setItems(r.data?.items ?? [])
      setConfigured(r.data?.configured ?? false)
    } catch (e) {
      err(e)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sendPending = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await axios.post(
        `${BASE_URL}/api/Email/SendPending`,
        {},
        { headers: authHeaders() },
      )
      flash(`Sent ${r.data?.sent ?? 0} pending email(s).`)
      await load()
    } catch (e) {
      err(e)
    } finally {
      setBusy(false)
    }
  }

  const resend = async (id) => {
    setBusy(true)
    setError('')
    try {
      const r = await axios.post(
        `${BASE_URL}/api/Email/Resend/${id}`,
        {},
        { headers: authHeaders() },
      )
      flash(`Email #${id} requeued${r.data?.sent ? ` and sent` : ''}.`)
      await load()
    } catch (e) {
      err(e)
    } finally {
      setBusy(false)
    }
  }

  const resendFailed = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await axios.post(
        `${BASE_URL}/api/Email/ResendFailed`,
        {},
        { headers: authHeaders() },
      )
      flash(`Requeued ${r.data?.requeued ?? 0} failed, sent ${r.data?.sent ?? 0}.`)
      await load()
    } catch (e) {
      err(e)
    } finally {
      setBusy(false)
    }
  }

  // Fetch the rendered HTML (auth-protected) and show it in a new window.
  const preview = async (id) => {
    setError('')
    try {
      const r = await axios.get(`${BASE_URL}/api/Email/Preview/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const w = window.open('', '_blank')
      if (w) {
        w.document.open()
        w.document.write(r.data)
        w.document.close()
      }
    } catch (e) {
      err(e)
    }
  }

  const failedCount = items.filter((i) => i.status === 'Failed').length
  const pendingCount = items.filter((i) => i.status === 'Pending').length

  return (
    <>
      <hr className="my-2" />
      <div className="d-flex justify-content-between align-items-center">
        <h6 className="m-0">Email Tracking</h6>
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted" style={{ fontSize: 11 }}>
            {pendingCount} pending · {failedCount} failed
          </span>
          <button
            className="btn btn-sm cancel-btn rounded-0"
            onClick={load}
            disabled={busy}
            type="button"
          >
            Refresh
          </button>
          <button
            className="btn btn-sm add-btn rounded-0"
            onClick={sendPending}
            disabled={busy || !configured}
            type="button"
          >
            Send Pending
          </button>
          <button
            className="btn btn-sm add-btn rounded-0"
            onClick={resendFailed}
            disabled={busy || !configured || failedCount === 0}
            type="button"
          >
            Resend Failed ({failedCount})
          </button>
          <button
            className="btn btn-sm cancel-btn rounded-0"
            onClick={() => (smtpOpen ? setSmtpOpen(false) : openSmtp())}
            type="button"
          >
            SMTP Settings
          </button>
        </div>
      </div>
      <hr className="my-2" />

      {smtpOpen && (
        <div className="card rounded-0 mb-2">
          <div className="card-header py-2" style={{ fontSize: 13, fontWeight: 600 }}>
            SMTP Settings
          </div>
          <div className="card-body">
            <div className="row g-2" style={{ fontSize: 12 }}>
              <div className="col-md-6">
                <label className="form-label mb-0">Host</label>
                <input
                  className="form-control form-control-sm rounded-0"
                  value={smtp.host}
                  onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                  placeholder="mail.example.com"
                />
              </div>
              <div className="col-md-2">
                <label className="form-label mb-0">Port</label>
                <input
                  type="number"
                  className="form-control form-control-sm rounded-0"
                  value={smtp.port}
                  onChange={(e) => setSmtp({ ...smtp, port: e.target.value })}
                  placeholder="465 / 587"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label mb-0">Throttle (ms between sends)</label>
                <input
                  type="number"
                  className="form-control form-control-sm rounded-0"
                  value={smtp.throttleDelayMs}
                  onChange={(e) => setSmtp({ ...smtp, throttleDelayMs: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label mb-0">Username</label>
                <input
                  className="form-control form-control-sm rounded-0"
                  value={smtp.username}
                  onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                  autoComplete="off"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label mb-0">
                  Password{' '}
                  {smtpPasswordSet && (
                    <span className="text-muted" style={{ fontSize: 10 }}>
                      (set — leave blank to keep)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  className="form-control form-control-sm rounded-0"
                  value={smtp.password}
                  onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                  placeholder={smtpPasswordSet ? '••••••••' : ''}
                  autoComplete="new-password"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label mb-0">From name</label>
                <input
                  className="form-control form-control-sm rounded-0"
                  value={smtp.fromName}
                  onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label mb-0">From address</label>
                <input
                  className="form-control form-control-sm rounded-0"
                  value={smtp.fromAddress}
                  onChange={(e) => setSmtp({ ...smtp, fromAddress: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label mb-0">
                  Support email{' '}
                  <span className="text-muted" style={{ fontSize: 10 }}>
                    (new-client notifications)
                  </span>
                </label>
                <input
                  className="form-control form-control-sm rounded-0"
                  value={smtp.supportEmail}
                  onChange={(e) => setSmtp({ ...smtp, supportEmail: e.target.value })}
                />
              </div>
              <div className="col-md-12 d-flex gap-3 mt-1">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="smtpUseSsl"
                    checked={smtp.useSsl}
                    onChange={(e) => setSmtp({ ...smtp, useSsl: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="smtpUseSsl">
                    Use SSL/TLS (port 465 = implicit, 587 = STARTTLS)
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="smtpIgnoreSsl"
                    checked={smtp.ignoreSslErrors}
                    onChange={(e) => setSmtp({ ...smtp, ignoreSslErrors: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="smtpIgnoreSsl">
                    Ignore SSL certificate errors
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="smtpEnabled"
                    checked={smtp.enabled}
                    onChange={(e) => setSmtp({ ...smtp, enabled: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="smtpEnabled">
                    Enabled
                  </label>
                </div>
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button
                className="btn btn-sm add-btn rounded-0"
                onClick={saveSmtp}
                disabled={smtpSaving}
                type="button"
              >
                {smtpSaving ? 'Saving…' : 'Save Settings'}
              </button>
              <button
                className="btn btn-sm cancel-btn rounded-0"
                onClick={() => setSmtpOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {!configured && (
        <div className="alert alert-warning rounded-0 p-2" role="alert" style={{ fontSize: 12 }}>
          SMTP is not configured. Click <strong>SMTP Settings</strong> to set it. Emails are queued
          but will not be sent until it is configured.
        </div>
      )}
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

      <div className="card rounded-0">
        <div className="table-responsive">
          <table className="table table-sm table-hover mb-0" style={{ fontSize: 10 }}>
            <thead className="table-light">
              <tr>
                <th style={{ width: '1%' }}>#</th>
                <th>Type</th>
                <th>To</th>
                <th>Subject</th>
                <th>Client</th>
                <th style={{ width: '1%' }}>Status</th>
                <th style={{ width: '1%', textAlign: 'center' }}>Att.</th>
                <th>Created</th>
                <th>Sent</th>
                <th>Error</th>
                <th style={{ width: '1%' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-muted text-center py-3">
                    No emails yet.
                  </td>
                </tr>
              )}
              {items.map((e, idx) => (
                <tr
                  key={e.id}
                  onClick={() => preview(e.id)}
                  style={{ cursor: 'pointer' }}
                  title="Click to preview"
                >
                  <td>{idx + 1}</td>
                  <td>{e.emailType}</td>
                  <td>{e.toAddress}</td>
                  <td>{e.subject}</td>
                  <td>{e.relatedCusCode}</td>
                  <td>{statusBadge(e.status)}</td>
                  <td style={{ textAlign: 'center' }}>{e.attempts}</td>
                  <td>{e.createdAt ? moment(e.createdAt).format('DD/MM/YY HH:mm') : ''}</td>
                  <td>{e.sentAt ? moment(e.sentAt).format('DD/MM/YY HH:mm') : ''}</td>
                  <td style={{ maxWidth: 240, color: '#c0392b' }} title={e.errorMessage || ''}>
                    {e.errorMessage
                      ? e.errorMessage.length > 60
                        ? e.errorMessage.slice(0, 60) + '…'
                        : e.errorMessage
                      : ''}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-sm cancel-btn rounded-0 me-1"
                      style={{ fontSize: 11, padding: '1px 8px' }}
                      onClick={(ev) => {
                        ev.stopPropagation()
                        preview(e.id)
                      }}
                      type="button"
                    >
                      Preview
                    </button>
                    {e.status !== 'Sent' && (
                      <button
                        className="btn btn-sm add-btn rounded-0"
                        style={{ fontSize: 11, padding: '1px 8px' }}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          resend(e.id)
                        }}
                        disabled={busy || !configured}
                        type="button"
                      >
                        Resend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default Emails
