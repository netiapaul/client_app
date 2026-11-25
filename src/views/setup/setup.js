import React, { useState, useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import SmtpSettings from './smtpSettings'
import SmsSettings from './smsSettings'
import MpesaSettings from './mpesaSettings'
import PaymentMethods from './paymentMethods'
import InvoiceSettings from './invoiceSettings'
import BillingAutomation from './billingAutomation'

/** Setup — every integration and letterhead setting in one place. */
const SECTIONS = [
  {
    key: 'email',
    label: 'Email',
    sub: 'Outgoing mail server',
    icon: 'email',
    modules: [MODULES.ManageSmtp],
    Component: SmtpSettings,
  },
  {
    key: 'sms',
    label: 'SMS',
    sub: "Africa's Talking gateway",
    icon: 'sms',
    // The same right as email, by the user's decision.
    modules: [MODULES.ManageSmtp],
    Component: SmsSettings,
  },
  {
    key: 'methods',
    label: 'Payment methods',
    sub: 'What is accepted, and by whom',
    icon: 'account_balance_wallet',
    modules: [MODULES.RecordPayments],
    Component: PaymentMethods,
  },
  {
    key: 'mpesa',
    label: 'M-PESA',
    sub: 'Safaricom Daraja',
    icon: 'smartphone',
    // RecordPayments, not ViewPayments: these credentials authorise taking money.
    modules: [MODULES.RecordPayments],
    Component: MpesaSettings,
  },
  {
    // Add-on PRICING is not here: it lives under Billing, beside Billing profiles.
    key: 'invoice',
    label: 'Invoice details',
    sub: 'Letterhead and how to pay',
    icon: 'receipt_long',
    // Readable with ViewBilling — it is what customers already see on their own invoices.
    modules: [MODULES.ViewBilling, MODULES.ManageBilling],
    Component: InvoiceSettings,
  },
  {
    // The switches that decide whether the nightly run bills anybody.
    key: 'automation',
    label: 'Billing automation',
    sub: 'Invoicing and reminders',
    icon: 'schedule',
    modules: [MODULES.ViewBilling, MODULES.ManageBilling],
    Component: BillingAutomation,
  },
]

const Setup = () => {
  const location = useLocation()
  const navigate = useNavigate()

  // Any-of, matching how RequireModule gates the endpoints behind them.
  const available = useMemo(() => SECTIONS.filter((s) => s.modules.some((m) => hasModule(m))), [])

  const wanted = new URLSearchParams(location.search).get('s')
  const current = available.find((s) => s.key === wanted) ?? available[0] ?? null

  // Each panel reports whether it is actually configured, so the tabs can say so at a glance.
  const [status, setStatus] = useState({})

  const report = useCallback(
    (key) => (s) =>
      setStatus((prev) =>
        // Compared before setting: a panel that reports on every render would otherwise loop.
        prev[key]?.ok === s?.ok && prev[key]?.label === s?.label ? prev : { ...prev, [key]: s },
      ),
    [],
  )

  if (available.length === 0) {
    return (
      <>
        <div className="cb-page-head">
          <h1 className="cb-page-head__title">
            <span className="material-icons">settings</span>
            Setup
          </h1>
        </div>
        <div className="alert alert-secondary rounded-0 py-2 cb-fs-body">
          You do not have rights to change any of these settings.
        </div>
      </>
    )
  }

  const Panel = current.Component

  return (
    <>
      <div className="cb-page-head">
        <h1 className="cb-page-head__title">
          <span className="material-icons">settings</span>
          Setup
          <span className="cb-page-head__sub">{current.sub}</span>
        </h1>
      </div>

      {/* The section picker. */}
      <div className={`email-stats${available.length === 5 ? ' email-stats--five' : ''}`}>
        {available.map((s) => {
          const st = status[s.key]

          return (
            <button
              key={s.key}
              type="button"
              className={`email-stat email-stat--setup ${
                st == null ? 'is-all' : st.ok ? 'is-sent' : 'is-pending'
              }${current.key === s.key ? ' active' : ''}`}
              onClick={() => navigate(`/setup?s=${s.key}`)}
            >
              <span className="email-stat__icon">
                <span className="material-icons">{s.icon}</span>
              </span>
              <span className="email-stat__body">
                <span className="email-stat__value">{s.label}</span>
                <span className="email-stat__label">{st?.label ?? 'Checking…'}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Mounted per section rather than all four hidden. */}
      <Panel key={current.key} onStatus={report(current.key)} />
    </>
  )
}

export default Setup
