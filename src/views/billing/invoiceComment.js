import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import RichTextEditor, { renderRichText } from '../../components/RichTextEditor'
const axios = require('axios')

/** The comment printed on an invoice, on a page of its own. */

/** Matches RichText.MaxLength. Counted in HTML, not in visible words — the hint says so. */
const RICH_MAX = 32000

const api = `${process.env.REACT_APP_URL_CONFIG}/api/Invoices`

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})

const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

const PLACEHOLDER = [
  'The wording printed on the invoice, above the standard footer.',
  '',
  'Use Title and Heading for sections, numbered lists for terms, and a divider to separate a',
  'signature block from the terms above it.',
].join('\n')

const InvoiceComment = ({ mode = 'invoice' }) => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isDefault = mode === 'default'
  const canManage = hasModule(MODULES.ManageBilling)

  // The whole settings row, for the default mode only.
  const [settings, setSettings] = useState(null)

  const [invoice, setInvoice] = useState(null)
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (isDefault) {
        const r = await axios.get(`${api}/Settings`, { headers: authHeaders() })
        const s = r.data ?? {}
        setSettings(s)
        setDraft(s.defaultInvoiceComment ?? '')
        setSaved(s.defaultInvoiceComment ?? '')
      } else {
        const r = await axios.get(`${api}/${id}`, { headers: authHeaders() })
        const d = r.data ?? {}
        setInvoice({
          id: d.id,
          invoiceNo: d.invoiceNo,
          companyName: d.companyName,
          status: d.status,
        })
        setDraft(d.comments ?? '')
        setSaved(d.comments ?? '')
      }
    } catch (e) {
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [id, isDefault])

  useEffect(() => {
    load()
  }, [load])

  // DRAFTS ONLY, matching the server.
  const isDraft = isDefault || invoice?.status === 'Draft'
  const editable = canManage && isDraft
  const dirty = draft !== saved
  const tooLong = draft.length > RICH_MAX

  const backTo = isDefault ? '/setup' : '/invoices'
  const backLabel = isDefault ? 'Setup' : 'Proforma Invoices'

  const save = async () => {
    if (tooLong) return
    setSaving(true)
    setError('')
    try {
      if (isDefault) {
        // The full row back, with only the comment changed. See the `settings` note above.
        const r = await axios.post(
          `${api}/Settings`,
          { ...settings, defaultInvoiceComment: draft || null },
          { headers: authHeaders() },
        )
        toast.success(r.data?.message ?? 'Default comment saved.', {
          theme: 'colored',
          autoClose: 6000,
        })
      } else {
        const r = await axios.put(
          `${api}/${id}/Comments`,
          { comments: draft },
          { headers: authHeaders() },
        )
        toast.success(r.data?.message ?? 'Comment saved.', { theme: 'colored', autoClose: 6000 })
      }
      setSaved(draft)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  /** Leaving with unsaved words in the box is the one mistake this page can make that costs. */
  const leave = () => {
    if (dirty && !window.confirm('Leave without saving? The changes to the comment will be lost.'))
      return
    navigate(backTo)
  }

  if (loading) {
    return (
      <>
        <hr className="my-2" />
        <div className="cb-empty">Loading…</div>
      </>
    )
  }

  if (error && !invoice && !settings) {
    return (
      <>
        <hr className="my-2" />
        <div className="alert alert-danger rounded-0 py-2" style={{ fontSize: 12 }}>
          {error}
        </div>
        <Link to={backTo} className="btn btn-sm filter-btn rounded-0">
          Back to {backLabel}
        </Link>
      </>
    )
  }

  return (
    <>
      <div className="app-breadcrumb">
        <button
          type="button"
          className="app-breadcrumb-back"
          title={`Back to ${backLabel}`}
          onClick={leave}
        >
          <span className="material-icons">arrow_back</span>
        </button>
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to={backTo}>{backLabel}</Link>
          </li>
          <li className="breadcrumb-item active">
            {isDefault ? 'Default invoice comment' : `Comment on ${invoice?.invoiceNo ?? ''}`}
          </li>
        </ol>
      </div>

      <div className="cb-page-head">
        <h1 className="cb-page-head__title">
          {isDefault ? 'Default invoice comment' : 'Comment printed on this invoice'}
          <span className="cb-page-head__sub">
            {isDefault ? 'Applies to invoices raised from now on' : invoice?.companyName}
          </span>
        </h1>
        <div className="cb-page-head__actions">
          {editable && (
            <button
              type="button"
              className="btn btn-sm add-btn rounded-0"
              disabled={saving || !dirty || tooLong}
              onClick={save}
            >
              {saving ? 'Saving…' : dirty ? 'Save comment' : 'Saved'}
            </button>
          )}
          <button type="button" className="btn btn-sm cancel-btn rounded-0" onClick={leave}>
            {editable ? 'Close' : 'Back'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger rounded-0 py-1 mb-2" style={{ fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* The one thing somebody has to know BEFORE typing, in each mode. */}
      <div className="alert alert-info rounded-0 py-2 mb-2" style={{ fontSize: 12 }}>
        {isDefault ? (
          <>
            This is the wording every new invoice <strong>starts</strong> with. It is copied onto
            each invoice as that invoice is raised and then belongs to it, so changing this affects
            the <strong>next</strong> invoice and never one a client is already holding. A single
            draft can still be given different wording from its own screen.
          </>
        ) : (
          <>
            This wording belongs to <strong>{invoice?.invoiceNo}</strong> alone. It started as the
            default in Invoice settings and changing it here changes nothing else.
          </>
        )}
      </div>

      {!isDraft && (
        <div className="alert alert-warning rounded-0 py-2 mb-2" style={{ fontSize: 12 }}>
          <strong>
            {invoice?.invoiceNo} is {String(invoice?.status ?? '').toLowerCase()}.
          </strong>{' '}
          The client has this document, so the wording is fixed — it is shown here read-only. Cancel
          the invoice and raise a replacement if it is wrong.
        </div>
      )}

      {isDraft && !canManage && (
        <div className="alert alert-warning rounded-0 py-2 mb-2" style={{ fontSize: 12 }}>
          You can read this comment but not change it — that needs the Manage Billing right.
        </div>
      )}

      {/* WRITE ON THE LEFT, PRINT ON THE RIGHT. */}
      <div className="row g-2">
        <div className="col-lg-7">
          <div className="cb-card h-100">
            <div className="cb-card__body">
              <div className="divider mb-2">Write</div>

              {editable ? (
                <RichTextEditor
                  id="invoice-comment"
                  value={draft}
                  maxLength={RICH_MAX}
                  minHeight={520}
                  ariaLabel={isDefault ? 'Default invoice comment' : 'Comment on this invoice'}
                  placeholder={PLACEHOLDER}
                  onChange={setDraft}
                />
              ) : (
                <div
                  className="cb-fs-body rte-view"
                  dangerouslySetInnerHTML={{ __html: renderRichText(draft) }}
                />
              )}

              {editable && (
                <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
                  <span className="cb-fs-meta text-muted me-auto">
                    Printed above the standard footer on the PDF. Clear the box to print none.
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm add-btn rounded-0"
                    disabled={saving || !dirty || tooLong}
                    onClick={save}
                  >
                    {saving ? 'Saving…' : 'Save comment'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm cancel-btn rounded-0"
                    disabled={saving || !dirty}
                    onClick={() => setDraft(saved)}
                  >
                    Discard changes
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="cb-card h-100">
            <div className="cb-card__body">
              <div className="divider mb-2">How it will print</div>

              {draft ? (
                // The same stored HTML the PDF renders, through the same rules.
                <div className="cmt-paper">
                  <div
                    className="rte-view"
                    dangerouslySetInnerHTML={{ __html: renderRichText(draft) }}
                  />
                </div>
              ) : (
                <div className="cb-empty">
                  Nothing is written, so the invoice prints no comment at all.
                </div>
              )}

              <span className="cb-fs-meta text-muted d-block mt-2">
                The standard footer — what settling the invoice actually does — still prints below
                this, whatever is written here.
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

InvoiceComment.propTypes = {
  /** 'invoice' edits one draft's comment and takes its id from the route. */
  mode: PropTypes.oneOf(['invoice', 'default']),
}

export default InvoiceComment
