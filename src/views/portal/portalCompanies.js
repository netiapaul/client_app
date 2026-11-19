import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  portalGet,
  readErr,
  fmtDate,
  statusOf,
  initialsOf,
  tintOf,
  PortalSessionEnded,
} from '../../utils/portalApi'

/**
 * My companies — one expanded card per company, with status filter pills above.
 *
 * Follows the comp, minus the money. The comp's cards carry "Monthly fee" and "Balance" tiles and a
 * "Pay KES 10,000" button; neither figure exists until the billing ledger is built, so those tiles
 * are replaced with licence facts that are real (branches, users, expiry, surface) and the pay
 * button is left out rather than rendered dead on every card.
 */
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Active', label: 'Active' },
  { key: 'ExpiringSoon', label: 'Expiring soon' },
  { key: 'Expired', label: 'Expired' },
]

const PortalCompanies = () => {
  const navigate = useNavigate()

  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCompanies((await portalGet('/Portal/Companies')) ?? [])
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

  // Counts come off the full list so a pill still shows its number while another filter is active.
  const counts = useMemo(() => {
    const c = { all: companies.length }
    companies.forEach((x) => {
      c[x.worstStatus] = (c[x.worstStatus] ?? 0) + 1
    })
    return c
  }, [companies])

  const shown = useMemo(
    () => (filter === 'all' ? companies : companies.filter((c) => c.worstStatus === filter)),
    [companies, filter],
  )

  if (loading) return <div className="pt-empty">Loading…</div>
  if (error) return <div className="pt-note pt-note--amber">{error}</div>

  return (
    <>
      <div className="pt-head">
        <div>
          <span className="pt-head__eyebrow">
            {companies.length === 1
              ? '1 company linked to your account'
              : `${companies.length} companies linked to your account`}
          </span>
          <h1>My companies</h1>
        </div>
      </div>

      <div className="pt-note">
        {/* `account_circle`, not `link`: the chain glyph is a thin horizontal shape that reads as
            a flat blob in a 34px tile, and the message is about the one ACCOUNT these companies
            hang off rather than about linking as an action. */}
        <span className="pt-note__icon">
          <span className="material-icons">account_circle</span>
        </span>
        <span>
          <strong>One login, every company</strong>
          <span>
            Each company keeps its own customer code. They are grouped here because they are linked
            to your account. Missing one? Ask Corebase support to link it.
          </span>
        </span>
      </div>

      {companies.length > 1 && (
        <div className="pt-filters" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span>{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="pt-card pt-empty">
          <span className="material-icons">business</span>
          {companies.length === 0
            ? 'No companies are linked to your account yet.'
            : 'No companies with that status.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {shown.map((c) => {
            const s = statusOf(c.worstStatus)
            return (
              <article key={c.cusCode} className="pt-card pt-lift" style={{ padding: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: 16,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
                    <span className={`pt-initials pt-initials--lg ${tintOf(c.cusCode)}`}>
                      {initialsOf(c.companyName)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        <h2
                          style={{
                            margin: 0,
                            fontSize: 'var(--pt-fs-h2)',
                            fontWeight: 700,
                          }}
                        >
                          {c.companyName}
                        </h2>
                        <span className={`pt-pill ${s.cls}`}>{s.label}</span>
                        {c.archived && <span className="pt-pill is-inactive">Archived</span>}
                      </div>
                      <span
                        style={{
                          fontSize: 'var(--pt-fs-sm)',
                          color: 'var(--pt-muted)',
                        }}
                      >
                        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
                          {c.cusCode}
                        </span>
                        {c.licences?.[0]?.packageName ? ` · ${c.licences[0].packageName}` : ''}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="pt-btn"
                    onClick={() => navigate(`/portal/companies/${encodeURIComponent(c.cusCode)}`)}
                  >
                    View details
                    <span className="material-icons">arrow_forward</span>
                  </button>
                </div>

                <div className="pt-tiles" style={{ marginTop: 18 }}>
                  <div className="pt-tile">
                    <span className="pt-tile__k">Branches</span>
                    <span className="pt-tile__v">{c.branchCount}</span>
                  </div>
                  <div className="pt-tile">
                    <span className="pt-tile__k">Licensed users</span>
                    <span className="pt-tile__v">{c.totalLicensedUsers}</span>
                  </div>
                  <div className="pt-tile">
                    <span className="pt-tile__k">Licences</span>
                    <span className="pt-tile__v">{c.licences?.length ?? 0}</span>
                    <span className="pt-tile__note">
                      {(c.licences ?? []).map((l) => l.surface).join(' · ')}
                    </span>
                  </div>
                  <div className="pt-tile">
                    <span className="pt-tile__k">Expiry date</span>
                    <span className="pt-tile__v">{c.nextExpiry ? fmtDate(c.nextExpiry) : '—'}</span>
                    {c.licences?.[0]?.daysRemaining !== null &&
                      c.licences?.[0]?.daysRemaining !== undefined && (
                        <span
                          className="pt-tile__note"
                          style={{
                            color:
                              c.licences[0].daysRemaining < 0
                                ? 'var(--pt-red-fg)'
                                : c.licences[0].daysRemaining <= 30
                                ? 'var(--pt-amber-fg)'
                                : 'var(--pt-green)',
                          }}
                        >
                          {c.licences[0].daysRemaining < 0
                            ? `Expired ${Math.abs(c.licences[0].daysRemaining)} days ago`
                            : `${c.licences[0].daysRemaining} days left`}
                        </span>
                      )}
                  </div>
                </div>

                {/* Per-licence lines, only when the company holds more than one: cloud and desktop
                    are separate licences with their own expiry, and a single date above would be
                    true for only half the branches. */}
                {c.licences?.length > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      alignItems: 'center',
                      marginTop: 14,
                    }}
                  >
                    <span className="pt-taglabel">LICENCES</span>
                    {c.licences.map((l) => (
                      <span
                        key={l.surface}
                        className={`pt-tag ${l.forCloud ? '' : 'pt-tag--muted'}`}
                      >
                        {l.surface}
                        {l.effectiveExpiry ? ` · ${fmtDate(l.effectiveExpiry)}` : ' · no expiry'}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}

export default PortalCompanies
