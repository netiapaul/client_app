// Money formatting and parsing.
//
// Shared because every billing screen — profiles now, invoices, receipts and payments next — has to
// render and accept the same shapes, and an amount that groups one way on one screen and another
// way on the next reads as two different systems.
//
// The locale is PINNED to en-KE rather than left to the browser. `toLocaleString(undefined, …)`
// follows the reader's machine, so a laptop set to German renders "10.000,00" — digits grouped by
// full stop and decimals by comma. For a figure labelled KES that is not a cosmetic difference; it
// is a different number to anyone reading quickly.

const LOCALE = 'en-KE'
export const DEFAULT_CURRENCY = 'KES'

const grouper = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "KES 10,000.00". Null/undefined render as an em dash, never as "0". */
export const formatMoney = (amount, currency = DEFAULT_CURRENCY) => {
  if (amount === null || amount === undefined || amount === '') return '—'
  const n = Number(amount)
  if (Number.isNaN(n)) return '—'
  return `${currency || DEFAULT_CURRENCY} ${grouper.format(n)}`
}

/** "10,000.00" — the number alone, for a column that already has a currency header. */
export const formatAmount = (amount) => {
  if (amount === null || amount === undefined || amount === '') return '—'
  const n = Number(amount)
  return Number.isNaN(n) ? '—' : grouper.format(n)
}

/**
 * Reduce typed text to a plain numeric string: digits, at most one decimal point, at most two
 * decimal places. Keeps a trailing "." so "10." can be typed on the way to "10.5", and keeps the
 * empty string rather than coercing it to 0 — an empty box means "nothing entered yet", which is
 * not the same as zero.
 */
export const cleanNumeric = (text) => {
  if (text === null || text === undefined) return ''
  let s = String(text).replace(/[^\d.]/g, '')

  // Only the first decimal point survives; later ones are dropped rather than rejected, so
  // fat-fingering a second "." doesn't wipe what was already typed.
  const first = s.indexOf('.')
  if (first !== -1) {
    s = s.slice(0, first + 1) + s.slice(first + 1).replace(/\./g, '')
    const [whole, dec] = s.split('.')
    s = `${whole}.${(dec ?? '').slice(0, 2)}`
  }

  // "007" -> "7", but "0" and "0.5" are left alone.
  if (/^0\d/.test(s)) s = s.replace(/^0+/, '')
  return s
}

/** Add thousands separators to the whole part, leaving any part-typed decimal untouched. */
export const groupDigits = (numericText) => {
  const s = cleanNumeric(numericText)
  if (s === '') return ''
  const [whole, dec] = s.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return s.includes('.') ? `${grouped}.${dec ?? ''}` : grouped
}

/** Count the characters that survive cleaning — used to keep the caret where the typist left it. */
export const countNumericChars = (text) => (String(text ?? '').match(/[\d.]/g) || []).length

/**
 * Where the caret belongs in a freshly grouped string, given how many numeric characters sat
 * before it. Without this the caret jumps to the end on every keystroke that inserts a comma.
 */
export const caretAfterNumericChars = (formatted, count) => {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/[\d.]/.test(formatted[i])) {
      seen++
      if (seen === count) return i + 1
    }
  }
  return formatted.length
}

/** A number for sending to the API, or null when the box is empty / unparseable. */
export const parseAmount = (text) => {
  const s = cleanNumeric(text)
  if (s === '' || s === '.') return null
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}
