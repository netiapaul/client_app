import React from 'react'
import PropTypes from 'prop-types'

/**
 * The filter bar and the pager for the portal's listings — TWO components, deliberately.
 *
 * They were one, with the pager half meant to be the only thing rendered when it was placed below
 * the table. That is not what happened: the preset row is built from a module constant rather than
 * a prop, so it rendered every time, and the date picker appeared a second time underneath the
 * rows. It also put two elements with id="pt-from" on the page, which is invalid and left both
 * labels pointing at the first input.
 *
 * Two components cannot do that. The filters are rendered once, above; the pager once, below.
 *
 * Both are shared by invoices and receipts because those two must behave IDENTICALLY — somebody
 * who learns the control on one page should not have to relearn it on the other, and two copies of
 * a date-range widget drift apart on the first fix.
 *
 * Paging and filtering are both SERVER-side. The parent owns the page number and refetches, which
 * is also why the status/method filters moved to the server: applied in the browser they would
 * have filtered the current page only, so "To pay" on page one would silently omit the unpaid rows
 * on page two.
 */

/** Local-date ISO (yyyy-MM-dd) for a date input. `toISOString` would shift by the UTC offset. */
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
    2,
    '0',
  )}`

const PRESETS = [
  { key: 'all', label: 'All time' },
  { key: 'year', label: 'This year' },
  { key: '12m', label: 'Last 12 months' },
  { key: '30d', label: 'Last 30 days' },
]

/** What each preset means as a concrete range. Empty strings mean "unbounded that side". */
export const rangeOf = (key) => {
  const now = new Date()

  switch (key) {
    case 'year':
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) }
    case '12m': {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() - 1)
      return { from: iso(d), to: iso(now) }
    }
    case '30d': {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      return { from: iso(d), to: iso(now) }
    }
    default:
      return { from: '', to: '' }
  }
}

const box = {
  height: 38,
  padding: '0 10px',
  font: 'inherit',
  fontSize: 'var(--pt-fs-sm)',
  color: 'var(--pt-ink)',
  background: 'var(--pt-surface)',
  border: '1px solid var(--pt-border)',
  borderRadius: 10,
  outline: 'none',
}

const labelStyle = { fontSize: 'var(--pt-fs-xs)', color: 'var(--pt-muted)' }

/**
 * What is being looked at: which rows, and over what dates.
 *
 * The presets exist because almost nobody types a date range. "This year" and "Last 12 months"
 * answer the two questions actually asked (a tax year, and recent history); the explicit boxes
 * stay visible rather than hiding behind a "custom" toggle, so the presets are a shortcut rather
 * than a mode.
 */
export const PortalListFilters = ({
  views,
  view,
  onView,
  preset,
  from,
  to,
  onPreset,
  onFrom,
  onTo,
  earliest,
  label,
  busy,
  idPrefix = 'pt',
}) => {
  // The oldest row the account has, so the picker cannot offer an empty decade below it.
  const min = earliest ? earliest.slice(0, 10) : undefined

  // Deliberately NO upper bound. An invoice for a future period is normal here — the generator
  // raises one before the period starts — so clamping to the newest row would refuse a date that
  // has perfectly good rows above it.

  const narrowed = !!from || !!to || (view && view !== views?.[0]?.key)

  const fromId = `${idPrefix}-from`
  const toId = `${idPrefix}-to`

  return (
    <>
      {(views ?? []).length > 0 && (
        <div
          className="pt-filters"
          role="group"
          aria-label={`Filter ${label}`}
          style={{ flexWrap: 'wrap' }}
        >
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              aria-pressed={view === v.key}
              disabled={busy}
              onClick={() => onView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      <div
        className="pt-filters"
        role="group"
        aria-label={`Date range for ${label}`}
        style={{ flexWrap: 'wrap' }}
      >
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={preset === p.key}
            disabled={busy}
            onClick={() => onPreset(p.key)}
          >
            {p.label}
          </button>
        ))}

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 'auto',
            flexWrap: 'wrap',
          }}
        >
          <label htmlFor={fromId} style={labelStyle}>
            From
          </label>
          <input
            id={fromId}
            type="date"
            style={box}
            value={from}
            min={min}
            disabled={busy}
            onChange={(e) => onFrom(e.target.value)}
          />
          <label htmlFor={toId} style={labelStyle}>
            to
          </label>
          <input
            id={toId}
            type="date"
            style={box}
            value={to}
            min={from || min}
            disabled={busy}
            onChange={(e) => onTo(e.target.value)}
          />

          {/* Only when something is actually narrowed — a permanently visible Clear invites a
              click that does nothing and makes the unfiltered state look filtered. */}
          {narrowed && (
            <button type="button" className="pt-btn pt-btn--sm" onClick={() => onPreset('all')}>
              <span className="material-icons">close</span>
              Clear
            </button>
          )}
        </span>
      </div>
    </>
  )
}

PortalListFilters.propTypes = {
  views: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, label: PropTypes.string })),
  view: PropTypes.string,
  onView: PropTypes.func,

  preset: PropTypes.string,
  from: PropTypes.string,
  to: PropTypes.string,
  onPreset: PropTypes.func,
  onFrom: PropTypes.func,
  onTo: PropTypes.func,

  earliest: PropTypes.string,

  /** For the aria labels — "invoices", "payments". */
  label: PropTypes.string,
  busy: PropTypes.bool,

  /** Namespaces the input ids, so two of these on one page could never collide again. */
  idPrefix: PropTypes.string,
}

/**
 * Which page, of how many.
 *
 * Renders NOTHING when everything fits on one page. A pager reading "Page 1 of 1" is furniture
 * that teaches people to ignore the place where paging appears.
 */
export const PortalListPager = ({ page, pageSize, matchingRows, onPage, busy }) => {
  if (!matchingRows || matchingRows <= pageSize) return null

  const pages = Math.max(1, Math.ceil(matchingRows / pageSize))
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, matchingRows)

  return (
    <div className="pt-pager">
      <span className="pt-pager__count">
        {first}–{last} of {matchingRows}
      </span>

      <span className="pt-pager__buttons">
        <button
          type="button"
          className="pt-btn pt-btn--sm"
          disabled={page <= 1 || busy}
          aria-label="First page"
          onClick={() => onPage(1)}
        >
          <span className="material-icons">first_page</span>
        </button>
        <button
          type="button"
          className="pt-btn pt-btn--sm"
          disabled={page <= 1 || busy}
          aria-label="Previous page"
          onClick={() => onPage(page - 1)}
        >
          <span className="material-icons">chevron_left</span>
        </button>

        <span className="pt-pager__page">
          Page {page} of {pages}
        </span>

        <button
          type="button"
          className="pt-btn pt-btn--sm"
          disabled={page >= pages || busy}
          aria-label="Next page"
          onClick={() => onPage(page + 1)}
        >
          <span className="material-icons">chevron_right</span>
        </button>
        <button
          type="button"
          className="pt-btn pt-btn--sm"
          disabled={page >= pages || busy}
          aria-label="Last page"
          onClick={() => onPage(pages)}
        >
          <span className="material-icons">last_page</span>
        </button>
      </span>
    </div>
  )
}

PortalListPager.propTypes = {
  page: PropTypes.number,
  pageSize: PropTypes.number,
  matchingRows: PropTypes.number,
  onPage: PropTypes.func,
  busy: PropTypes.bool,
}
