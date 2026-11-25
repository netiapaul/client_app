import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  portalGet,
  portalPost,
  readErr,
  fmtDate,
  fmtDays,
  statusOf,
  initialsOf,
  tintOf,
  METER_WINDOW_DAYS,
  PortalSessionEnded,
} from '../../utils/portalApi'
import { formatMoney as money } from '../../utils/money'

/** One company in full — licences, branches, add-ons and the modules its package includes. */
const PortalCompanyDetail = () => {
  const { cuscode } = useParams()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [siblings, setSiblings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [section, setSection] = useState('licences')
  // Which module groups are expanded.
  const [openMods, setOpenMods] = useState([])

  // Buying a longer term.
  const [renewal, setRenewal] = useState(null)
  const [term, setTerm] = useState(null)
  const [renewing, setRenewing] = useState(false)

  const refs = {
    licences: useRef(null),
    branches: useRef(null),
    modules: useRef(null),
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // The switcher needs the sibling companies; the detail endpoint only knows about this one.
      const [detail, list] = await Promise.all([
        portalGet(`/Portal/Companies/${encodeURIComponent(cuscode)}`),
        portalGet('/Portal/Companies'),
      ])
      setData(detail)
      setSiblings(list ?? [])
      setError('')

      // Separately, and deliberately not fatal.
      try {
        const r = await portalGet(`/Portal/Payments/Renewal/${encodeURIComponent(cuscode)}`)
        setRenewal(r)
        setTerm(r?.terms?.[0]?.months ?? null)
      } catch {
        setRenewal(null)
      }
    } catch (e) {
      if (e instanceof PortalSessionEnded) {
        navigate('/', { replace: true })
        return
      }
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [cuscode, navigate])

  useEffect(() => {
    load()
  }, [load])

  const goto = (key) => {
    setSection(key)
    refs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const toggleMod = (name) =>
    setOpenMods((o) => (o.includes(name) ? o.filter((x) => x !== name) : [...o, name]))

  if (loading) return <div className="pt-empty">Loading…</div>

  if (error) {
    return (
      <>
        <div className="pt-note pt-note--amber">{error}</div>
        <button type="button" className="pt-btn" onClick={() => navigate('/portal/companies')}>
          <span className="material-icons">arrow_back</span>
          Back to companies
        </button>
      </>
    )
  }

  const company = data?.company
  if (!company) return <div className="pt-empty">Company not found.</div>

  const branches = data.branches ?? []
  const addOns = data.addOns ?? []
  const modules = data.modules ?? []
  const status = statusOf(company.worstStatus)

  // This company's money.
  const credit = data.credit ?? 0
  const owing = data.outstanding ?? 0
  const creditApplied = Math.min(credit, owing)
  const toPay = Math.max(0, owing - credit)

  // What the NEXT invoice starts against — what is left after any open bill has taken its share.
  const creditRemaining = Math.max(0, credit - creditApplied)
  // From the server, which reads it off this company's own invoices rather than assuming.
  const ccy = data.currency || 'KES'

  // Sub-modules grouped under their module: the API returns one row per sub-module.
  const moduleGroups = modules.reduce((acc, m) => {
    const key = m.moduleName || 'Other'
    acc[key] = acc[key] ?? []
    if (m.subModuleName) acc[key].push(m.subModuleName)
    return acc
  }, {})
  const moduleNames = Object.keys(moduleGroups)
  const allOpen = moduleNames.length > 0 && openMods.length === moduleNames.length

  const lead = company.licences?.[0]

  // The ring reads days-left against a 30-day window (see each licence card below).
  const circumference = 2 * Math.PI * 62

  return (
    <>
      <nav className="pt-crumb" aria-label="Breadcrumb">
        <button type="button" onClick={() => navigate('/portal/companies')}>
          My companies
        </button>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{company.companyName}</span>
      </nav>

      <section
        className="pt-card"
        style={{
          borderRadius: 24,
          padding: 24,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 22,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', minWidth: 0 }}>
          <span className={`pt-initials pt-initials--lg ${tintOf(company.cusCode)}`}>
            {initialsOf(company.companyName)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'var(--pt-fs-display)',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}
              >
                {company.companyName}
              </h1>
              <span className={`pt-pill ${status.cls}`}>{status.label}</span>
              {company.archived && <span className="pt-pill is-inactive">Archived</span>}
            </div>
            <span style={{ fontSize: 'var(--pt-fs-body)', color: 'var(--pt-muted)' }}>
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
                {company.cusCode}
              </span>
              {lead?.packageName ? ` · ${lead.packageName}` : ''}
            </span>
          </div>
        </div>

        {siblings.length > 1 && (
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: 'var(--pt-fs-xs)',
              color: 'var(--pt-muted)',
              fontWeight: 600,
            }}
          >
            Switch company
            <select
              value={company.cusCode}
              onChange={(e) => navigate(`/portal/companies/${encodeURIComponent(e.target.value)}`)}
              style={{
                height: 44,
                minWidth: 230,
                padding: '0 12px',
                font: 'inherit',
                fontSize: 'var(--pt-fs-body)',
                color: 'var(--pt-ink)',
                background: 'var(--pt-surface)',
                border: '1px solid var(--pt-border)',
                borderRadius: 12,
              }}
            >
              {siblings.map((s) => (
                <option key={s.cusCode} value={s.cusCode}>
                  {s.companyName} · {s.cusCode}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <nav className="pt-sectionnav" aria-label="Sections">
        <button
          type="button"
          className={section === 'licences' ? 'active' : ''}
          onClick={() => goto('licences')}
        >
          Licences · {company.licences?.length ?? 0}
        </button>
        <button
          type="button"
          className={section === 'branches' ? 'active' : ''}
          onClick={() => goto('branches')}
        >
          Branches · {branches.length}
        </button>
        <button
          type="button"
          className={section === 'modules' ? 'active' : ''}
          onClick={() => goto('modules')}
        >
          Modules &amp; add-ons
        </button>
      </nav>

      {/* Licences — one dark card per surface */}
      <section
        ref={refs.licences}
        className="pt-anchor"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}
      >
        {(company.licences ?? []).map((l, i) => {
          const s = statusOf(l.status)
          const d = l.daysRemaining
          const pct =
            d === null || d === undefined || d <= 0 ? 0 : Math.min(1, d / METER_WINDOW_DAYS)
          return (
            <div
              key={l.surface}
              className="pt-card pt-card--dark"
              style={{ flex: '1 1 400px', minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 24 }}
            >
              {/* The ring is drawn once, for the first licence card. */}
              {i === 0 && (
                <div className="pt-ring">
                  <svg
                    width="150"
                    height="150"
                    viewBox="0 0 150 150"
                    role="img"
                    aria-label={
                      d === null || d === undefined ? 'No expiry recorded' : `${d} days remaining`
                    }
                  >
                    <circle cx="75" cy="75" r="62" fill="none" stroke="#1e2a40" strokeWidth="14" />
                    <circle
                      cx="75"
                      cy="75"
                      r="62"
                      fill="none"
                      stroke={
                        d === null || d === undefined || d < 0
                          ? 'var(--pt-red)'
                          : d <= 7
                          ? 'var(--pt-warn-bright)'
                          : 'var(--pt-ok-bright)'
                      }
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray={`${circumference * pct} ${circumference}`}
                      transform="rotate(-90 75 75)"
                    />
                  </svg>
                  <div className="pt-ring__center">
                    <strong>{d === null || d === undefined ? '—' : d < 0 ? 0 : d}</strong>
                    <span>days left</span>
                  </div>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  flex: 1,
                  minWidth: 170,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 'var(--pt-fs-h3)',
                      fontWeight: 700,
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 19 }}>
                      {l.forCloud ? 'cloud' : 'computer'}
                    </span>
                    {l.surface} licence
                  </span>
                  <span className={`pt-pill ${s.cls}`}>{s.label}</span>
                </div>

                <div>
                  <span className="pt-hero__label" style={{ marginBottom: 4 }}>
                    Licensed through
                  </span>
                  <span style={{ fontSize: 24, fontWeight: 800, display: 'block' }}>
                    {l.effectiveExpiry ? fmtDate(l.effectiveExpiry) : 'Not set'}
                  </span>
                  {l.daysRemaining !== null && l.daysRemaining !== undefined && (
                    <span style={{ fontSize: 'var(--pt-fs-sm)', color: 'var(--pt-on-dark-dim)' }}>
                      {fmtDays(l.daysRemaining)}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 12,
                  }}
                >
                  <span className="pt-hero__fact">
                    <span>Package</span>
                    <span>{l.packageName || l.packageCode || '—'}</span>
                  </span>
                  <span className="pt-hero__fact">
                    <span>Licensed users</span>
                    <span>{l.licensedUsers}</span>
                  </span>
                  <span className="pt-hero__fact">
                    <span>Branches</span>
                    <span>{l.branchCount}</span>
                  </span>
                  <span className="pt-hero__fact">
                    <span>Status</span>
                    <span>{l.active ? 'Enabled' : 'Disabled'}</span>
                  </span>
                </div>

                {/* A grace period someone granted, which will itself run out. */}
                {l.onTemporaryExtension && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'rgba(245, 158, 11, .14)',
                      color: 'var(--pt-warn-bright)',
                      fontSize: 'var(--pt-fs-xs)',
                      lineHeight: 1.5,
                    }}
                  >
                    Running on a temporary extension to{' '}
                    <strong>{fmtDate(l.temporaryExpiryDate)}</strong>. The standard expiry was{' '}
                    {fmtDate(l.expiryDate)}.
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </section>

      {/* THE ACCOUNT BALANCE FOR THIS COMPANY. */}
      {(credit > 0 || owing > 0) && (
        <section className="pt-card">
          <h2 className="pt-card__title">Account balance</h2>

          <div className="pt-tiles" style={{ marginTop: 14 }}>
            {owing > 0 && (
              <div className="pt-tile">
                <span className="pt-tile__k">Invoiced and unpaid</span>
                <span className="pt-tile__v">{money(owing, ccy)}</span>
              </div>
            )}

            {credit > 0 && (
              <div className="pt-tile">
                <span className="pt-tile__k">Credit on this company</span>
                <span className="pt-tile__v" style={{ color: 'var(--pt-ok, #157347)' }}>
                  {money(credit, ccy)}
                </span>
              </div>
            )}

            {/* Only when the two actually meet. */}
            {creditApplied > 0 && owing > 0 && (
              <div className="pt-tile">
                <span className="pt-tile__k">To pay now</span>
                <span className="pt-tile__v">{money(toPay, ccy)}</span>
              </div>
            )}
          </div>

          <p
            style={{
              margin: '12px 0 0',
              fontSize: 'var(--pt-fs-xs)',
              color: 'var(--pt-muted)',
            }}
          >
            {creditRemaining > 0 ? (
              <>
                <strong>{money(creditRemaining, ccy)}</strong> stays on this company&apos;s account
                and comes off its next invoice automatically — including one you raise below. It is
                not lost if you do not use it this month.
              </>
            ) : (
              <>
                Your credit has been put against the invoice above. Anything left over after an
                invoice is settled stays on this company&apos;s account for the next one.
              </>
            )}
          </p>
        </section>
      )}

      {/* ---- buy a longer term ---- */}
      {renewal?.canRenew && (
        <section className="pt-card">
          <h2 className="pt-card__title">Renew for longer</h2>

          <p
            style={{
              margin: '10px 0 0',
              fontSize: 'var(--pt-fs-body)',
              color: 'var(--pt-muted)',
            }}
          >
            Pay for several months at once instead of renewing every month. Choose a term and we
            will raise the invoice straight away.
            {/* Said out loud, because otherwise the dates look wrong. */}
            {renewal.alreadyInvoiced && (
              <>
                {' '}
                Your next renewal is already invoiced, so this starts after it, on{' '}
                <strong>{fmtDate(renewal.nextPeriodStart)}</strong>.
              </>
            )}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))',
              gap: 10,
              marginTop: 14,
            }}
          >
            {renewal.terms.map((t) => (
              <label
                key={t.months}
                style={{
                  display: 'block',
                  padding: '12px 14px',
                  background: 'var(--pt-soft)',
                  border: `1px solid ${
                    term === t.months ? 'var(--pt-accent)' : 'var(--pt-border)'
                  }`,
                  borderRadius: 14,
                  cursor: renewing ? 'not-allowed' : 'pointer',
                  opacity: renewing ? 0.6 : 1,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="radio"
                    name="pt-term"
                    checked={term === t.months}
                    disabled={renewing}
                    onChange={() => setTerm(t.months)}
                    style={{ width: 17, height: 17, accentColor: 'var(--pt-accent)' }}
                  />
                  <span style={{ fontWeight: 700 }}>{t.label}</span>
                </span>
                <span
                  style={{
                    display: 'block',
                    marginTop: 8,
                    fontSize: 'var(--pt-fs-h3)',
                    fontWeight: 800,
                  }}
                >
                  {money(t.amount, t.currency)}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--pt-fs-xs)',
                    color: 'var(--pt-muted)',
                  }}
                >
                  runs to {fmtDate(t.renewsTo)}
                </span>
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="pt-btn pt-btn--accent"
              disabled={renewing || !term}
              onClick={async () => {
                setRenewing(true)
                setError('')
                try {
                  const r = await portalPost(
                    `/Portal/Payments/Renewal/${encodeURIComponent(cuscode)}?months=${term}`,
                  )

                  // Straight to Pay with the invoice already issued.
                  navigate(`/portal/pay?cus=${encodeURIComponent(cuscode)}`, {
                    state: { notice: r?.message },
                  })
                } catch (e) {
                  if (e instanceof PortalSessionEnded) {
                    navigate('/', { replace: true })
                    return
                  }
                  setError(readErr(e))
                  setRenewing(false)
                }
              }}
            >
              {renewing ? 'Preparing…' : 'Raise the invoice'}
              <span className="material-icons">arrow_forward</span>
            </button>
          </div>

          <p
            style={{
              margin: '12px 0 0',
              fontSize: 'var(--pt-fs-xs)',
              color: 'var(--pt-muted)',
            }}
          >
            Your licence moves only once the invoice is paid in full. Add-ons keep their own cycle
            and are billed separately.
            {creditRemaining > 0 && (
              <>
                {' '}
                The <strong>{money(creditRemaining, ccy)}</strong> on this company&apos;s account
                comes off whichever term you choose, so you will be asked for that much less.
              </>
            )}
          </p>
        </section>
      )}

      {(company.companyEmail || company.companyPhone) && (
        <section className="pt-card">
          <h2 className="pt-card__title">Account contact</h2>
          <div className="pt-tiles" style={{ marginTop: 14 }}>
            {company.companyEmail && (
              <div className="pt-tile">
                <span className="pt-tile__k">Email</span>
                <span
                  style={{ fontSize: 'var(--pt-fs-body)', fontWeight: 600, wordBreak: 'break-all' }}
                >
                  {company.companyEmail}
                </span>
              </div>
            )}
            {company.companyPhone && (
              <div className="pt-tile">
                <span className="pt-tile__k">Phone</span>
                <span style={{ fontSize: 'var(--pt-fs-body)', fontWeight: 600 }}>
                  {company.companyPhone}
                </span>
              </div>
            )}
          </div>
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 'var(--pt-fs-xs)',
              color: 'var(--pt-muted)',
            }}
          >
            Contact Corebase support to change these.
          </p>
        </section>
      )}

      {/* Branches */}
      <section ref={refs.branches} className="pt-card pt-anchor">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <h2 className="pt-card__title">Branches</h2>
          <span style={{ fontSize: 'var(--pt-fs-sm)', color: 'var(--pt-muted)' }}>
            {branches.length} {branches.length === 1 ? 'branch' : 'branches'} ·{' '}
            {branches.filter((b) => b.active && !b.archived).length} active
          </span>
        </div>

        {branches.length === 0 ? (
          <div className="pt-empty">No branches are recorded.</div>
        ) : (
          <div className="pt-scroll" style={{ marginTop: 14 }}>
            <table className="pt-table">
              <thead>
                <tr>
                  <th style={{ width: '1%' }}>#</th>
                  <th>Branch</th>
                  <th style={{ width: '1%' }}>Type</th>
                  <th>Location</th>
                  <th style={{ width: '1%', textAlign: 'center' }}>Users</th>
                  <th style={{ width: '1%', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td style={{ color: 'var(--pt-muted)' }}>{b.branchCode}</td>
                    <td style={{ fontWeight: 600 }}>{b.branchName}</td>
                    <td>
                      <span className={`pt-tag ${b.forCloud ? '' : 'pt-tag--muted'}`}>
                        {b.surface}
                      </span>
                    </td>
                    <td style={{ color: 'var(--pt-muted)' }}>{b.location || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{b.licensedUsers}</td>
                    <td style={{ textAlign: 'center' }}>
                      {b.archived ? (
                        <span className="pt-pill is-inactive">Archived</span>
                      ) : b.active ? (
                        <span className="pt-pill is-active">Active</span>
                      ) : (
                        <span className="pt-pill is-inactive">Off</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modules and add-ons */}
      <section ref={refs.modules} className="pt-card pt-anchor">
        <h2 className="pt-card__title">Modules &amp; add-ons</h2>

        {data.mixedPackages && (
          <div className="pt-note pt-note--amber" style={{ marginTop: 14 }}>
            <span className="pt-note__icon">
              <span className="material-icons">info</span>
            </span>
            <span>
              <strong>Two packages on this account</strong>
              <span>
                Your licences are on different packages, so the modules below are the combined list
                of everything included.
              </span>
            </span>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <span className="pt-taglabel">ADD-ONS ({addOns.length})</span>

          {addOns.length === 0 ? (
            <div
              style={{
                marginTop: 8,
                fontSize: 'var(--pt-fs-sm)',
                color: 'var(--pt-muted)',
              }}
            >
              No add-ons on this account.
            </div>
          ) : (
            <div className="pt-addons" style={{ marginTop: 10 }}>
              {addOns.map((a) => {
                // Expiry on its own line rather than in a tooltip.
                let when = 'No expiry'
                let note = 'Runs until cancelled'
                if (a.mixedExpiry) {
                  when = a.earliestExpiry ? fmtDate(a.earliestExpiry) : 'Varies'
                  note = 'First to lapse · varies by branch'
                } else if (a.expiryDate) {
                  when = fmtDate(a.expiryDate)
                  note = 'All branches'
                }

                return (
                  <div
                    key={a.addonId}
                    className={`pt-addon ${a.branchesExpired > 0 ? 'is-lapsed' : ''}`}
                  >
                    <span className="pt-addon__icon">
                      <span className="material-icons">extension</span>
                    </span>
                    <span className="pt-addon__body">
                      <span className="pt-addon__name">{a.addonName}</span>
                      <span className="pt-addon__meta">
                        {a.branchesGranted === a.branchesTotal
                          ? `All ${a.branchesTotal} branches`
                          : `${a.branchesGranted} of ${a.branchesTotal} branches`}
                        {a.branchesExpired > 0 && (
                          <span style={{ color: 'var(--pt-red-fg)', fontWeight: 700 }}>
                            {' · '}
                            {a.branchesExpired} lapsed
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="pt-addon__expiry">
                      <strong>{when}</strong>
                      <span>{note}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ marginTop: 22 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            <span className="pt-taglabel">
              MODULES IN YOUR PACKAGE ({moduleNames.length} modules · {modules.length} features)
            </span>
            {moduleNames.length > 0 && (
              <button
                type="button"
                className="pt-btn"
                style={{ height: 32, padding: '0 12px', fontSize: 'var(--pt-fs-xs)' }}
                onClick={() => setOpenMods(allOpen ? [] : moduleNames)}
              >
                {allOpen ? 'Collapse all' : 'Expand all'}
              </button>
            )}
          </div>

          {modules.length === 0 ? (
            <div className="pt-empty">
              No modules are listed for this package. Contact Corebase support if that looks wrong.
            </div>
          ) : (
            <div className="pt-mods">
              {moduleNames.map((name) => {
                const subs = moduleGroups[name]
                const isOpen = openMods.includes(name)
                return (
                  <div key={name} className={`pt-mod ${isOpen ? 'is-open' : ''}`}>
                    <button
                      type="button"
                      className="pt-mod__head"
                      aria-expanded={isOpen}
                      onClick={() => toggleMod(name)}
                    >
                      <span className="pt-mod__name">{name}</span>
                      {subs.length > 0 && <span className="pt-mod__count">{subs.length}</span>}
                      {subs.length > 0 && <span className="material-icons">expand_more</span>}
                    </button>
                    {isOpen && subs.length > 0 && (
                      <div className="pt-mod__body">
                        {subs.map((s) => (
                          <span key={s} className="pt-mod__sub">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default PortalCompanyDetail
