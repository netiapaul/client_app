import React from 'react'
import PropTypes from 'prop-types'

/** The filter bar and the pager for the portal's listings — TWO components, deliberately. */

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

/** What is being looked at: which rows, and over what dates. */
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

  // Deliberately NO upper bound.

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

          {/* Only when something is actually narrowed. */}
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

/** Which page, of how many. */
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
