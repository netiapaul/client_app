import React, { useState } from 'react'
import { isDark, toggleDark } from '../utils/theme'

// Header button that toggles light/dark mode. The choice is remembered across sessions
// and applied before first paint in index.js. The mechanism itself lives in utils/theme,
// shared with the client portal's own toggle.
const ThemeToggle = () => {
  const [dark, setDark] = useState(isDark)

  const toggle = () => setDark(toggleDark())

  return (
    <button
      type="button"
      className="btn btn-sm theme-toggle rounded-0 d-flex align-items-center"
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle color theme"
    >
      <span className="material-icons" style={{ fontSize: 20 }}>
        {dark ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  )
}

export default ThemeToggle
