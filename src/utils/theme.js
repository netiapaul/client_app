// Colour theme (light / dark).
//
// The mechanism: a `theme-dark` class on <html>, persisted under the `theme` key, and applied in
// index.js before first paint so there is no flash of light UI. This module is the single place
// that knows any of that — the admin header toggle and the portal rail toggle both go through it
// rather than each poking localStorage and classList.

const KEY = 'theme'
const CLASS = 'theme-dark'

export const isDark = () => document.documentElement.classList.contains(CLASS)

export const setDark = (dark) => {
  document.documentElement.classList.toggle(CLASS, dark)
  localStorage.setItem(KEY, dark ? 'dark' : 'light')
  return dark
}

export const toggleDark = () => setDark(!isDark())
