// Colour theme (light / dark).

const KEY = 'theme'
const CLASS = 'theme-dark'

export const isDark = () => document.documentElement.classList.contains(CLASS)

export const setDark = (dark) => {
  document.documentElement.classList.toggle(CLASS, dark)
  localStorage.setItem(KEY, dark ? 'dark' : 'light')
  return dark
}

export const toggleDark = () => setDark(!isDark())
