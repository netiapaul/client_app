import React, { useState, useRef, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'

// The component owns its stylesheet, which is the whole point of it living here.
//
// It used to sit in views/clients/ and be imported only by createClient.js. That screen is a LAZY
// route, so its CSS only reached the browser once somebody had opened Create Client — and every
// other screen using this picker rendered the same markup with no styles behind it: no floating
// panel, no border, no scroll cap, just a bare table shoving the page down. Importing it here
// means the styling arrives with the component, wherever it is used.
import './ClientPicker.css'

/**
 * Pick a client, the way Create Client does it.
 *
 * A read-only box that opens a searchable panel listing the accounts as a TABLE — code, company,
 * branch and whatever else the caller asks for. A plain <select> of 191 companies is unusable, and
 * a bare code box means knowing the code by heart; this lets someone search by whichever of those
 * they happen to have.
 *
 * Extracted from createClient.js, where it was inline, so the payments and simulation screens get
 * the same thing rather than a second picker that looks almost like it. The `.client-picker` /
 * `.picker-panel` styling already exists for that screen and is reused as-is.
 *
 * `columns` keeps it general: the caller says which fields to show and how to render them, so a
 * billing screen can show the outstanding balance where Create Client shows a serial number.
 */
const ClientPicker = ({
  options,
  value,
  onChange,
  getId,
  getLabel,
  columns,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  searchFields,
  id,
}) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  // Close when the click lands outside the picker.
  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  const filtered = useCallback(() => {
    const term = search.trim().toLowerCase()
    if (!term) return options
    return options.filter((o) =>
      (searchFields ?? []).some((f) =>
        String(f(o) ?? '')
          .toLowerCase()
          .includes(term),
      ),
    )
  }, [options, search, searchFields])

  const selected = options.find((o) => String(getId(o)) === String(value))

  return (
    <div className="client-picker" ref={ref}>
      <input
        type="text"
        id={id}
        className="form-control form-control-sm rounded-0"
        placeholder={placeholder}
        autoComplete="off"
        readOnly
        disabled={disabled}
        // The selected label, not the raw id — the box should read as the thing chosen.
        value={selected ? getLabel(selected) : ''}
        onClick={() => {
          if (disabled) return
          setOpen(true)
          setSearch('')
        }}
      />
      {open && !disabled && (
        <div className="picker-panel">
          <div className="search">
            <input
              type="text"
              className="form-control form-control-sm rounded-0"
              placeholder={searchPlaceholder}
              autoComplete="off"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="list">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.title}>{c.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered().map((o, i) => (
                  <tr
                    key={getId(o) ?? i}
                    className="pick"
                    onClick={() => {
                      onChange(getId(o), o)
                      setOpen(false)
                      setSearch('')
                    }}
                  >
                    {columns.map((c) => (
                      <td key={c.title}>{c.render(o)}</td>
                    ))}
                  </tr>
                ))}
                {filtered().length === 0 && (
                  <tr className="empty">
                    <td colSpan={columns.length}>{emptyText}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

ClientPicker.propTypes = {
  options: PropTypes.array,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** Receives (id, theWholeOption) — the second saves the caller looking it up again. */
  onChange: PropTypes.func.isRequired,
  getId: PropTypes.func.isRequired,
  /** What the closed box reads, once something is chosen. */
  getLabel: PropTypes.func.isRequired,
  columns: PropTypes.arrayOf(PropTypes.shape({ title: PropTypes.string, render: PropTypes.func }))
    .isRequired,
  /** Which fields the search looks at. Without these, typing filters nothing. */
  searchFields: PropTypes.arrayOf(PropTypes.func),
  placeholder: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  emptyText: PropTypes.string,
  disabled: PropTypes.bool,
  id: PropTypes.string,
}

ClientPicker.defaultProps = {
  options: [],
  placeholder: 'Select a client…',
  searchPlaceholder: 'Search code or company…',
  emptyText: 'No matching clients.',
}

export default ClientPicker
