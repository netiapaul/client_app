import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { CModal, CModalBody } from '@coreui/react'
import './DocumentViewer.css'

/* DocumentViewer — reads a document on screen instead of downloading a file to find out. */

const DocumentViewer = ({
  visible,
  onClose,
  title,
  subtitle,
  badge,
  url,
  token,
  panel,
  actions,
  reloadToken,
}) => {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible || !url) return

    let cancelled = false
    setLoading(true)
    setError('')

    fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/html' } })
      .then(async (res) => {
        // The endpoint answers text/html on success and JSON on failure.
        const body = await res.text()
        if (cancelled) return

        if (!res.ok) {
          let message = `Could not load this document (${res.status}).`
          try {
            message = JSON.parse(body)?.message || message
          } catch {
            /* not JSON — keep the status-based message */
          }
          setError(message)
          setHtml('')
          return
        }

        setHtml(body)
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Could not load this document.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    // A late response for a document the user already closed must not overwrite the current one.
    return () => {
      cancelled = true
    }
    // reloadToken is the whole point of the dependency: changing it re-fetches.
  }, [visible, url, token, reloadToken])

  return (
    <CModal visible={visible} onClose={onClose} size="xl" alignment="center" className="dv">
      {/* Not CModalHeader: its close button and padding are built for a form. */}
      <div className="dv__head">
        <div className="dv__ident">
          <span className="dv__ref">{title}</span>
          {subtitle && <span className="dv__sub">{subtitle}</span>}
        </div>
        {badge}
        <button type="button" className="dv__x" aria-label="Close" onClick={onClose}>
          <span className="material-icons">close</span>
        </button>
      </div>

      <CModalBody className="p-0">
        <div className="dv__stage">
          {loading && (
            <div className="dv__state">
              <span className="material-icons dv__spin">progress_activity</span>
              <span>Loading the document…</span>
            </div>
          )}

          {!loading && error && (
            <div className="dv__state dv__state--error">
              <span className="material-icons">error_outline</span>
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && html && (
            <iframe
              className="dv__frame"
              title={title}
              srcDoc={html}
              sandbox=""
              // referrerPolicy is belt and braces.
              referrerPolicy="no-referrer"
            />
          )}
        </div>

        {panel}
      </CModalBody>

      {actions && <div className="dv__actions">{actions}</div>}
    </CModal>
  )
}

DocumentViewer.propTypes = {
  visible: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  /** The document's reference — an invoice number. */
  title: PropTypes.string.isRequired,
  /** Secondary heading text — the client's name. */
  subtitle: PropTypes.string,
  /** A status chip rendered beside the reference. */
  badge: PropTypes.node,
  /** Absolute URL returning text/html, requiring a bearer token. */
  url: PropTypes.string,
  token: PropTypes.string,
  /** Rendered under the document — the comment editor on an invoice. */
  panel: PropTypes.node,
  /** Buttons along the bottom — typically "Download PDF". */
  actions: PropTypes.node,
  /** Change this to re-fetch the document, e.g. after editing what is printed on it. */
  reloadToken: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
}

export default DocumentViewer
