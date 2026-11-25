import React, { useState, useRef, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'

// The component owns its stylesheet, which is the whole point of it living here.
import './ClientPicker.css'

/** Pick a client, the way Create Client does it. */
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
