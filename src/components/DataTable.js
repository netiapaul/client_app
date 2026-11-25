import React from 'react'
import PropTypes from 'prop-types'

/** The one admin listing table. */

/** A column header's sort state, as an icon. Absent when the column is not sortable. */
const SortMark = ({ dir }) => (
  <span className="material-icons cb-dt__sort" aria-hidden="true" data-dir={dir || 'none'}>
    {dir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
  </span>
)

SortMark.propTypes = { dir: PropTypes.oneOf(['asc', 'desc', null]) }

const DataTable = ({
  columns,
  rows,
  rowKey,
  loading = false,
  error = '',
  empty,
  search,
  toolbar,
  actions,
  actionsLabel = '',
  onRowClick,
  page,
  pageSizeOptions = [10, 20, 50, 100],
  maxHeight = '58vh',
  dense = true,
  sort,
  rowClassName,
}) => {
  const cols = columns.filter(Boolean)
  const hasActions = typeof actions === 'function'
  const span = cols.length + (hasActions ? 1 : 0)

  // Server-side when the caller passes a `page` contract; otherwise the rows given are all there is.
  const server = !!page
  const total = server ? page.total : rows.length
  const pageSize = server ? page.pageSize : rows.length || 1
  const current = server ? page.page : 1
  const pages = Math.max(1, Math.ceil((total || 0) / (pageSize || 1)))
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)

  const toggleSort = (c) => {
    if (!sort || c.sortable === false || !c.key) return
    const dir = sort.key === c.key && sort.dir === 'asc' ? 'desc' : 'asc'
    sort.onChange({ key: c.key, dir })
  }

  return (
    <div className={`cb-dt${dense ? ' cb-dt--dense' : ''}`}>
      {(search || toolbar) && (
        <div className="cb-dt__toolbar">
          {search && (
            <label className="cb-dt__search">
              <span className="material-icons" aria-hidden="true">
                search
              </span>
              <input
                type="text"
                value={search.value}
                placeholder={search.placeholder || 'Search…'}
                aria-label={search.placeholder || 'Search'}
                onChange={(e) => search.onChange(e.target.value)}
              />
              {search.value && (
                <button
                  type="button"
                  className="cb-dt__clear"
                  aria-label="Clear the search"
                  onClick={() => search.onChange('')}
                >
                  <span className="material-icons" aria-hidden="true">
                    close
                  </span>
                </button>
              )}
            </label>
          )}
          {toolbar && <div className="cb-dt__tools">{toolbar}</div>}
        </div>
      )}

      {error && <div className="alert alert-danger rounded-0 py-1 mb-2 cb-fs-body">{error}</div>}

      <div className="cb-dt__wrap" style={{ maxHeight }}>
        <table className="cb-dt__table">
          <thead>
            <tr>
              {cols.map((c) => {
                const sortable = !!sort && c.sortable !== false && !!c.key
                const dir = sort && sort.key === c.key ? sort.dir : null
                return (
                  <th
                    key={c.key || c.title}
                    style={{ width: c.width, textAlign: c.align }}
                    className={sortable ? 'is-sortable' : undefined}
                    aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    onClick={sortable ? () => toggleSort(c) : undefined}
                    title={c.hint}
                  >
                    <span className="cb-dt__th">
                      {c.icon && (
                        <span className="material-icons cb-dt__thicon" aria-hidden="true">
                          {c.icon}
                        </span>
                      )}
                      {c.title}
                      {sortable && <SortMark dir={dir} />}
                    </span>
                  </th>
                )
              })}
              {hasActions && (
                <th style={{ width: '1%' }} className="text-end">
                  {actionsLabel || <span className="visually-hidden">Actions</span>}
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr className="cb-dt__state">
                <td colSpan={span}>
                  <span className="material-icons cb-dt__spin" aria-hidden="true">
                    progress_activity
                  </span>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="cb-dt__state">
                <td colSpan={span}>
                  <span className="cb-dt__empty">
                    <span className="material-icons" aria-hidden="true">
                      {empty?.icon || 'inbox'}
                    </span>
                    <span className="cb-dt__empty-title">
                      {empty?.title || 'Nothing here yet.'}
                    </span>
                    {empty?.hint && <span className="cb-dt__empty-hint">{empty.hint}</span>}
                  </span>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row, i) : i}
                  className={rowClassName ? rowClassName(row) : undefined}
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                >
                  {cols.map((c) => (
                    <td
                      key={c.key || c.title}
                      style={{ textAlign: c.align }}
                      className={c.nowrap ? 'text-nowrap' : undefined}
                    >
                      {c.render ? c.render(row, i) : row[c.key]}
                    </td>
                  ))}
                  {hasActions && (
                    <td
                      className="cb-dt__actions"
                      // A row that opens on click must not also open when an action inside it is clicked.
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* The flex row lives here rather than in every screen. */}
                      <span className="cb-acts">{actions(row, i)}</span>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {server && total > 0 && (
        <div className="cb-dt__pager">
          <select
            className="cb-dt__size"
            value={page.pageSize}
            aria-label="Rows per page"
            onChange={(e) => page.onPageSize(Number(e.target.value))}
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} rows
              </option>
            ))}
          </select>

          <span className="cb-dt__range">
            {from}-{to} of {total}
          </span>

          {[
            { to: 1, icon: 'first_page', label: 'First page', off: current <= 1 },
            { to: current - 1, icon: 'chevron_left', label: 'Previous page', off: current <= 1 },
            { to: current + 1, icon: 'chevron_right', label: 'Next page', off: current >= pages },
            { to: pages, icon: 'last_page', label: 'Last page', off: current >= pages },
          ].map((b) => (
            <button
              key={b.icon}
              type="button"
              className="cb-dt__pagebtn"
              disabled={loading || b.off}
              aria-label={b.label}
              title={b.label}
              onClick={() => page.onPage(b.to)}
            >
              <span className="material-icons" aria-hidden="true">
                {b.icon}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

DataTable.propTypes = {
  /** key: field name (also the sort key); render(row, i) overrides the raw value. */
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      title: PropTypes.node,
      /** Material icon name shown before the heading. */
      icon: PropTypes.string,
      align: PropTypes.oneOf(['left', 'center', 'right']),
      width: PropTypes.string,
      nowrap: PropTypes.bool,
      sortable: PropTypes.bool,
      hint: PropTypes.string,
      render: PropTypes.func,
    }),
  ).isRequired,
  rows: PropTypes.array.isRequired,
  rowKey: PropTypes.func,
  loading: PropTypes.bool,
  error: PropTypes.string,
  empty: PropTypes.shape({
    icon: PropTypes.string,
    title: PropTypes.node,
    hint: PropTypes.node,
  }),
  search: PropTypes.shape({
    value: PropTypes.string,
    placeholder: PropTypes.string,
    onChange: PropTypes.func.isRequired,
  }),
  toolbar: PropTypes.node,
  actions: PropTypes.func,
  actionsLabel: PropTypes.string,
  onRowClick: PropTypes.func,
  /** Present = server-side paging. Absent = the rows given are the whole list. */
  page: PropTypes.shape({
    page: PropTypes.number.isRequired,
    pageSize: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
    onPage: PropTypes.func.isRequired,
    onPageSize: PropTypes.func.isRequired,
  }),
  pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
  maxHeight: PropTypes.string,
  dense: PropTypes.bool,
  sort: PropTypes.shape({
    key: PropTypes.string,
    dir: PropTypes.oneOf(['asc', 'desc']),
    onChange: PropTypes.func.isRequired,
  }),
  rowClassName: PropTypes.func,
}

export default DataTable
