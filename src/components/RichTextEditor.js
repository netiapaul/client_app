import React, { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import './RichTextEditor.css'

/* RichTextEditor — a small formatting box for the few fields that end up printed on a document. */

/** The tags RichText.cs keeps. Anything else is unwrapped, keeping its text. */
const ALLOWED = new Set([
  'P',
  'BR',
  'DIV',
  'SPAN',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'S',
  'UL',
  'OL',
  'LI',
  'H1',
  'H2',
  'H3',
  'H4',
  'HR',
  'A',
  'BLOCKQUOTE',
])

/** Mirrors the server's AllowedCssProperties. */
const ALLOWED_STYLES = ['text-align', 'font-weight', 'font-style', 'text-decoration']

const SAFE_SCHEME = /^(https?:|mailto:|tel:)/i

/** Clean a fragment to the allow-list, in the DOM rather than with regexes. */
const clean = (html) => {
  const host = document.createElement('div')
  host.innerHTML = html || ''

  host
    .querySelectorAll('script,style,meta,link,title,img,iframe,object,embed')
    .forEach((n) => n.remove())

  // Snapshot before mutating: unwrapping edits the tree we are walking.
  Array.from(host.querySelectorAll('*')).forEach((el) => {
    if (!el.isConnected) return

    if (!ALLOWED.has(el.tagName)) {
      el.replaceWith(...el.childNodes)
      return
    }

    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase()
      if (name === 'href' && el.tagName === 'A') {
        if (!SAFE_SCHEME.test(attr.value.trim())) el.removeAttribute('href')
        return
      }
      if (name === 'title') return
      if (name === 'style') return // handled below
      el.removeAttribute(attr.name)
    })

    if (el.hasAttribute('style')) {
      const keep = ALLOWED_STYLES.map((p) => {
        const v = el.style.getPropertyValue(p)
        return v ? `${p}: ${v}` : null
      })
        .filter(Boolean)
        .join('; ')

      if (keep) el.setAttribute('style', keep)
      else el.removeAttribute('style')
    }

    // A link that lost its href is no longer a link.
    if (el.tagName === 'A' && !el.hasAttribute('href')) el.replaceWith(...el.childNodes)
  })

  return host.innerHTML
}

/** Render a STORED value for display, mirroring RichText.ToHtml on the server. */
export const renderRichText = (stored) => {
  if (!stored) return ''

  const hasTags =
    /<\s*\/?\s*(p|br|div|span|strong|b|em|i|u|s|ul|ol|li|h1|h2|h3|h4|hr|a|blockquote)\b/i.test(
      stored,
    )

  if (!hasTags) {
    return stored
      .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
      .replace(/\r?\n/g, '<br/>')
  }

  return clean(stored)
}

/** Is there anything to read, once the tags are gone? An empty box still emits `<p><br></p>`. */
const isEmpty = (html) => {
  if (!html) return true
  const host = document.createElement('div')
  host.innerHTML = html
  return !host.textContent.trim()
}

const RichTextEditor = ({
  value,
  onChange,
  disabled,
  placeholder,
  minHeight,
  maxLength,
  id,
  ariaLabel,
}) => {
  const ref = useRef(null)

  // What we last PUT INTO the box.
  const emitted = useRef(null)
  const [focused, setFocused] = useState(false)

  // What the caret is sitting in, for the style select.
  const [block, setBlock] = useState('p')

  // The last selection inside the box.
  const savedRange = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const incoming = value || ''
    if (incoming === emitted.current) return
    el.innerHTML = incoming
    emitted.current = incoming
  }, [value])

  const emit = useCallback(() => {
    const el = ref.current
    if (!el) return
    const html = clean(el.innerHTML)
    const next = isEmpty(html) ? '' : html
    emitted.current = next
    onChange(next)
  }, [onChange])

  /** Which of the five block styles the caret is in. queryCommandValue('formatBlock'). */
  const rememberRange = useCallback(() => {
    const el = ref.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return

    // Only a range INSIDE this box.
    const range = sel.getRangeAt(0)
    if (el.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange()
  }, [])

  const restoreRange = useCallback(() => {
    const el = ref.current
    const range = savedRange.current
    if (!el || !range || !el.contains(range.commonAncestorContainer)) return

    const sel = window.getSelection()
    if (!sel) return
    sel.removeAllRanges()
    sel.addRange(range)
  }, [])

  const syncBlock = useCallback(() => {
    if (!ref.current) return
    let current = ''
    try {
      current = (document.queryCommandValue('formatBlock') || '').toLowerCase()
    } catch {
      current = ''
    }
    setBlock(['h1', 'h2', 'h3', 'h4'].includes(current) ? current : 'p')
  }, [])

  /** Apply a command, then emit. focus() first because clicking the toolbar moves focus off. */
  const run = (cmd, arg) => {
    if (disabled) return
    ref.current?.focus()
    restoreRange()
    document.execCommand(cmd, false, arg)
    emit()
    rememberRange()
    syncBlock()
  }

  const addLink = () => {
    if (disabled) return
    const sel = window.getSelection()?.toString()
    // eslint-disable-next-line no-alert
    const url = window.prompt(
      sel ? `Link "${sel}" to which address?` : 'Paste the address to link to:',
      'https://',
    )
    if (!url) return

    const trimmed = url.trim()
    if (!SAFE_SCHEME.test(trimmed)) {
      // Said rather than dropped: a link that vanishes unexplained reads as a broken editor.
      // eslint-disable-next-line no-alert
      window.alert('Links must start with http://, https://, mailto: or tel:')
      return
    }

    ref.current?.focus()
    if (sel) document.execCommand('createLink', false, trimmed)
    else document.execCommand('insertHTML', false, `<a href="${trimmed}">${trimmed}</a>`)
    emit()
  }

  /** Paste is where the mess comes from, so it is intercepted rather than left to the browser. */
  const onPaste = (e) => {
    if (disabled) return
    e.preventDefault()

    const html = e.clipboardData?.getData('text/html')
    if (html) {
      document.execCommand('insertHTML', false, clean(html))
    } else {
      const text = e.clipboardData?.getData('text/plain') || ''
      document.execCommand(
        'insertHTML',
        false,
        text
          .split(/\r?\n/)
          .map((line) =>
            line.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])),
          )
          .join('<br/>'),
      )
    }
    emit()
  }

  // Ctrl/Cmd shortcuts are handled by the browser's own execCommand defaults.

  const length = (value || '').length
  const over = maxLength ? length > maxLength : false
  const showPlaceholder = !focused && isEmpty(value)

  const Btn = ({ cmd, arg, icon, label, onClick }) => (
    <button
      type="button"
      className="rte__btn"
      title={label}
      aria-label={label}
      disabled={disabled}
      // Keeps the selection inside the box: a plain click would blur it first.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick ? onClick : () => run(cmd, arg)}
    >
      <span className="material-icons">{icon}</span>
    </button>
  )

  Btn.propTypes = {
    cmd: PropTypes.string,
    arg: PropTypes.string,
    icon: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func,
  }

  return (
    <div className={`rte${disabled ? ' rte--disabled' : ''}${over ? ' rte--over' : ''}`}>
      <div className="rte__bar">
        {/* A SELECT rather than four more icon buttons. */}
        <select
          className="rte__block"
          title="Text style"
          aria-label="Text style"
          disabled={disabled}
          value={block}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => run('formatBlock', `<${e.target.value}>`)}
        >
          <option value="p">Normal text</option>
          <option value="h1">Title</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
          <option value="h4">Label</option>
        </select>
        <span className="rte__sep" />
        <Btn cmd="bold" icon="format_bold" label="Bold (Ctrl+B)" />
        <Btn cmd="italic" icon="format_italic" label="Italic (Ctrl+I)" />
        <Btn cmd="underline" icon="format_underlined" label="Underline (Ctrl+U)" />
        <span className="rte__sep" />
        <Btn cmd="insertUnorderedList" icon="format_list_bulleted" label="Bulleted list" />
        <Btn cmd="insertOrderedList" icon="format_list_numbered" label="Numbered list" />
        <Btn cmd="insertHorizontalRule" icon="horizontal_rule" label="Divider line" />
        <span className="rte__sep" />
        <Btn icon="link" label="Add a link" onClick={addLink} />
        <Btn cmd="unlink" icon="link_off" label="Remove the link" />
        <span className="rte__sep" />
        <Btn cmd="removeFormat" icon="format_clear" label="Clear formatting" />
      </div>

      <div className="rte__wrap" style={{ minHeight: minHeight || 110 }}>
        {showPlaceholder && placeholder && <div className="rte__ph">{placeholder}</div>}
        <div
          id={id}
          ref={ref}
          className="rte__box"
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          onInput={() => {
            emit()
            syncBlock()
          }}
          onBlur={() => {
            // Remembered BEFORE the blur takes effect.
            rememberRange()
            setFocused(false)
            emit()
          }}
          onFocus={() => {
            setFocused(true)
            syncBlock()
          }}
          // Clicking or arrowing into a heading has to move the style select.
          onKeyUp={() => {
            rememberRange()
            syncBlock()
          }}
          onMouseUp={() => {
            rememberRange()
            syncBlock()
          }}
          onPaste={onPaste}
        />
      </div>

      {/* Only once it is worth knowing. */}
      {maxLength && length > maxLength * 0.7 && (
        <div className={`rte__count${over ? ' rte__count--over' : ''}`}>
          {length} / {maxLength}
          {over && ' — too long to save, including the formatting'}
        </div>
      )}
    </div>
  )
}

RichTextEditor.propTypes = {
  /** Sanitised HTML. '' when empty — never '<p><br></p>'. */
  value: PropTypes.string,
  /** Called with cleaned HTML, or '' when the box has no text left in it. */
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  minHeight: PropTypes.number,
  /** Counted in CHARACTERS OF HTML, matching the column — that is why the hint says so. */
  maxLength: PropTypes.number,
  id: PropTypes.string,
  ariaLabel: PropTypes.string,
}

export default RichTextEditor
