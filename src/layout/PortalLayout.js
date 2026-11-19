import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { getToken, clearSession, isPortalUser, getName } from '../utils/session'
import { portalGet, readErr, PortalSessionEnded, initialsOf } from '../utils/portalApi'
import { isDark, toggleDark } from '../utils/theme'
import swal from 'sweetalert'

// A plain fallback, not the app's PageLoader: that one is an overlay driven by the global loading
// tracker and renders null unless the tracker is active, so as a Suspense fallback it would show
// nothing at all while a chunk downloads.
const chunkLoading = <div className="pt-empty">Loading…</div>

const PortalDashboard = React.lazy(() => import('../views/portal/portalDashboard'))
const PortalCompanies = React.lazy(() => import('../views/portal/portalCompanies'))
const PortalCompanyDetail = React.lazy(() => import('../views/portal/portalCompanyDetail'))
const PortalPassword = React.lazy(() => import('../views/portal/portalPassword'))
const PortalInvoices = React.lazy(() => import('../views/portal/portalInvoices'))
const PortalReceipts = React.lazy(() => import('../views/portal/portalReceipts'))
const PortalPay = React.lazy(() => import('../views/portal/portalPay'))
const PortalProfile = React.lazy(() => import('../views/portal/portalProfile'))

/**
 * The client portal shell — dark navigation rail against a light workspace, per the Phase 1 designs.
 *
 * Deliberately NOT DefaultLayout. That is the staff shell (admin sidebar, module-gated nav,
 * breadcrumbs) and serving any of it to a customer would be both confusing and a disclosure of how
 * the back office is organised.
 *
 * It owns two things no individual screen should have to repeat:
 *
 *  - The forced password change. An account created by an admin starts on a temporary password and
 *    the server refuses every other portal endpoint until it is replaced, so the shell renders ONLY
 *    the change-password screen until that is done.
 *  - Session ending. A 401 anywhere means the token expired or the account was disabled; the shell
 *    signs out rather than leaving a screen stuck on an error it cannot clear.
 *
 * Invoices, receipts and payments are live. They were built to shape first, carrying no figures
 * while the ledger behind them was a later increment, and badged "soon" in the rail — the badge
 * and the banners are gone now that each one reads real data. `pt-navlink__badge` is kept in the
 * markup for the next page that needs it.
 */
const PortalLayout = () => {
  const navigate = useNavigate()

  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // The portal gets its own theme control in the rail — it never renders the admin header, so the
  // toggle there is unreachable from here. Both go through utils/theme, so a customer and a staff
  // user flipping it mean the same thing and the choice persists either way.
  const [dark, setDark] = useState(isDark)

  // Two doors out, deliberately. `signOut` is the immediate one and is what the session-expiry and
  // wrong-audience paths call — asking "are you sure?" about a session that has already ended would
  // be nonsense. `confirmSignOut` is the one behind the button, and matches the admin header's
  // confirm (same sweetalert, same wording) so leaving works the same way in both halves.
  const signOut = useCallback(() => {
    clearSession()
    navigate('/', { replace: true })
  }, [navigate])

  const confirmSignOut = useCallback(() => {
    swal({
      title: 'Log out?',
      text: 'You will need to sign in again to see your companies and licences.',
      icon: 'warning',
      buttons: ['Cancel', 'Log out'],
      dangerMode: true,
    }).then((confirmed) => {
      if (confirmed) signOut()
    })
  }, [signOut])

  const loadMe = useCallback(async () => {
    setLoading(true)
    try {
      setMe(await portalGet('/Auth/Me'))
      setError('')
    } catch (e) {
      if (e instanceof PortalSessionEnded) {
        signOut()
        return
      }
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [signOut])

  useEffect(() => {
    // A staff session reaching a /portal URL gets bounced: the portal is not an alternative view of
    // the admin app, and the server would refuse these endpoints for a staff token anyway.
    if (!getToken() || !isPortalUser()) {
      navigate('/', { replace: true })
      return
    }
    loadMe()
  }, [loadMe, navigate])

  const name = me?.name || getName() || ''
  const gated = !!me?.mustChangePassword

  // Collapsed to icons. Remembered, so someone who prefers the narrow rail is not re-collapsing it
  // on every visit — the same courtesy the staff sidebar gets.
  const [railNarrow, setRailNarrow] = useState(
    () => localStorage.getItem('portalRailCollapsed') === '1',
  )

  const toggleRail = () =>
    setRailNarrow((n) => {
      localStorage.setItem('portalRailCollapsed', n ? '0' : '1')
      return !n
    })

  const nav = [
    { to: '/portal', icon: 'dashboard', label: 'Dashboard', end: true },
    { to: '/portal/companies', icon: 'business', label: 'My companies' },
    { to: '/portal/invoices', icon: 'description', label: 'Proforma invoices' },
    // "Payments", not "Receipts". What this page holds are CONFIRMATIONS that money arrived;
    // the official receipt is issued by finance afterwards, and a nav item labelled Receipts
    // promises the wrong document. The ROUTE keeps its name — it is linked from emails already.
    { to: '/portal/receipts', icon: 'receipt_long', label: 'Payments' },
    { to: '/portal/pay', icon: 'credit_card', label: 'Make a payment' },
  ]

  /**
   * The forced password change is a GATE, not a page inside the portal — so it does not get the
   * portal's furniture.
   *
   * It used to render inside the full shell with the rail still showing: brand, support card,
   * signed-in footer, theme and sign-out. The navigation itself was hidden, but everything around
   * it said "you are in", which is exactly what someone on a temporary password is not. Every
   * endpoint behind it is refused anyway, so the shell was advertising doors that do not open.
   *
   * This is the sign-in page's shape instead: one centred card and nothing else. Sign out stays,
   * because it is the only legitimate way off this screen.
   */
  if (!loading && gated) {
    return (
      <div className="pt pt-gate">
        <div className="pt-gate__card">
          <div className="pt-gate__brand">
            <span className="pt-rail__mark">pC</span>
            <span>
              <span className="pt-gate__name">Client Portal</span>
              <span className="pt-gate__tag">Licences &amp; subscriptions</span>
            </span>
          </div>

          <PortalPassword forced onDone={loadMe} />

          <div className="pt-gate__foot">
            <span>
              Signed in as <strong>{name}</strong>
            </span>
            <button type="button" className="pt-gate__out" onClick={signOut}>
              <span className="material-icons">logout</span>
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt">
      <aside className={`pt-rail${railNarrow ? ' pt-rail--narrow' : ''}`}>
        <div className="pt-rail__brand">
          <span className="pt-rail__mark">pC</span>
          <span style={{ minWidth: 0 }}>
            <span className="pt-rail__name">Client Portal</span>
            <span className="pt-rail__tag">Licences &amp; subscriptions</span>
          </span>
          {/* Collapses the rail to icons, the same idea as the hamburger on the staff side. Hidden
              on phones, where the rail is already a horizontal strip and there is nothing to
              collapse. */}
          <button
            type="button"
            className="pt-rail__collapse"
            aria-label={railNarrow ? 'Expand the menu' : 'Collapse the menu'}
            aria-expanded={!railNarrow}
            title={railNarrow ? 'Expand the menu' : 'Collapse the menu'}
            onClick={toggleRail}
          >
            <span className="material-icons">{railNarrow ? 'chevron_right' : 'chevron_left'}</span>
          </button>
        </div>

        {/* No `!gated` guard needed: the forced change returns its own page above, so reaching
            here already means the account is through it. */}
        {me && (
          <nav className="pt-rail__nav" aria-label="Main">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className="pt-navlink"
                // Collapsed there is no label, so the CSS pops this out beside the icon. A data
                // attribute rather than `title`, or the browser's tooltip doubles up on it.
                data-label={n.label}
              >
                <span className="material-icons">{n.icon}</span>
                {n.label}
                {n.soon && <span className="pt-navlink__badge">soon</span>}
              </NavLink>
            ))}
            <NavLink to="/portal/profile" className="pt-navlink" data-label="Profile">
              <span className="material-icons">person</span>
              Profile
            </NavLink>
          </nav>
        )}

        <div className="pt-rail__foot">
          <div className="pt-rail__help">
            <strong>Need a hand?</strong>
            <span>
              Our support team can help with licences, branches and billing. Reply to any Corebase
              email and it reaches us.
            </span>
          </div>

          <div className="pt-rail__me">
            <span className="pt-rail__avatar">{initialsOf(name)}</span>
            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--pt-on-dark)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {name}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--pt-on-dark-dim)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {me?.email}
              </span>
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button
                type="button"
                className="pt-icon-btn"
                title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label="Toggle colour theme"
                aria-pressed={dark}
                onClick={() => setDark(toggleDark())}
              >
                <span className="material-icons">{dark ? 'light_mode' : 'dark_mode'}</span>
              </button>
              <button
                type="button"
                className="pt-icon-btn"
                title="Sign out"
                aria-label="Sign out"
                onClick={confirmSignOut}
              >
                <span className="material-icons">logout</span>
              </button>
            </span>
          </div>
        </div>
      </aside>

      <main className="pt-main">
        {error && <div className="pt-note pt-note--amber">{error}</div>}

        {loading ? (
          <div className="pt-empty">Loading…</div>
        ) : (
          <Suspense fallback={chunkLoading}>
            <Routes>
              <Route index element={<PortalDashboard />} />
              <Route path="companies" element={<PortalCompanies />} />
              <Route path="companies/:cuscode" element={<PortalCompanyDetail />} />
              <Route path="profile" element={<PortalProfile />} />
              {/* The old Password route kept as a redirect so an existing bookmark still lands. */}
              <Route path="password" element={<Navigate to="/portal/profile" replace />} />
              <Route path="invoices" element={<PortalInvoices />} />
              <Route path="receipts" element={<PortalReceipts />} />
              <Route path="pay" element={<PortalPay />} />
              {/* Anything else inside /portal goes to the dashboard rather than a blank screen. */}
              <Route path="*" element={<Navigate to="/portal" replace />} />
            </Routes>
          </Suspense>
        )}
      </main>
    </div>
  )
}

export default PortalLayout
