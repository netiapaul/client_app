import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  portalGet,
  readErr,
  fmtDate,
  fmtDays,
  statusOf,
  initialsOf,
  tintOf,
  meterOf,
  todayLong,
  greeting,
  PortalSessionEnded,
} from '../../utils/portalApi'
import { formatMoney as money } from '../../utils/money'

/** Portal dashboard. The hero states the one thing worth acting on. */
const PortalDashboard = () => {
  const navigate = useNavigate()

  const [summary, setSummary] = useState(null)
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, c] = await Promise.all([
        portalGet('/Portal/Summary'),
        portalGet('/Portal/Companies'),
      ])
      setSummary(s)
      setCompanies(c ?? [])
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

  if (loading) return <div className="pt-empty">Loading…</div>
  if (error) return <div className="pt-note pt-note--amber">{error}</div>

  const open = (cusCode) => navigate(`/portal/companies/${encodeURIComponent(cusCode)}`)

  const attention =
    (summary?.licencesExpired ?? 0) +
    (summary?.licencesExpiringSoon ?? 0) +
    (summary?.licencesInactive ?? 0)

  // Computed from the figure, not from a separate flag.
  const owes = (summary?.outstanding ?? 0) > 0

  // The hero's per-company facts: the three closest renewals.
  const soonest = [...companies]
    .filter((c) => c.nextExpiry)
    .sort((a, b) => new Date(a.nextExpiry) - new Date(b.nextExpiry))
    .slice(0, 3)

  return (
    <>
      <div className="pt-head">
        <div>
          <span className="pt-head__eyebrow">{todayLong()}</span>
          <h1>
            {greeting()}
            {summary?.userName ? `, ${summary.userName.split(' ')[0]}` : ''}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="pt-btn" onClick={() => navigate('/portal/companies')}>
            <span className="material-icons">business</span>
            My companies
          </button>
        </div>
      </div>

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
        <div className="pt-card pt-card--dark pt-hero" style={{ flex: '2 1 480px', minWidth: 0 }}>
          <span aria-hidden="true" className="pt-hero__ring pt-hero__ring--a" />
          <span aria-hidden="true" className="pt-hero__ring pt-hero__ring--b" />

          <span className="pt-hero__label">
            {owes ? 'Total outstanding' : 'Next licence renewal'}
            {owes && summary.overdueInvoices > 0 && (
              <span
                style={{
                  background: 'var(--pt-red)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 999,
                  letterSpacing: 0,
                  textTransform: 'none',
                }}
              >
                {summary.overdueInvoices} overdue
              </span>
            )}
            {!owes && attention > 0 && (
              <span
                style={{
                  background: 'var(--pt-amber)',
                  color: 'var(--pt-rail)',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 999,
                  letterSpacing: 0,
                  textTransform: 'none',
                }}
              >
                {attention} need{attention === 1 ? 's' : ''} attention
              </span>
            )}
          </span>

          {/* MONEY LEADS WHEN THERE IS ANY OWED. */}
          {owes ? (
            <>
              <span className="pt-hero__value">{money(summary.outstanding, summary.currency)}</span>
              <div className="pt-hero__facts">
                <span className="pt-hero__fact">
                  <span>
                    {summary.openInvoices} invoice{summary.openInvoices === 1 ? '' : 's'}
                    {summary.companiesOwing > 1 ? ` · ${summary.companiesOwing} companies` : ''}
                  </span>
                  {summary.nextInvoiceDue && (
                    <span
                      style={{
                        color:
                          summary.nextInvoiceDueDays < 0
                            ? 'var(--pt-bad-bright)'
                            : summary.nextInvoiceDueDays <= 7
                            ? 'var(--pt-warn-bright)'
                            : 'var(--pt-ok-bright)',
                      }}
                    >
                      {summary.nextInvoiceDueDays < 0
                        ? `overdue since ${fmtDate(summary.nextInvoiceDue)}`
                        : `due ${fmtDate(summary.nextInvoiceDue)}`}
                    </span>
                  )}
                </span>

                {/* Only when there is some. */}
                {summary.credit > 0 && (
                  <span className="pt-hero__fact">
                    <span>Credit on your account</span>
                    <span style={{ color: 'var(--pt-ok-bright)' }}>
                      {money(summary.credit, summary.currency)}
                    </span>
                  </span>
                )}

                {/* WHAT IS LEFT AFTER THE CREDIT, next to what is owed. */}
                {summary.creditUsable > 0 && (
                  <span className="pt-hero__fact">
                    <span>To pay after credit</span>
                    <span>{money(summary.toPay, summary.currency)}</span>
                  </span>
                )}

                {/* And the opposite case, said plainly rather than left as a puzzle. */}
                {summary.creditUnusable > 0 && summary.outstanding > 0 && (
                  <span className="pt-hero__fact">
                    <span style={{ textTransform: 'none' }}>
                      {money(summary.creditUnusable, summary.currency)} of that credit is on a
                      company with nothing outstanding — it waits for that company&apos;s next
                      invoice.
                    </span>
                  </span>
                )}
              </div>
            </>
          ) : summary?.nextExpiry ? (
            <>
              <span className="pt-hero__value">
                {fmtDate(summary.nextExpiry)}
                {summary.nextExpiryDays !== null && summary.nextExpiryDays !== undefined && (
                  <span className="pt-hero__unit">{fmtDays(summary.nextExpiryDays)}</span>
                )}
              </span>
              <div className="pt-hero__facts">
                {soonest.map((c) => (
                  <span className="pt-hero__fact" key={c.cusCode}>
                    <span>{c.companyName}</span>
                    <span
                      style={{
                        color:
                          c.worstStatus === 'Expired'
                            ? 'var(--pt-bad-bright)'
                            : c.worstStatus === 'ExpiringSoon'
                            ? 'var(--pt-warn-bright)'
                            : 'var(--pt-ok-bright)',
                      }}
                    >
                      {fmtDate(c.nextExpiry)}
                    </span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <span className="pt-hero__value" style={{ fontSize: 'var(--pt-fs-h2)' }}>
              No renewal date recorded
            </span>
          )}

          <div className="pt-hero__actions">
            {/* Hidden when nothing is owed, rather than disabled. */}
            {owes && (
              <button
                type="button"
                className="pt-btn pt-btn--accent"
                onClick={() =>
                  navigate(summary.companiesOwing > 1 ? '/portal/pay?all=1' : '/portal/pay')
                }
              >
                {summary.companiesOwing > 1
                  ? `Pay all ${summary.companiesOwing} companies`
                  : 'Make a payment'}
                <span className="material-icons">arrow_forward</span>
              </button>
            )}

            {owes && (
              <button
                type="button"
                className="pt-btn pt-btn--ghost-dark"
                onClick={() => navigate('/portal/invoices')}
              >
                See the invoices
              </button>
            )}

            <button
              type="button"
              className="pt-btn pt-btn--ghost-dark"
              onClick={() => navigate('/portal/companies')}
            >
              View licences
            </button>
          </div>
        </div>

        <div className="pt-stats" style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div className="pt-stat">
            <span className="pt-stat__icon">
              <span className="material-icons">verified</span>
            </span>
            <span>
              <span className="pt-stat__value">{summary?.licencesActive ?? 0}</span>
              <span className="pt-stat__label">Licences active</span>
            </span>
          </div>
          <div className="pt-stat is-amber">
            <span className="pt-stat__icon">
              <span className="material-icons">schedule</span>
            </span>
            <span>
              <span className="pt-stat__value">{summary?.licencesExpiringSoon ?? 0}</span>
              <span className="pt-stat__label">
                Due in {summary?.expiringSoonWindowDays ?? 30} days
              </span>
            </span>
          </div>
          <div className="pt-stat is-red">
            <span className="pt-stat__icon">
              <span className="material-icons">error_outline</span>
            </span>
            <span>
              <span className="pt-stat__value">{summary?.licencesExpired ?? 0}</span>
              <span className="pt-stat__label">Expired</span>
            </span>
          </div>
          <div className="pt-stat is-indigo">
            <span className="pt-stat__icon">
              <span className="material-icons">store</span>
            </span>
            <span>
              <span className="pt-stat__value">{summary?.branches ?? 0}</span>
              <span className="pt-stat__label">Branches</span>
            </span>
          </div>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 'var(--pt-fs-h2)', fontWeight: 700 }}>
            Your companies
          </h2>
          <button
            type="button"
            className="pt-crumb"
            style={{ background: 'none', border: 0, cursor: 'pointer' }}
            onClick={() => navigate('/portal/companies')}
          >
            <span style={{ fontWeight: 600, color: 'var(--pt-green)' }}>See all →</span>
          </button>
        </div>

        {companies.length === 0 ? (
          <div className="pt-card pt-empty">
            <span className="material-icons">business</span>
            No companies are linked to your account yet.
            <span style={{ fontSize: 'var(--pt-fs-sm)' }}>
              Contact Corebase support and they will link them for you.
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(290px, 100%), 1fr))',
              gap: 16,
            }}
          >
            {companies.slice(0, 6).map((c) => {
              const s = statusOf(c.worstStatus)
              const days = c.licences?.[0]?.daysRemaining
              const meter = meterOf(days)
              return (
                <button
                  key={c.cusCode}
                  type="button"
                  className="pt-company pt-lift"
                  onClick={() => open(c.cusCode)}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <span style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                      <span className={`pt-initials ${tintOf(c.cusCode)}`}>
                        {initialsOf(c.companyName)}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span className="pt-company__name">{c.companyName}</span>
                        <span className="pt-company__code">{c.cusCode}</span>
                      </span>
                    </span>
                    <span className={`pt-pill ${s.cls}`}>{s.label}</span>
                  </span>

                  <span className="pt-meter">
                    <span className="pt-meter__row">
                      <span>Expires</span>
                      <span>{c.nextExpiry ? fmtDate(c.nextExpiry) : 'Not set'}</span>
                    </span>
                    <span className="pt-meter__track">
                      <span
                        className={`pt-meter__fill ${meter.cls}`}
                        style={{ width: `${meter.pct}%` }}
                      />
                    </span>
                    <span className="pt-meter__note">
                      {days === null || days === undefined
                        ? 'No expiry recorded'
                        : days < 0
                        ? `Expired ${Math.abs(days)} days ago`
                        : `${days} day${days === 1 ? '' : 's'} left`}
                    </span>
                  </span>

                  <span className="pt-company__foot">
                    <span className="pt-company__metric">
                      <strong>{c.branchCount}</strong>
                      <span>Branches</span>
                    </span>
                    <span className="pt-company__metric">
                      <strong>{c.totalLicensedUsers}</strong>
                      <span>Users</span>
                    </span>
                    <span className="pt-company__metric">
                      <strong>{c.licences?.length ?? 0}</strong>
                      <span>{c.licences?.length === 1 ? 'Licence' : 'Licences'}</span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

export default PortalDashboard
