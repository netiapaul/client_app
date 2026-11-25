import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { toast } from 'react-toastify'
import PasswordInput from '../../components/PasswordInput'
import { getToken } from '../../utils/session'
const axios = require('axios')

/** M-PESA (Safaricom Daraja) settings. */
const BLANK = {
  environment: 'sandbox',
  consumerKey: '',
  consumerSecret: '',
  shortCode: '',
  passKey: '',
  callbackUrl: '',
  enabled: false,
  autoExtendExpiry: true,
}

const api = `${process.env.REACT_APP_URL_CONFIG}/api/Mpesa`

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})

const MpesaSettings = ({ onStatus }) => {
  const [form, setForm] = useState(BLANK)
  const [meta, setMeta] = useState(null) // what the server says is set / missing
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState(null)
  const [error, setError] = useState('')

  // The push tester. Defaulted to Safaricom's sandbox test number.
  const [pushNumber, setPushNumber] = useState('254708374149')
  const [pushing, setPushing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const [push, setPush] = useState(null)

  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setTest(null)
    try {
      const r = await axios.get(`${api}/Config`, { headers: authHeaders() })
      const c = r.data ?? {}

      setMeta(c)
      setForm({
        environment: c.environment || 'sandbox',
        consumerKey: c.consumerKey || '',
        // Never returned by the server. Blank means "keep what is stored".
        consumerSecret: '',
        shortCode: c.shortCode || '',
        passKey: '',
        callbackUrl: c.callbackUrl || '',
        enabled: !!c.enabled,
        autoExtendExpiry: !!c.autoExtendExpiry,
      })
      // What the Setup tab shows without being opened.
      if (onStatus) {
        onStatus({
          ok: !c.notReadyReason && c.enabled,
          label: c.notReadyReason
            ? 'Not set up'
            : !c.enabled
            ? 'Set up, switched off'
            : c.isSandbox
            ? 'On — sandbox'
            : 'On — production',
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
      const r = await axios.post(`${api}/Config`, form, { headers: authHeaders() })

      toast.success(r.data?.message ?? 'Saved.', { theme: 'colored', autoClose: 8000 })

      if (r.data?.callbackWarning) {
        toast.warn(r.data.callbackWarning, { theme: 'colored', autoClose: 14000 })
      }

      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  /** Send a real prompt to a real phone, for one shilling. */
  const sendPush = async () => {
    if (!pushNumber.trim()) {
      setError('Enter a phone number to prompt.')
      return
    }

    setPushing(true)
    setError('')
    setPush(null)
    try {
      const r = await axios.post(
        `${api}/TestPush`,
        { phoneNumber: pushNumber.trim(), accountReference: 'TEST' },
        { headers: authHeaders() },
      )
      setPush(r.data)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setPushing(false)
    }
  }

  /** Ask Safaricom what the customer did. */
  const checkPush = async () => {
    if (!push?.checkoutRequestId) return

    setChecking(true)
    setError('')
    try {
      const r = await axios.get(`${api}/Push/${encodeURIComponent(push.checkoutRequestId)}`, {
        headers: authHeaders(),
      })
      setPush((p) => ({ ...p, ...r.data }))
    } catch (e) {
      setError(readErr(e))
    } finally {
      setChecking(false)
    }
  }

  /** Post a made-up callback to our own handler. */
  const replay = async (resultCode) => {
    if (!push?.checkoutRequestId) return

    setReplaying(true)
    setError('')
    try {
      const r = await axios.post(
        `${api}/Callback/Replay`,
        {
          checkoutRequestId: push.checkoutRequestId,
          merchantRequestId: push.merchantRequestId,
          resultCode,
          amount: 1,
          phoneNumber: pushNumber.trim(),
        },
        { headers: authHeaders() },
      )
      setPush((p) => ({ ...p, replayed: r.data?.message }))
    } catch (e) {
      setError(readErr(e))
    } finally {
      setReplaying(false)
    }
  }

  /** Tests what is SAVED, not what is typed — so save first if the form is dirty. */
  const testConnection = async () => {
    setTesting(true)
    setError('')
    setTest(null)
    try {
      const r = await axios.post(`${api}/TestConnection`, null, { headers: authHeaders() })
      setTest({ ok: true, ...r.data })
    } catch (e) {
      setTest({
        ok: false,
        message: readErr(e),
        providerResponse: e?.response?.data?.providerResponse,
      })
    } finally {
      setTesting(false)
    }
  }

  const isProduction = form.environment === 'production'

  return (
    <div className="card rounded-0 mb-2">
      <div
        className="card-header py-2 d-flex align-items-center justify-content-between"
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        <span>
          <span className="material-icons" style={{ fontSize: 16, verticalAlign: -3 }}>
            smartphone
          </span>{' '}
          M-PESA Settings
          {meta?.updatedAt && (
            <span className="text-muted fw-normal" style={{ fontSize: 11 }}>
              {' '}
              — last changed {new Date(meta.updatedAt).toLocaleString()}
              {meta.updatedBy ? ` by ${meta.updatedBy}` : ''}
            </span>
          )}
        </span>
      </div>

      <div className="card-body">
        {loading ? (
          <div className="cb-fs-meta text-muted">Loading…</div>
        ) : (
          <>
            {error && <div className="alert alert-danger rounded-0 py-2 cb-fs-body">{error}</div>}

            {/* What is still missing, said once and at the top. */}
            {meta?.notReadyReason && (
              <div className="alert alert-warning rounded-0 py-2 cb-fs-body">
                <span className="material-icons" style={{ fontSize: 16, verticalAlign: -3 }}>
                  info
                </span>{' '}
                {meta.notReadyReason}
              </div>
            )}

            {/* The one that costs real money if ignored. */}
            {meta?.callbackWarning && (
              <div className="alert alert-danger rounded-0 py-2 cb-fs-body">
                <span className="fw-bold">Callback URL problem.</span> {meta.callbackWarning}
              </div>
            )}

            <div className="row g-2" style={{ fontSize: 12 }}>
              <div className="col-md-3">
                <label className="form-label mb-0" htmlFor="mp-env">
                  Environment
                </label>
                <select
                  id="mp-env"
                  className="form-select form-select-sm rounded-0"
                  value={form.environment}
                  onChange={(e) => set('environment', e.target.value)}
                >
                  <option value="sandbox">Sandbox (nothing real)</option>
                  <option value="production">Production (real money)</option>
                </select>
                <span className="text-muted" style={{ fontSize: 10 }}>
                  Sandbox and production have separate credentials — keys are not interchangeable.
                </span>
              </div>

              <div className="col-md-3">
                <label className="form-label mb-0" htmlFor="mp-short">
                  Shortcode
                </label>
                <input
                  id="mp-short"
                  className="form-control form-control-sm rounded-0"
                  value={form.shortCode}
                  onChange={(e) => set('shortCode', e.target.value)}
                  placeholder="174379"
                  autoComplete="off"
                />
                <span className="text-muted" style={{ fontSize: 10 }}>
                  The paybill or till number customers pay into.
                </span>
              </div>

              <div className="col-md-6">
                <label className="form-label mb-0" htmlFor="mp-key">
                  Consumer key
                </label>
                <input
                  id="mp-key"
                  className="form-control form-control-sm rounded-0"
                  value={form.consumerKey}
                  onChange={(e) => set('consumerKey', e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                />
                <span className="text-muted" style={{ fontSize: 10 }}>
                  From your app on developer.safaricom.co.ke.
                </span>
              </div>

              <div className="col-md-6">
                <label className="form-label mb-0" htmlFor="mp-secret">
                  Consumer secret{' '}
                  {meta?.hasConsumerSecret && (
                    <span className="text-muted" style={{ fontSize: 10 }}>
                      (set — leave blank to keep)
                    </span>
                  )}
                </label>
                <PasswordInput
                  id="mp-secret"
                  className="form-control form-control-sm rounded-0"
                  value={form.consumerSecret}
                  onChange={(e) => set('consumerSecret', e.target.value)}
                  placeholder={meta?.hasConsumerSecret ? '••••••••' : ''}
                  autoComplete="new-password"
                />
              </div>

              <div className="col-md-6">
                <label className="form-label mb-0" htmlFor="mp-passkey">
                  Lipa na M-PESA passkey{' '}
                  {meta?.hasPassKey && (
                    <span className="text-muted" style={{ fontSize: 10 }}>
                      (set — leave blank to keep)
                    </span>
                  )}
                </label>
                <PasswordInput
                  id="mp-passkey"
                  className="form-control form-control-sm rounded-0"
                  value={form.passKey}
                  onChange={(e) => set('passKey', e.target.value)}
                  placeholder={meta?.hasPassKey ? '••••••••' : ''}
                  autoComplete="new-password"
                />
                <span className="text-muted" style={{ fontSize: 10 }}>
                  Signs the payment request sent to a customer&apos;s phone. Required to collect.
                </span>
              </div>

              <div className="col-md-12">
                <label className="form-label mb-0" htmlFor="mp-callback">
                  Callback URL
                </label>
                <input
                  id="mp-callback"
                  className="form-control form-control-sm rounded-0"
                  value={form.callbackUrl}
                  onChange={(e) => set('callbackUrl', e.target.value)}
                  placeholder="https://phamacoredev.co.ke:92/api/Mpesa/Callback"
                  autoComplete="off"
                  spellCheck="false"
                />
                <span className="text-muted" style={{ fontSize: 10 }}>
                  Where Safaricom posts the confirmation. Must be a PUBLIC https address they can
                  reach — not localhost, and not an internal name.
                </span>
              </div>

              <div className="col-md-6">
                <div className="form-check mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="mp-enabled"
                    checked={form.enabled}
                    onChange={(e) => set('enabled', e.target.checked)}
                  />
                  <label className="form-check-label cb-fs-body" htmlFor="mp-enabled">
                    Collect payments by M-PESA
                    <span className="d-block text-muted" style={{ fontSize: 10 }}>
                      Off means nothing is collected and no callback is honoured. Payments already
                      recorded stay recorded — this is a stop button, not an instruction to forget.
                    </span>
                  </label>
                </div>
              </div>

              <div className="col-md-6">
                <div className="form-check mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="mp-autoexpiry"
                    checked={form.autoExtendExpiry}
                    onChange={(e) => set('autoExtendExpiry', e.target.checked)}
                  />
                  <label className="form-check-label cb-fs-body" htmlFor="mp-autoexpiry">
                    Extend licence expiry automatically
                    <span className="d-block text-muted" style={{ fontSize: 10 }}>
                      A confirmed payment moves the expiry with no approval step. This is the one
                      switch that bypasses the maker-checker gate expiry changes otherwise go
                      through; every extension still writes its own audit entry.
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Enabling against production is the consequential edit on this screen. */}
            {form.enabled && isProduction && (
              <div className="alert alert-danger rounded-0 py-2 cb-fs-body mt-2 mb-0">
                <span className="fw-bold">This will collect real money.</span> Production M-PESA
                with collection on means customer payments are taken live and licence expiry moves
                on confirmation.
              </div>
            )}

            {/* The connection test result. */}
            {test && (
              <div
                className={`alert rounded-0 py-2 cb-fs-body mt-2 mb-0 ${
                  test.ok ? (test.isSandbox ? 'alert-warning' : 'alert-success') : 'alert-danger'
                }`}
              >
                <span className="material-icons" style={{ fontSize: 16, verticalAlign: -3 }}>
                  {test.ok ? 'check_circle' : 'error_outline'}
                </span>{' '}
                {test.message}
                {test.providerResponse && (
                  <code
                    className="d-block mt-1 text-muted"
                    style={{ fontSize: 10, wordBreak: 'break-all' }}
                  >
                    {test.providerResponse}
                  </code>
                )}
              </div>
            )}

            {/* ---- the push tester ---- */}
            {meta?.hasPassKey && !meta?.notReadyReason && (
              <div className="mt-3 pt-2 border-top">
                <label className="cb-fs-meta text-muted d-block mb-1">Test a payment request</label>
                <p className="cb-fs-meta text-muted">
                  Sends a real prompt for <strong>one shilling</strong>.{' '}
                  {form.environment === 'sandbox' ? (
                    <>
                      <code>254708374149</code> is Safaricom&apos;s sandbox test number — it accepts
                      instantly and rings nobody. Any other number gets an actual M-PESA prompt.
                    </>
                  ) : (
                    <span className="text-danger fw-bold">
                      This is PRODUCTION — a real prompt will reach that phone and take real money.
                    </span>
                  )}
                </p>

                <div className="d-flex flex-wrap align-items-end gap-1">
                  <label className="cb-fs-meta text-muted mb-0" htmlFor="mp-pushnum">
                    <span className="d-block mb-1">Phone number</span>
                    <input
                      id="mp-pushnum"
                      type="tel"
                      className="form-control form-control-sm rounded-0"
                      style={{ width: 180 }}
                      value={pushNumber}
                      onChange={(e) => setPushNumber(e.target.value)}
                    />
                  </label>

                  <button
                    type="button"
                    className="btn btn-sm filter-btn rounded-0"
                    disabled={pushing || saving}
                    onClick={sendPush}
                  >
                    {pushing ? 'Sending…' : 'Send test push'}
                  </button>

                  {push?.checkoutRequestId && (
                    <button
                      type="button"
                      className="btn btn-sm filter-btn rounded-0"
                      disabled={checking}
                      title="Asks Safaricom what the customer did. Needs no public URL — this is how a push is tested from a machine Safaricom cannot reach."
                      onClick={checkPush}
                    >
                      {checking ? 'Checking…' : 'Check result'}
                    </button>
                  )}
                </div>

                {push && (
                  <div
                    className={`alert rounded-0 py-2 cb-fs-body mt-2 mb-0 ${
                      push.settled && push.ok
                        ? 'alert-success'
                        : push.settled
                        ? 'alert-danger'
                        : 'alert-info'
                    }`}
                  >
                    {push.message}
                    {push.checkoutRequestId && (
                      <code
                        className="d-block mt-1 text-muted"
                        style={{ fontSize: 10, wordBreak: 'break-all' }}
                      >
                        {push.checkoutRequestId}
                      </code>
                    )}
                    {push.callbackWarning && (
                      <span className="d-block mt-1 cb-fs-meta">{push.callbackWarning}</span>
                    )}

                    {/* The fake callback. */}
                    {push.checkoutRequestId && (
                      <div className="d-flex flex-wrap gap-1 mt-2 pt-2 border-top">
                        <span className="cb-fs-meta text-muted align-self-center me-1">
                          Or post a callback to ourselves:
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm add-btn rounded-0"
                          disabled={replaying}
                          onClick={() => replay(0)}
                        >
                          Paid
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm delete-btn rounded-0"
                          disabled={replaying}
                          onClick={() => replay(1032)}
                        >
                          Cancelled (1032)
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm delete-btn rounded-0"
                          disabled={replaying}
                          onClick={() => replay(1)}
                        >
                          No funds (1)
                        </button>
                      </div>
                    )}

                    {push.replayed && <span className="d-block mt-2 fw-bold">{push.replayed}</span>}
                  </div>
                )}
              </div>
            )}

            <div className="d-flex flex-wrap gap-1 mt-3 pt-2 border-top">
              <button
                type="button"
                className="btn btn-sm add-btn rounded-0"
                disabled={saving}
                onClick={save}
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>

              <button
                type="button"
                className="btn btn-sm filter-btn rounded-0"
                disabled={testing || saving || !meta?.hasConsumerSecret}
                title={
                  meta?.hasConsumerSecret
                    ? 'Asks Safaricom for an access token with the SAVED credentials. Takes no money.'
                    : 'Save a consumer key and secret first'
                }
                onClick={testConnection}
              >
                {testing ? 'Testing…' : 'Test connection'}
              </button>

              <span className="cb-fs-meta text-muted ms-auto align-self-center">
                Tests the SAVED credentials — save first if you have just edited them.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

MpesaSettings.propTypes = {
  /** Reports configured/not to the Setup tab, so the state is visible without opening it. */
  onStatus: PropTypes.func,
}

export default MpesaSettings
