import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { toast } from 'react-toastify'
import PasswordInput from '../../components/PasswordInput'
import { getToken } from '../../utils/session'
const axios = require('axios')

/** The SMS gateway (Africa's Talking). */
const LIVE_URL = 'https://api.africastalking.com/version1/messaging'
const SANDBOX_URL = 'https://api.sandbox.africastalking.com/version1/messaging'

const api = `${process.env.REACT_APP_URL_CONFIG}/api/Sms`

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})

const SmsSettings = ({ onStatus }) => {
  const [cfg, setCfg] = useState(null)
  // Starts blank and stays blank unless somebody types a new one — blank means "keep the stored key".
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testNumber, setTestNumber] = useState('')
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')

  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const fmtWhen = (v) =>
    v ? new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await axios.get(`${api}/Config`, { headers: authHeaders() })
      const c = r.data ?? {}
      setCfg(c)

      if (onStatus) {
        const configured = !!c.username && !!c.hasApiKey
        onStatus({
          ok: configured && !!c.enabled && !c.isSandbox,
          label: !configured
            ? 'Not set up'
            : !c.enabled
            ? 'Set up, switched off'
            : c.isSandbox
            ? 'On — sandbox'
            : 'On — live',
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

  const set = (patch) => setCfg((c) => ({ ...c, ...patch }))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const r = await axios.post(
        `${api}/Config`,
        {
          username: cfg.username ?? '',
          apiKey: apiKey || '', // blank = keep the stored key
          senderId: cfg.senderId ?? '',
          baseUrl: cfg.baseUrl ?? '',
          defaultCountryCode: cfg.defaultCountryCode ?? '',
          throttleDelayMs: Number(cfg.throttleDelayMs) || 0,
          enabled: !!cfg.enabled,
        },
        { headers: authHeaders() },
      )

      toast.success(r.data?.message ?? 'Saved.', { theme: 'colored', autoClose: 7000 })
      setApiKey('')
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async () => {
    if (!testNumber.trim()) {
      setError('Enter a phone number to send the test to.')
      return
    }

    setTesting(true)
    setError('')
    try {
      const r = await axios.post(
        `${api}/SendTest`,
        { phoneNumber: testNumber.trim(), message: '' },
        { headers: authHeaders() },
      )
      toast.success(r.data?.message ?? 'Test sent.', { theme: 'colored', autoClose: 7000 })
    } catch (e) {
      setError(readErr(e))
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="card rounded-0 mb-2">
        <div className="card-body cb-fs-meta text-muted">Loading…</div>
      </div>
    )
  }

  if (!cfg) {
    return (
      <div className="card rounded-0 mb-2">
        <div className="card-body">
          <div className="alert alert-danger rounded-0 py-2 cb-fs-body mb-0">
            {error || 'The SMS settings could not be loaded.'}
          </div>
        </div>
      </div>
    )
  }

  const urlMode =
    (cfg.baseUrl ?? '') === SANDBOX_URL
      ? 'sandbox'
      : (cfg.baseUrl ?? '') === LIVE_URL || !cfg.baseUrl
      ? 'live'
      : 'custom'

  return (
    <div className="card rounded-0 mb-2">
      <div
        className="card-header py-2 d-flex align-items-center justify-content-between"
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        <span>
          <span className="material-icons" style={{ fontSize: 16, verticalAlign: -3 }}>
            sms
          </span>{' '}
          Africa&apos;s Talking
        </span>
        <span className="text-muted fw-normal" style={{ fontSize: 11 }}>
          {cfg.updatedAt ? `Last saved ${fmtWhen(cfg.updatedAt)}` : 'Not saved yet'}
        </span>
      </div>

      <div className="card-body">
        {error && <div className="alert alert-danger rounded-0 py-2 cb-fs-body">{error}</div>}

        <div className="row g-2">
          <div className="col-12 col-md-4">
            <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="sms-user">
              Username
            </label>
            <input
              id="sms-user"
              type="text"
              className="form-control form-control-sm rounded-0"
              placeholder="sandbox"
              value={cfg.username ?? ''}
              onChange={(e) => set({ username: e.target.value })}
            />
          </div>

          <div className="col-12 col-md-4">
            <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="sms-key">
              API key
              {cfg.hasApiKey && <span className="text-success ms-1">· stored</span>}
            </label>
            <PasswordInput
              id="sms-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={cfg.hasApiKey ? 'Leave blank to keep the saved key' : 'Paste the key'}
            />
          </div>

          <div className="col-12 col-md-4">
            <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="sms-sender">
              Sender ID
            </label>
            <input
              id="sms-sender"
              type="text"
              className="form-control form-control-sm rounded-0"
              placeholder="Leave blank unless registered"
              value={cfg.senderId ?? ''}
              onChange={(e) => set({ senderId: e.target.value })}
              title="An alphanumeric sender ID registered and approved on your Africa's Talking account. Leave blank to use the account default."
            />
            {/* The natural mistake, and it fails with a message that does not say why. */}
            {cfg.senderId &&
              cfg.username &&
              cfg.senderId.trim().toLowerCase() === cfg.username.trim().toLowerCase() && (
                <span className="d-block cb-fs-meta text-danger mt-1">
                  This is your account username, not a Sender ID. Africa&apos;s Talking will reject
                  it — leave this blank unless you have a registered one.
                </span>
              )}
          </div>

          <div className="col-12 col-md-6">
            <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="sms-url">
              API URL
            </label>
            <select
              className="form-select form-select-sm rounded-0"
              id="sms-url"
              value={urlMode}
              onChange={(e) =>
                set({
                  baseUrl:
                    e.target.value === 'sandbox'
                      ? SANDBOX_URL
                      : e.target.value === 'live'
                      ? LIVE_URL
                      : cfg.baseUrl,
                  isSandbox: e.target.value === 'sandbox',
                })
              }
            >
              <option value="live">Live — messages are delivered and billed</option>
              <option value="sandbox">Sandbox — nothing is delivered, nothing is billed</option>
              <option value="custom">Custom</option>
            </select>
            <input
              type="text"
              className="form-control form-control-sm rounded-0 mt-1"
              value={cfg.baseUrl ?? ''}
              placeholder={LIVE_URL}
              onChange={(e) => set({ baseUrl: e.target.value })}
            />
          </div>

          <div className="col-6 col-md-2">
            <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="sms-cc">
              Country code
            </label>
            <input
              id="sms-cc"
              type="text"
              className="form-control form-control-sm rounded-0"
              placeholder="254"
              value={cfg.defaultCountryCode ?? ''}
              onChange={(e) => set({ defaultCountryCode: e.target.value })}
              title="Assumed for a local number stored without one, e.g. 0722123456. Digits only."
            />
          </div>

          <div className="col-6 col-md-2">
            <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="sms-throttle">
              Throttle (ms)
            </label>
            <input
              id="sms-throttle"
              type="number"
              min={0}
              max={10000}
              className="form-control form-control-sm rounded-0"
              value={cfg.throttleDelayMs ?? 0}
              onChange={(e) => set({ throttleDelayMs: e.target.value })}
              title="Pause between sends, so a large run does not trip the provider's rate limit."
            />
          </div>

          <div className="col-12 col-md-2 d-flex align-items-end">
            <div className="form-check form-switch mb-1">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="sms-enabled"
                checked={!!cfg.enabled}
                onChange={(e) => set({ enabled: e.target.checked })}
              />
              <label className="form-check-label cb-fs-body" htmlFor="sms-enabled">
                Send messages
              </label>
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-end gap-1 mt-3 pt-2 border-top">
          <button
            type="button"
            className="btn btn-sm add-btn rounded-0"
            disabled={saving}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>

          <span className="ms-auto d-flex align-items-end gap-1">
            <label className="cb-fs-meta text-muted mb-0" htmlFor="sms-test">
              <span className="d-block mb-1">Send a test to</span>
              <input
                id="sms-test"
                type="text"
                className="form-control form-control-sm rounded-0"
                style={{ width: 170 }}
                placeholder="0722123456"
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-sm filter-btn rounded-0"
              disabled={testing || !cfg.hasApiKey}
              title={
                cfg.hasApiKey
                  ? 'Sends one message now and reports exactly what the gateway said.'
                  : 'Save an API key first.'
              }
              onClick={sendTest}
            >
              {testing ? 'Sending…' : 'Send test'}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}

SmsSettings.propTypes = {
  /** Reports configured/not to the Setup tab, so the state is visible without opening it. */
  onStatus: PropTypes.func,
}

export default SmsSettings
