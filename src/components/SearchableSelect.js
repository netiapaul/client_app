import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

/**
 * A lightweight searchable dropdown (type-to-filter) with no extra dependencies.
 * Shows the option label, but reports the option id back through onChange, so it is a
 * drop-in replacement for a native <select> whose value is an id.
 *
 * The option menu is rendered through a portal to <body> with fixed positioning, so it is never
 * clipped by a scrollable/overflow container and always sits above modals (incl. stacked modals) —
 * important because these pickers are used inside the Add Branch / Create Client modals.
 *
 * options   array of option objects
 * value     currently selected id (string/number, or '' for none)
 * onChange  called with the picked id as a string ('' when cleared)
 * getId     option -> id      (default: o.id)
 * getLabel  option -> label   (default: o.name)
 */
const SearchableSelect = ({ options, value, onChange, getId, getLabel, placeholder, disabled }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState(null) // { top, left, width } in viewport coords
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const menuRef = useRef(null)

  const idOf = getId || ((o) => o.id)
  const labelOf = getLabel || ((o) => o.name)

  const selected = (options || []).find((o) => String(idOf(o)) === String(value))
  const display = selected ? labelOf(selected) : ''

  const reposition = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.bottom, left: r.left, width: r.width })
  }, [])

  const openMenu = () => {
    if (disabled) return
    setQuery('')
    reposition()
    setOpen(true)
  }
  const closeMenu = () => {
    setOpen(false)
    setQuery('')
  }

  // While open: keep the menu glued to the input on scroll/resize, and close on outside click.
  useEffect(() => {
    if (!open) return
    const onMove = () => reposition()
    const onDocDown = (e) => {
      const inWrap = wrapRef.current && wrapRef.current.contains(e.target)
      const inMenu = menuRef.current && menuRef.current.contains(e.target)
      if (!inWrap && !inMenu) closeMenu()
    }
    window.addEventListener('scroll', onMove, true) // capture: catches modal-body scroll too
    window.addEventListener('resize', onMove)
    document.addEventListener('mousedown', onDocDown)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      document.removeEventListener('mousedown', onDocDown)
    }
  }, [open, reposition])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? (options || []).filter((o) => labelOf(o).toLowerCase().includes(q))
    : options || []

  // The menu is portaled to <body> with inline styles, so pick colours from the current theme.
  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('theme-dark')
  const C = isDark
    ? { bg: '#1e2129', border: '#333945', hover: '#2d323d', divider: '#333945', text: '#e4e6eb' }
    : { bg: '#fff', border: '#ced4da', hover: '#fff6ef', divider: '#eee', text: 'inherit' }

  const menu =
    open && !disabled && pos
      ? ReactDOM.createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 2000, // above CoreUI/Bootstrap modals (~1055) and stacked modals
              maxHeight: 220,
              overflowY: 'auto',
              background: C.bg,
              color: C.text,
              border: `1px solid ${C.border}`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            {selected && (
              <div
                className="px-2 py-1 text-muted"
                style={{ cursor: 'pointer', fontSize: 12, borderBottom: `1px solid ${C.divider}` }}
                onMouseDown={() => {
                  onChange('')
                  closeMenu()
                }}
              >
                Clear selection
              </div>
            )}
            {filtered.length === 0 && (
              <div className="px-2 py-1 text-muted" style={{ fontSize: 12 }}>
                No matches
              </div>
            )}
            {filtered.map((o) => {
              const active = String(idOf(o)) === String(value)
              return (
                <div
                  key={idOf(o)}
                  className="px-2 py-1"
                  style={{
                    cursor: 'pointer',
                    fontSize: 12,
                    background: active ? C.hover : 'transparent',
                  }}
                  onMouseDown={() => {
                    onChange(String(idOf(o)))
                    closeMenu()
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = active ? C.hover : 'transparent')
                  }
                >
                  {labelOf(o)}
                </div>
              )
            })}
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        className="form-control form-control-sm rounded-0"
        // When open the user is typing a filter; when closed it shows the selection.
        value={open ? query : display}
        // While open with an empty query, remind the user of the current selection.
        placeholder={open && selected ? labelOf(selected) : placeholder}
        disabled={disabled}
        autoComplete="off"
        onFocus={openMenu}
        onChange={(e) => {
          setQuery(e.target.value)
          if (!open) openMenu()
        }}
      />
      {menu}
    </div>
  )
}

SearchableSelect.propTypes = {
  options: PropTypes.array,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  getId: PropTypes.func,
  getLabel: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
}

export default SearchableSelect
