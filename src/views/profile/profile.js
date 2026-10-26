import React, { useState, useEffect, useCallback } from 'react'
import { getToken } from '../../utils/session'
import TwoFactorSettings from './TwoFactorSettings'

const axios = require('axios')
const BASE_URL = process.env.REACT_APP_URL_CONFIG

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})
const readErr = (e) =>
  e?.response?.data?.message || e?.request?.response || `${e?.code}: ${e?.message}`

// Initials for the avatar badge (first + last word of the name).
const initials = (name) => {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
}

const renderDetail = (label, value) => (
  <div
    className="d-flex py-2"
    style={{ borderBottom: '1px solid var(--cui-border-color, #eef1f5)', fontSize: 13 }}
  >
    <div style={{ width: 160, color: '#8a94a6', fontWeight: 600 }}>{label}</div>
    <div style={{ color: 'var(--cui-body-color, #22304a)' }}>
      {value || <span className="text-muted">—</span>}
    </div>
  </div>
)

const Profile = () => {
  const [me, setMe] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await axios.get(`${BASE_URL}/api/Auth/Me`, { headers: authHeaders() })
      setMe(r.data)
    } catch (e) {
      setError(readErr(e))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <hr className="my-2" />
      <h6 className="m-0">My Profile</h6>
      <hr className="my-2" />

      {error && (
        <div className="alert alert-danger rounded-0 p-2" role="alert" style={{ fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Identity + details */}
      <div className="card rounded-0 mb-2">
        <div className="card-body">
          <div className="d-flex align-items-center mb-3">
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#C58C4F',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {initials(me?.name)}
            </div>
            <div className="ms-3">
              <div
                style={{ fontSize: 16, fontWeight: 700, color: 'var(--cui-body-color, #22304a)' }}
              >
                {me?.name || '—'}
              </div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {me?.role}
                {me?.canApprove ? ' · Approver' : ''}
              </div>
            </div>
          </div>

          {renderDetail('Full name', me?.name)}
          {renderDetail('Email', me?.email)}
          {renderDetail('Phone number', me?.phoneNumber)}
          {renderDetail('Role', me?.role)}
          {renderDetail('Change approver', me?.canApprove ? 'Yes' : 'No')}
        </div>
      </div>

      {/* Security / 2FA */}
      <TwoFactorSettings />
    </>
  )
}

export default Profile
