import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { toast } from 'react-toastify'
import PasswordInput from '../../components/PasswordInput'
import { getToken } from '../../utils/session'
const axios = require('axios')

/**
 * Main system integration settings.
 *
 * This REPLACES the old M-PESA settings panel. The Safaricom consumer key, secret, passkey and
 * shortcode now live on the main system, which is the only thing that talks to Daraja — what is
 * left on our side is an address and two keys.
 *
 * The M-PESA test tools at the bottom still point at `api/Mpesa`, which kept them: sending a
 * prompt and asking what happened to it are things an operator still does, and those endpoints
 * were retargeted at the main system rather than removed.
 */
const BLANK = {
  baseUrl: '',
  apiKey: '',
  inboundKey: '',
  callbackBaseUrl: '',
  timeoutSeconds: 30,
  enabled: false,
  autoExtendExpiry: true,
}

const api = `${process.env.REACT_APP_URL_CONFIG}/api/MainSystem`
const mpesaApi = `${process.env.REACT_APP_URL_CONFIG}/api/Mpesa`

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})

/** Copy-to-clipboard that degrades to selecting the text when the API is unavailable. */
const copy = async (text, what) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied.`, { theme: 'colored', autoClose: 2500 })
  } catch {
    toast.info('Select the address and copy it manually.', { theme: 'colored' })
  }
}

const MainSystemSettings = ({ onStatus }) => {
  const [form, setForm] = useState(BLANK)
  const [meta, setMeta] = useState(null) // what the server says is set / missing
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState(null)
  const [error, setError] = useState('')

  // The push tester.
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
        baseUrl: c.baseUrl || '',
        // Neither key is ever returned. Blank means "keep what is stored".
        apiKey: '',
        inboundKey: '',
        callbackBaseUrl: c.callbackBaseUrl || '',
        timeoutSeconds: c.timeoutSeconds || 30,
        enabled: !!c.enabled,
        autoExtendExpiry: !!c.autoExtendExpiry,
      })

      // What the Setup tab shows without being opened.
      if (onStatus) {
        onStatus({
          ok: !c.notReadyReason && c.enabled,
          label: c.notReadyReason ? (c.enabled ? 'Incomplete' : 'Not set up') : 'On',
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

      if (r.data?.warning) {
        toast.warn(r.data.warning, { theme: 'colored', autoClose: 14000 })
      }

      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  /** Proves the address and the outbound key. Takes no money and creates nothing. */
  const testConnection = async () => {
    setTesting(true)
    setError('')
    setTest(null)
    try {
      const r = await axios.post(`${api}/TestConnection`, null, { headers: authHeaders() })
      setTest({ ok: true, ...r.data })
    } catch (e) {
      setTest({ ok: false, message: readErr(e), raw: e?.response?.data?.raw })
    } finally {
      setTesting(false)
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
        `${mpesaApi}/TestPush`,
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

  /** Ask what the customer did, rather than waiting to be told. */
  const checkPush = async () => {
    if (!push?.checkoutRequestId) return

    setChecking(true)
    setError('')
    try {
      const r = await axios.get(`${mpesaApi}/Push/${encodeURIComponent(push.checkoutRequestId)}`, {
        headers: authHeaders(),
      })
      setPush((p) => ({ ...p, ...r.data }))
    } catch (e) {
      setError(readErr(e))
    } finally {
      setChecking(false)
    }
  }

  /** Post a made-up confirmation to our own handler. */
  const replay = async (resultCode) => {
    if (!push?.checkoutRequestId) return

    setReplaying(true)
    setError('')
    try {
      const r = await axios.post(
        `${mpesaApi}/Callback/Replay`,
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

  /** A callback address the main system has to be given, with a copy button. */
  const CallbackRow = ({ label, url, help }) => (
    <div className="col-12 mb-1">
      <label className="form-label mb-0">{label}</label>
      <div className="d-flex gap-1">
        <input
          className="form-control form-control-sm rounded-0 bg-light"
          value={url || ''}
          readOnly
          onFocus={(e) => e.target.select()}
          placeholder="Set a callback address below, or Approval:PublicApiBaseUrl"
        />
        <button
          type="button"
          className="btn btn-sm filter-btn rounded-0"
          disabled={!url}
          onClick={() => copy(url, label)}
        >
          Copy
        </button>
      </div>
      <span className="text-muted" style={{ fontSize: 10 }}>
        {help}
      </span>
    </div>
  )

  CallbackRow.propTypes = {
    label: PropTypes.string.isRequired,
    url: PropTypes.string,
    help: PropTypes.string,
  }

  return (
    <div className="card rounded-0 mb-2">
      <div
        className="card-header py-2 d-flex align-items-center justify-content-between"
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        <span>
          <span className="material-icons" style={{ fontSize: 16, verticalAlign: -3 }}>
            hub
          </span>{' '}
          Main System Integration
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

            <p className="cb-fs-meta text-muted">
              The main system raises the tax invoices and holds the M-PESA credentials. This system
              pushes proformas and payments to it, and receives tax invoices and payment
              confirmations back.
            </p>

            <div className="row g-2" style={{ fontSize: 12 }}>
              <div className="col-md-8">
                <label className="form-label mb-0" htmlFor="ms-url">
                  Main system address
                </label>
                <input
                  id="ms-url"
                  className="form-control form-control-sm rounded-0"
                  value={form.baseUrl}
                  onChange={(e) => set('baseUrl', e.target.value)}
                  placeholder="https://main.corebase.co.ke"
                  autoComplete="off"
                  spellCheck="false"
                />
                <span className="text-muted" style={{ fontSize: 10 }}>
                  The root of their API. Paths are appended to it.
                </span>
              </div>

              <div className="col-md-4">
                <label className="form-label mb-0" htmlFor="ms-timeout">
                  Timeout (seconds)
                </label>
                <input
                  id="ms-timeout"
                  type="number"
                  min="5"
                  max="600"
                  className="form-control form-control-sm rounded-0"
                  value={form.timeoutSeconds}
                  onChange={(e) => set('timeoutSeconds', Number(e.target.value))}
                />
                <span className="text-muted" style={{ fontSize: 10 }}>
                  Short is fine — the queue retries.
                </span>
              </div>

              <div className="col-md-6">
                <label className="form-label mb-0" htmlFor="ms-apikey">
                  Outbound key — what we SEND{' '}
                  {meta?.hasApiKey && (
                    <span className="text-muted" style={{ fontSize: 10 }}>
                      (set — leave blank to keep)
                    </span>
                  )}
                </label>
                <PasswordInput
                  id="ms-apikey"
                  className="form-control form-control-sm rounded-0"
                  value={form.apiKey}
                  onChange={(e) => set('apiKey', e.target.value)}
                  placeholder={meta?.hasApiKey ? '••••••••' : ''}
                  autoComplete="new-password"
                />
                <span className="text-muted" style={{ fontSize: 10 }}>
                  Issued to us by the main system team.
                </span>
              </div>

              <div className="col-md-6">
                <label className="form-label mb-0" htmlFor="ms-inkey">
                  Inbound key — what we REQUIRE{' '}
                  {meta?.hasInboundKey && (
                    <span className="text-muted" style={{ fontSize: 10 }}>
                      (set — leave blank to keep)
                    </span>
                  )}
                </label>
                <PasswordInput
                  id="ms-inkey"
                  className="form-control form-control-sm rounded-0"
                  value={form.inboundKey}
                  onChange={(e) => set('inboundKey', e.target.value)}
                  placeholder={meta?.hasInboundKey ? '••••••••' : ''}
                  autoComplete="new-password"
                />
                <span className="text-muted" style={{ fontSize: 10 }}>
                  Invent one and give it to them. It must NOT be the same as the outbound key.
                </span>
              </div>

              <div className="col-md-8">
                <label className="form-label mb-0" htmlFor="ms-cb">
                  Callback address for this server
                </label>
                <input
                  id="ms-cb"
                  className="form-control form-control-sm rounded-0"
                  value={form.callbackBaseUrl}
                  onChange={(e) => set('callbackBaseUrl', e.target.value)}
                  placeholder="https://phamacoredev.co.ke:92"
                  autoComplete="off"
                  spellCheck="false"
                />
                <span className="text-muted" style={{ fontSize: 10 }}>
                  Where the MAIN SYSTEM reaches us. May be a private address if it is on this
                  network. Blank falls back to Approval:PublicApiBaseUrl.
                </span>
              </div>
            </div>

            {/* The two addresses the main system team has to be given. */}
            <div className="mt-3 pt-2 border-top">
              <label className="cb-fs-meta text-muted d-block mb-1">
                Give these to the main system team
              </label>
              <div className="row g-2" style={{ fontSize: 12 }}>
                <CallbackRow
                  label="Tax invoice callback"
                  url={meta?.finalInvoiceCallbackUrl}
                  help="Where they post the tax invoice they raised for one of our proformas."
                />
                <CallbackRow
                  label="M-PESA confirmation callback"
                  url={meta?.mpesaConfirmationCallbackUrl}
                  help="Where they post payment confirmations. Without it a customer can be charged and never credited."
                />
              </div>
              <span className="cb-fs-meta text-muted">
                They also need the <strong>inbound key</strong> — it is not shown here once saved,
                so keep your own copy when you set it.
              </span>
            </div>

            <div className="row g-2 mt-1" style={{ fontSize: 12 }}>
              <div className="col-md-6">
                <div className="form-check">
                  <input
                    id="ms-enabled"
                    className="form-check-input"
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => set('enabled', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="ms-enabled">
                    Integration on
                  </label>
                </div>
                <span className="text-muted" style={{ fontSize: 10 }}>
                  Off means nothing is pushed and nothing inbound is honoured. Proformas and
                  payments are still recorded and queue up until it is switched on.
                </span>
              </div>

              <div className="col-md-6">
                <div className="form-check">
                  <input
                    id="ms-autoext"
                    className="form-check-input"
                    type="checkbox"
                    checked={form.autoExtendExpiry}
                    onChange={(e) => set('autoExtendExpiry', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="ms-autoext">
                    Move licence expiry automatically
                  </label>
                </div>
                <span className="text-muted" style={{ fontSize: 10 }}>
                  Carried over from the old M-PESA settings. Note that nothing currently reads this
                  — expiry already moves on every confirmed payment.
                </span>
              </div>
            </div>

            {/* Switching it on is the consequential edit on this screen. */}
            {form.enabled && (
              <div className="alert alert-warning rounded-0 py-2 cb-fs-body mt-2 mb-0">
                <span className="fw-bold">This starts pushing live documents.</span> Issued
                proformas and confirmed payments will be sent to the main system, and tax invoices
                it sends back will be emailed to clients.
              </div>
            )}

            {/* The connection test result. */}
            {test && (
              <div
                className={`alert rounded-0 py-2 cb-fs-body mt-2 mb-0 ${
                  test.ok ? 'alert-success' : 'alert-danger'
                }`}
              >
                <span className="material-icons" style={{ fontSize: 16, verticalAlign: -3 }}>
                  {test.ok ? 'check_circle' : 'error_outline'}
                </span>{' '}
                {test.message}
                {test.raw && (
                  <code
                    className="d-block mt-1 text-muted"
                    style={{ fontSize: 10, wordBreak: 'break-all' }}
                  >
                    {test.raw}
                  </code>
                )}
              </div>
            )}

            {/* ---- the M-PESA push tester ---- */}
            <div className="mt-3 pt-2 border-top">
              <label className="cb-fs-meta text-muted d-block mb-1">Test a payment request</label>
              <p className="cb-fs-meta text-muted">
                Asks the main system to put a prompt on a phone, for <strong>one shilling</strong>.
                Whether that takes real money depends on which shortcode THEY are pointed at, which
                this server cannot see.
              </p>

              <div className="d-flex flex-wrap align-items-end gap-1">
                <label className="cb-fs-meta text-muted mb-0" htmlFor="ms-pushnum">
                  <span className="d-block mb-1">Phone number</span>
                  <input
                    id="ms-pushnum"
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
                    title="Asks what the customer did. Needs no inbound route — this is how a push is tested from a machine the main system cannot reach."
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

                  {/* The fake confirmation. Goes through the real handler. */}
                  {push.checkoutRequestId && (
                    <div className="d-flex flex-wrap gap-1 mt-2 pt-2 border-top">
                      <span className="cb-fs-meta text-muted align-self-center me-1">
                        Or post a confirmation to ourselves:
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
                disabled={testing || saving || !meta?.hasApiKey}
                title={
                  meta?.hasApiKey
                    ? 'Calls the main system with the SAVED key. Takes no money and creates nothing.'
                    : 'Save an address and an outbound key first'
                }
                onClick={testConnection}
              >
                {testing ? 'Testing…' : 'Test connection'}
              </button>

              <span className="cb-fs-meta text-muted ms-auto align-self-center">
                Tests the SAVED settings — save first if you have just edited them.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

MainSystemSettings.propTypes = {
  /** Reports configured/not to the Setup tab, so the state is visible without opening it. */
  onStatus: PropTypes.func,
}

export default MainSystemSettings
