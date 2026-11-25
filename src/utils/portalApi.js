// Shared HTTP helpers for the client portal screens.

import axios from 'axios'
import { getToken, clearSession } from './session'

const base = () => `${process.env.REACT_APP_URL_CONFIG}/api`

/** The absolute URL for an API path. */
export const apiUrl = (path) => `${base()}${path}`

const headers = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})

/** The server's message when it sent one, otherwise something a customer can act on. */
export const readErr = (e) => {
  const status = e?.response?.status
  if (status === 403) {
    return (
      e?.response?.data?.message ||
      'That company is not linked to your account. Contact Corebase support if this looks wrong.'
    )
  }
  return e?.response?.data?.message || e?.message || 'Something went wrong. Please try again.'
}

/** A 401 means the token has expired or the account was disabled — there is nothing to retry. */
export class PortalSessionEnded extends Error {
  constructor() {
    super('Your session has ended. Please sign in again.')
    this.name = 'PortalSessionEnded'
  }
}

const unwrap = (e) => {
  if (e?.response?.status === 401) {
    clearSession()
    throw new PortalSessionEnded()
  }
  throw e
}

export const portalGet = async (path, params) => {
  try {
    const r = await axios.get(`${base()}${path}`, { params, headers: headers() })
    return r.data
  } catch (e) {
    return unwrap(e)
  }
}

export const portalPost = async (path, body) => {
  try {
    const r = await axios.post(`${base()}${path}`, body ?? null, { headers: headers() })
    return r.data
  } catch (e) {
    return unwrap(e)
  }
}

export const portalPut = async (path, body) => {
  try {
    const r = await axios.put(`${base()}${path}`, body ?? null, { headers: headers() })
    return r.data
  } catch (e) {
    return unwrap(e)
  }
}

/** A document endpoint, which answers text/html rather than JSON. */
export const portalHtml = async (path) => {
  const res = await fetch(`${base()}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}`, Accept: 'text/html' },
  })

  const body = await res.text()
  if (res.ok) return body

  if (res.status === 401) {
    clearSession()
    throw new PortalSessionEnded()
  }

  let message = 'Could not load this document. Please try again.'
  try {
    message = JSON.parse(body)?.message || message
  } catch {
    /* not JSON — the generic message is the honest one */
  }
  throw new Error(message)
}

// ---- shared formatting ----

/** A date the way a customer reads one: 7 Nov 2026. Null-safe. */
export const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null

/** Licence status → the label and the CSS modifier, defined once for every portal screen. */
export const STATUS = {
  Active: { label: 'Active', cls: 'is-active' },
  ExpiringSoon: { label: 'Expiring soon', cls: 'is-expiringsoon' },
  Expired: { label: 'Expired', cls: 'is-expired' },
  Inactive: { label: 'Not active', cls: 'is-inactive' },
  Unknown: { label: 'No expiry set', cls: 'is-unknown' },
}

export const statusOf = (s) => STATUS[s] ?? STATUS.Unknown

/** Up to two initials for the company identity tile. */
export const initialsOf = (name) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

/** A stable tint for a company's identity tile. */
const TINTS = ['', 'is-indigo', 'is-amber']

export const tintOf = (cusCode) => {
  const s = cusCode || ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997
  return TINTS[h % TINTS.length]
}

/** The expiry meter's fill. */
export const METER_WINDOW_DAYS = 30

export const meterOf = (days) => {
  if (days === null || days === undefined) return { pct: 0, cls: 'is-red' }
  if (days <= 0) return { pct: 0, cls: 'is-red' }
  const pct = Math.min(100, Math.round((days / METER_WINDOW_DAYS) * 100))
  return { pct, cls: days <= 7 ? 'is-red' : days <= METER_WINDOW_DAYS ? 'is-amber' : '' }
}

/** "Saturday, 7 November 2026" for the dashboard eyebrow. */
export const todayLong = () =>
  new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

/** Greeting by local hour — the comp's "Good afternoon, James". */
export const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** "in 24 days" / "12 days ago" / "today". */
export const fmtDays = (days) => {
  if (days === null || days === undefined) return null
  if (days === 0) return 'today'
  return days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${Math.abs(days)} days ago`
}
