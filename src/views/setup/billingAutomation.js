import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import { toast } from 'react-toastify'
import useConfirm from '../../components/useConfirm'
const axios = require('axios')

/**
 * Billing automation — whether the nightly run actually bills anybody.
 *
 * These three switches were appsettings keys, which meant switching invoicing on required editing
 * a file on the server and restarting the API. That is the wrong shape for a decision taken the
 * day prices are finally in place, and badly wrong for the reverse: something billing or texting
 * wrongly at 2am needs an off switch somebody can reach.
 *
 * They are read from the database on EVERY run, not captured at startup, so switching one back off
 * takes effect tonight.
 *
 * The screen's job is to make the consequence visible before the click. Each switch says plainly
 * what it will do, "Raise invoices" shows how many clients would actually be billed tonight and
 * how many have no price, and the two that reach customers ask for confirmation.
 */
const BillingAutomation = ({ onStatus }) => {
  const api = `${process.env.REACT_APP_URL_CONFIG}/api/Invoices`
  const canManage = hasModule(MODULES.ManageBilling)

  const [confirm, confirmDialog] = useConfirm()

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    [],
  )
  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const [cfg, setCfg] = useState(null)

  // A dry run of the pre-expiry sweep. Allowed while the switch is OFF, which is the point:
  // "how many clients would this message, and which?" has to be answerable before anyone
  // starts texting customers.
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await axios.get(`${api}/Automation`, { headers: authHeaders() })
      setCfg(r.data)
      setError('')
    } catch (e) {
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [api, authHeaders])

  useEffect(() => {
    load()
  }, [load])

  /**
   * Report upward for the Setup tab strip.
   *
   * "Off" is a legitimate, deliberate state rather than a problem — so it is not flagged as an
   * error. What IS worth flagging is generation on while clients have no price, because that
   * combination bills fewer people than whoever threw the switch probably expects.
   */
  useEffect(() => {
    if (!cfg || !onStatus) return

    const on = cfg.generateInvoices || cfg.sendReminders

    onStatus({
      ok: cfg.generateInvoices,
      label: !cfg.generateInvoices
        ? 'Invoicing off'
        : cfg.sendReminders
        ? 'On — invoicing and reminders'
        : 'On — invoicing only',
      warn: on && (cfg.clientsNotPriced ?? 0) > 0,
    })
  }, [cfg, onStatus])

  const save = async (next, confirmWith) => {
    if (confirmWith && !(await confirm(confirmWith))) return

    setSaving(true)
    setError('')
    try {
      const r = await axios.post(`${api}/Automation`, next, { headers: authHeaders() })
      toast.success(r.data?.message ?? 'Saved.', { theme: 'colored', autoClose: 7000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  const runExpiryPreview = async () => {
    setPreviewing(true)
    setError('')
    try {
      const r = await axios.post(`${api}/ExpiryReminders/Preview`, null, {
        headers: authHeaders(),
      })
      setPreview(r.data)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setPreviewing(false)
    }
  }

  if (loading) return <div className="cb-empty">Loading…</div>
  if (!cfg) return <div className="alert alert-danger rounded-0 py-2 cb-fs-body">{error}</div>

  const toggle = (field, confirmWith) =>
    save({ ...cfg, [field]: !cfg[field] }, cfg[field] ? null : confirmWith)

  return (
    <div>
      {confirmDialog}

      {error && <div className="alert alert-danger rounded-0 py-2 cb-fs-body">{error}</div>}

      <p className="cb-fs-meta text-muted">
        Nothing here is on when the system is first deployed. Each switch is read fresh on every
        run, so turning one off takes effect from the next run rather than the next deploy.
      </p>

      <Switch
        id="ba-generate"
        label="Raise invoices automatically"
        on={cfg.generateInvoices}
        disabled={!canManage || saving}
        onChange={() =>
          toggle('generateInvoices', {
            title: 'Start billing automatically?',
            body:
              `The nightly run will raise invoices from tonight. ` +
              `${cfg.clientsReadyToInvoice ?? 0} client(s) would be invoiced on the next run.`,
            detail:
              (cfg.clientsNotPriced ?? 0) > 0
                ? `${cfg.clientsNotPriced} client(s) have no price set and will be skipped — ` +
                  'the generator never sees an unpriced client. Set prices under Billing profiles ' +
                  'if they should be billed.'
                : undefined,
            confirmText: 'Switch it on',
          })
        }
      >
        The run raises an invoice for every company whose renewal falls inside its lead time.
        {cfg.clientsReadyToInvoice !== null && cfg.clientsReadyToInvoice !== undefined && (
          <>
            {' '}
            <strong>{cfg.clientsReadyToInvoice}</strong> would be billed on the next run
            {(cfg.clientsNotPriced ?? 0) > 0 && (
              <>
                , and <strong>{cfg.clientsNotPriced}</strong> skipped for having no price
              </>
            )}
            .
          </>
        )}
      </Switch>

      <Switch
        id="ba-autoissue"
        label="Issue them without review"
        on={cfg.autoIssue}
        disabled={!canManage || saving}
        onChange={() =>
          toggle('autoIssue', {
            title: 'Issue invoices without anyone checking?',
            body:
              'Issuing is what emails the invoice to the customer. A draft can be corrected ' +
              'quietly; an issued invoice has already landed in somebody’s inbox.',
            detail:
              'Individual clients can be set to auto-issue on their billing profile instead, ' +
              'which is the safer way in — watch a client for a cycle, then switch that one on.',
            danger: true,
            confirmText: 'Issue automatically',
          })
        }
      >
        Deployment-wide. Off, invoices are raised as drafts for someone to check and issue. A
        client’s own billing profile can switch this on for just that client.
      </Switch>

      <Switch
        id="ba-reminders"
        label="Chase overdue invoices"
        on={cfg.sendReminders}
        disabled={!canManage || saving}
        onChange={() =>
          toggle('sendReminders', {
            title: 'Start chasing overdue invoices?',
            body:
              'Overdue clients will be emailed and texted daily, starting from the due date. ' +
              'Every text is billed and reaches a real customer.',
            detail: `Each invoice is chased at most ${cfg.maxReminders} time(s) before it is left to a person.`,
            danger: true,
            confirmText: 'Start chasing',
          })
        }
      >
        Daily, by email and SMS, from the due date onward.
      </Switch>

      <div className="row g-2 mt-2">
        <div className="col-sm-4">
          <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="ba-max">
            Chase at most
          </label>
          <div className="d-flex gap-1">
            <input
              id="ba-max"
              type="number"
              min="1"
              max="60"
              className="form-control form-control-sm rounded-0"
              value={cfg.maxReminders}
              disabled={!canManage || saving}
              onChange={(e) => setCfg({ ...cfg, maxReminders: Number(e.target.value) })}
            />
            <button
              type="button"
              className="btn btn-sm add-btn rounded-0"
              disabled={!canManage || saving}
              onClick={() => save(cfg)}
            >
              Save
            </button>
          </div>
          <span className="cb-fs-meta text-muted">
            times per invoice, then it is left to a person.
          </span>
        </div>
      </div>

      {/* A SEPARATE switch from the chase above, because the two say opposite things: that one
          tells a client they are late, this one tells them a renewal is coming. */}
      <Switch
        id="ba-expiry-reminders"
        label="Remind clients before expiry"
        on={cfg.sendExpiryReminders}
        disabled={!canManage || saving}
        onChange={() =>
          toggle('sendExpiryReminders', {
            title: 'Start reminding clients before expiry?',
            body:
              'Clients will be emailed and texted ahead of their licence expiry, with the ' +
              'proforma invoice attached once it has been raised. Every text is billed and ' +
              'reaches a real customer.',
            detail: `Sent ${
              cfg.expiryReminderDays || '7,3'
            } day(s) before expiry — once each, not daily.`,
            danger: true,
            confirmText: 'Start reminding',
          })
        }
      >
        Before the due date, by email and SMS. Separate from the chase above — this one tells a
        client a renewal is coming, not that they are late.
      </Switch>

      <div className="row g-2 mt-2">
        <div className="col-sm-4">
          <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="ba-expiry-days">
            Remind
          </label>
          <div className="d-flex gap-1">
            <input
              id="ba-expiry-days"
              type="text"
              className="form-control form-control-sm rounded-0"
              placeholder="7,3"
              value={cfg.expiryReminderDays ?? ''}
              disabled={!canManage || saving}
              onChange={(e) => setCfg({ ...cfg, expiryReminderDays: e.target.value })}
            />
            <button
              type="button"
              className="btn btn-sm add-btn rounded-0"
              disabled={!canManage || saving}
              onClick={() => save(cfg)}
            >
              Save
            </button>
          </div>
          {/* The server sorts, de-duplicates and drops anything out of range, so a typo here
              cannot produce a reminder a year early or a stream of them. Said so nobody treats
              the box as more fragile than it is. */}
          <span className="cb-fs-meta text-muted">
            days before expiry, comma separated. Only exact matches fire, so a client gets one
            message per entry.
          </span>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-center mt-2">
        <button
          type="button"
          className="btn btn-sm filter-btn rounded-0"
          disabled={previewing}
          onClick={runExpiryPreview}
        >
          {previewing ? 'Checking…' : 'Who would be reminded today?'}
        </button>
        {preview && (
          <span className="cb-fs-meta text-muted">
            <strong>{preview.sent}</strong> client(s) would be messaged
            {preview.skipped > 0 && <> · {preview.skipped} skipped</>}
            {' · offsets '}
            {(preview.offsets ?? []).join(' and ')} day(s)
            {/* Zero is the ordinary answer on most days — only clients landing EXACTLY on an
                offset fire — so it has to read as information, not as something broken. */}
            {preview.sent === 0 && (
              <> — nobody expires exactly that far out today, which is the usual case.</>
            )}
          </span>
        )}
      </div>

      {preview?.candidates?.length > 0 && (
        <div className="cb-table-wrap mt-2" style={{ maxHeight: '30vh', overflowY: 'auto' }}>
          <table className="table table-sm cb-table mb-0">
            <thead>
              <tr>
                <th>Client</th>
                <th style={{ width: '1%' }}>Expires</th>
                <th style={{ width: '1%' }}>Days</th>
                <th>Proforma</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {preview.candidates.map((c) => (
                <tr key={`${c.cusCode}-${c.daysBefore}`} className={c.willSend ? '' : 'text-muted'}>
                  <td>
                    <span className="d-block">{c.companyName || c.cusCode}</span>
                    <span className="d-block cb-fs-meta text-muted">{c.productName}</span>
                  </td>
                  <td className="cb-fs-meta text-nowrap">
                    {new Date(c.expiryDate).toLocaleDateString()}
                  </td>
                  <td className="cb-fs-meta text-end">{c.daysBefore}</td>
                  <td className="cb-fs-meta">
                    {c.invoiceNo ?? (
                      // Ordinary at seven days out, and worth saying — otherwise it reads as a
                      // missing invoice rather than one not yet due to be raised.
                      <span className="text-muted">not raised yet</span>
                    )}
                  </td>
                  <td className="cb-fs-meta">
                    {c.willSend ? (
                      <span className="text-success fw-bold">
                        Would be reminded
                        {c.paysByStandingOrder && (
                          <span className="text-muted"> · standing order wording</span>
                        )}
                      </span>
                    ) : (
                      c.skipReason
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Read-only: Quartz has to be rescheduled to honour a change, so an editable field here
          would lie until the next restart. Shown because "when does this run?" is the obvious
          next question once the switch is on. */}
      <div className="cb-fs-meta text-muted mt-3 pt-2 border-top">
        <div>
          Invoice run: <code>{cfg.generateCron || 'not scheduled'}</code> · Reminder run:{' '}
          <code>{cfg.reminderCron || 'not scheduled'}</code>
        </div>
        <div>
          Schedules are set in configuration and need a restart to change.
          {cfg.isSaved ? (
            <>
              {' '}
              Last changed {new Date(cfg.updatedAt).toLocaleString()} by {cfg.updatedBy}.
            </>
          ) : (
            ' Never configured — everything is at its default of off.'
          )}
        </div>
      </div>
    </div>
  )
}

/** One labelled switch with its consequence spelled out underneath. */
const Switch = ({ id, label, on, disabled, onChange, children }) => (
  <div className="d-flex gap-2 align-items-start py-2 border-bottom">
    <div className="form-check form-switch mb-0" style={{ minWidth: 42 }}>
      <input
        className="form-check-input"
        type="checkbox"
        role="switch"
        id={id}
        checked={!!on}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
    <label
      className="flex-grow-1"
      htmlFor={id}
      style={{ cursor: disabled ? 'default' : 'pointer' }}
    >
      <span className="cb-fs-body fw-semibold d-block">
        {label}
        <span
          className={`badge ms-2 ${on ? 'bg-success' : 'bg-secondary'}`}
          style={{ fontSize: 9 }}
        >
          {on ? 'ON' : 'OFF'}
        </span>
      </span>
      <span className="cb-fs-meta text-muted d-block">{children}</span>
    </label>
  </div>
)

Switch.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  on: PropTypes.bool,
  disabled: PropTypes.bool,
  onChange: PropTypes.func,
  children: PropTypes.node,
}

BillingAutomation.propTypes = {
  onStatus: PropTypes.func,
}

export default BillingAutomation
