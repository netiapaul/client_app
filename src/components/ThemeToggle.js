import React, { useState } from 'react'

// Applies the theme to <html> and persists the choice.
const applyTheme = (dark) => {
  document.documentElement.classList.toggle('theme-dark', dark)
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

// Header button that toggles light/dark mode. The choice is remembered across sessions
// and applied before first paint in index.js.
const ThemeToggle = () => {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('theme-dark'))

  const toggle = () => {
    const next = !dark
    setDark(next)
    applyTheme(next)
  }

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
