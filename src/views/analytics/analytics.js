import React, { useState, useEffect, useCallback, useRef } from 'react'
import { CRow, CCol, CSpinner } from '@coreui/react'
import { CChartLine, CChartDoughnut } from '@coreui/react-chartjs'
import PropTypes from 'prop-types'
import { getToken } from '../../utils/session'
import moment from 'moment'

const axios = require('axios')
const BASE_URL = process.env.REACT_APP_URL_CONFIG
const POLL_MS = 30000

const RANGES = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
]

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})
const readErr = (e) =>
  e?.response?.data?.message || e?.request?.response || `${e?.code}: ${e?.message}`

// Theme colours (match $success-color / #e0a800 / $danger-color in _custom.scss).
const GOOD = '#2eb85c'
const WARN = '#e0a800'
const BAD = '#e55353'
const ACCENT = '#F58B40'

// Red when scarce/busy, amber mid, green healthy. `invert` for "free" metrics (disk free: high = good).
const healthColor = (pct, invert = false) => {
  const v = invert ? 100 - pct : pct
  if (v >= 90) return BAD
  if (v >= 75) return WARN
  return GOOD
}
const healthTone = (pct) => (pct >= 90 ? 'is-danger' : pct >= 75 ? 'is-warning' : 'is-success')

// Chart.js can't read CSS variables, so mirror the light/dark tokens from _darkmode.scss here.
const chartTheme = (dark) => ({
  text: dark ? '#e4e6eb' : '#22304a',
  muted: dark ? '#9aa3b2' : '#8a94a6',
  grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(34,48,74,0.07)',
  surface: dark ? '#1e2129' : '#ffffff',
  tooltipBg: dark ? '#2d323d' : '#22304a',
  memory: dark ? '#6b8fff' : '#2962ff',
  palette: dark
    ? ['#F58B40', '#6b8fff', '#d9a066', '#3dc4d8', '#a78bfa', '#f0c03a', '#94a3b8', '#f06595']
    : ['#F58B40', '#2962ff', '#c58c4f', '#17a2b8', '#8b5cf6', '#e0a800', '#64748b', '#d6336c'],
})

const alertKinds = {
  RamHigh: { label: 'High memory', color: '#2962ff', icon: 'memory' },
  DiskLow: { label: 'Low disk', color: '#c58c4f', icon: 'storage' },
  CpuHigh: { label: 'High CPU', color: ACCENT, icon: 'speed' },
  Unreachable: { label: 'Unreachable', color: BAD, icon: 'cloud_off' },
  ProvisioningFailed: { label: 'Provisioning failed', color: '#8b5cf6', icon: 'error_outline' },
}
const kindOf = (k) => alertKinds[k] || { label: k, color: '#a1aab2', icon: 'notifications' }

// Tracks the `.theme-dark` class ThemeToggle puts on <html>, so charts re-colour on toggle.
const useIsDark = () => {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('theme-dark'))
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => setDark(el.classList.contains('theme-dark')))
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

const hexToRgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// Vertical fade under a line series.
const fadeFill =
  (hex, alpha) =>
  ({ chart }) => {
    const { ctx, chartArea } = chart
    if (!chartArea) return hexToRgba(hex, alpha / 2)
    const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
    g.addColorStop(0, hexToRgba(hex, alpha))
    g.addColorStop(1, hexToRgba(hex, 0))
    return g
  }

const tooltipOptions = (t) => ({
  backgroundColor: t.tooltipBg,
  titleColor: '#fff',
  bodyColor: '#e4e6eb',
  borderColor: 'rgba(255,255,255,0.08)',
  borderWidth: 1,
  padding: 10,
  cornerRadius: 6,
  boxPadding: 4,
  usePointStyle: true,
})

const Analytics = () => {
  const isDark = useIsDark()
  const theme = chartTheme(isDark)
  const [overview, setOverview] = useState([])
  const [alerts, setAlerts] = useState([])
  const [alertFilter, setAlertFilter] = useState('active')
  const [selectedId, setSelectedId] = useState(null)
  const [range, setRange] = useState('24h')
  const [series, setSeries] = useState(null)
  const [loadingSeries, setLoadingSeries] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [err, setErr] = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)
  const selectedRef = useRef(null)
  const rangeRef = useRef(range)
  selectedRef.current = selectedId
  rangeRef.current = range

  const loadOverview = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BASE_URL}/api/Analytics/Overview`, {
        headers: authHeaders(),
      })
      setOverview(Array.isArray(data) ? data : [])
      setErr('')
      // Auto-select the first server on first load.
      if (!selectedRef.current && Array.isArray(data) && data.length) {
        setSelectedId(data[0].serverId)
      }
    } catch (e) {
      setErr(readErr(e))
    }
  }, [])

  const loadAlerts = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BASE_URL}/api/Analytics/Alerts?take=100`, {
        headers: authHeaders(),
      })
      setAlerts(Array.isArray(data) ? data : [])
    } catch (e) {
      /* non-fatal for the page */
    }
  }, [])

  // `silent` refreshes the chart in place instead of swapping it for a spinner.
  const loadSeries = useCallback(async (serverId, rng, silent = false) => {
    if (!serverId) return
    if (!silent) setLoadingSeries(true)
    try {
      const { data } = await axios.get(
        `${BASE_URL}/api/Analytics/Series?serverId=${serverId}&range=${rng}`,
        { headers: authHeaders() },
      )
      setSeries(data)
    } catch (e) {
      setErr(readErr(e))
      if (!silent) setSeries(null)
    } finally {
      if (!silent) setLoadingSeries(false)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      loadOverview(),
      loadAlerts(),
      selectedRef.current && loadSeries(selectedRef.current, rangeRef.current, true),
    ])
    setRefreshing(false)
    setLastRefresh(new Date())
  }, [loadOverview, loadAlerts, loadSeries])

  // Initial load.
  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  // Next auto-refresh is scheduled from the last one, so a manual refresh restarts the countdown.
  useEffect(() => {
    if (!lastRefresh) return undefined
    const id = setTimeout(refreshAll, POLL_MS)
    return () => clearTimeout(id)
  }, [lastRefresh, refreshAll])

  // Reload the chart whenever the selected server or range changes.
  useEffect(() => {
    if (selectedId) loadSeries(selectedId, range)
  }, [selectedId, range, loadSeries])

  const acknowledge = async (id) => {
    try {
      await axios.post(
        `${BASE_URL}/api/Analytics/Alerts/${id}/Acknowledge`,
        {},
        { headers: authHeaders() },
      )
      loadAlerts()
    } catch (e) {
      setErr(readErr(e))
    }
  }

  const points = series?.points || []
  const labelFmt = range === '24h' ? 'HH:mm' : 'DD MMM HH:00'
  const labels = points.map((p) => moment(p.t).format(labelFmt))
  const selected = overview.find((s) => s.serverId === selectedId)

  // Fleet-wide figures for the KPI row.
  const online = overview.filter((s) => s.reachable)
  const totalDbs = overview.reduce((n, s) => n + (s.clientDbCount || 0), 0)
  const avg = (key) =>
    online.length ? Math.round(online.reduce((n, s) => n + (s[key] || 0), 0) / online.length) : 0
  const avgCpu = avg('cpuPercent')
  const avgRam = avg('ramUsedPercent')
  const activeAlerts = alerts.filter((a) => a.isActive)
  const criticalCount = activeAlerts.filter((a) => a.severity === 'Critical').length
  const shownAlerts = alertFilter === 'active' ? activeAlerts : alerts

  const alertsByKind = Object.entries(
    activeAlerts.reduce((acc, a) => ({ ...acc, [a.alertKind]: (acc[a.alertKind] || 0) + 1 }), {}),
  ).map(([k, value]) => ({ label: kindOf(k).label, color: kindOf(k).color, value }))

  const lineOptions = (yMax = 100) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { color: theme.text, usePointStyle: true, pointStyle: 'circle', boxWidth: 6 },
      },
      tooltip: {
        ...tooltipOptions(theme),
        callbacks: { label: (c) => ` ${c.dataset.label}: ${c.formattedValue}%` },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: theme.grid },
        ticks: { color: theme.muted, maxTicksLimit: 8, autoSkip: true, maxRotation: 0 },
      },
      y: {
        beginAtZero: true,
        max: yMax,
        grid: { color: theme.grid },
        border: { display: false },
        ticks: { color: theme.muted, stepSize: 25, callback: (v) => v + '%' },
      },
    },
    elements: {
      point: { radius: 0, hoverRadius: 4, hitRadius: 8 },
      line: { tension: 0.35, borderWidth: 2 },
    },
  })

  const lineDataset = (label, color, data) => ({
    label,
    data,
    borderColor: color,
    backgroundColor: fadeFill(color, isDark ? 0.3 : 0.18),
    pointBackgroundColor: color,
    fill: true,
  })

  return (
    <div className="an-page">
      {/* Header */}
      <div className="an-header">
        <div>
          <h4 className="an-header__title">
            <span className="material-icons">insights</span>
            Server Analytics
          </h4>
          <div className="an-header__sub">
            Live health, trends and spike alerts across all provisioning servers.
          </div>
        </div>
        <div className="an-header__actions">
          <RefreshControl
            lastRefresh={lastRefresh}
            refreshing={refreshing}
            onRefresh={refreshAll}
          />
        </div>
      </div>

      {err && (
        <div className="an-error" role="alert">
          <span className="material-icons">error_outline</span>
          <span>{err}</span>
          <button className="an-error__close" onClick={() => setErr('')} aria-label="Dismiss">
            <span className="material-icons">close</span>
          </button>
        </div>
      )}

      {/* Fleet KPIs */}
      <div className="an-kpis">
        <Kpi
          tone={online.length === overview.length ? 'is-success' : 'is-danger'}
          icon="dns"
          value={`${online.length}/${overview.length}`}
          label="Servers online"
          meta={
            overview.length - online.length > 0
              ? `${overview.length - online.length} offline`
              : 'All reachable'
          }
        />
        <Kpi
          tone="is-bronze"
          icon="storage"
          value={totalDbs}
          label="Client databases"
          meta={`Across ${overview.length} server${overview.length === 1 ? '' : 's'}`}
        />
        <Kpi
          tone={healthTone(Math.max(avgCpu, avgRam))}
          icon="speed"
          value={`${avgCpu}%`}
          label="Avg CPU"
          meta={`Avg memory ${avgRam}%`}
        />
        <Kpi
          tone={criticalCount ? 'is-danger' : activeAlerts.length ? 'is-warning' : 'is-success'}
          icon={activeAlerts.length ? 'notifications_active' : 'notifications_none'}
          value={activeAlerts.length}
          label="Active alerts"
          meta={criticalCount ? `${criticalCount} critical` : 'None critical'}
        />
      </div>

      {/* Server cards — click to chart one */}
      {overview.length === 0 ? (
        <div className="an-panel mb-3">
          <Empty icon="hourglass_empty">
            No metrics collected yet. The collector samples every ~60s — check back shortly.
          </Empty>
        </div>
      ) : (
        <div className="an-servers">
          {overview.map((s) => (
            <ServerCard
              key={s.serverId}
              server={s}
              selected={s.serverId === selectedId}
              onSelect={() => setSelectedId(s.serverId)}
            />
          ))}
        </div>
      )}

      {/* Trends + current usage for the selected server */}
      <div className="an-panel mb-3">
        <div className="an-panel__head">
          <div>
            <div className="an-panel__title">
              <span className="material-icons">show_chart</span>
              Trends{selected ? ` — ${selected.serverName}` : ''}
            </div>
            <div className="an-panel__sub">Click a server card above to switch.</div>
          </div>
          <Segmented options={RANGES} value={range} onChange={setRange} />
        </div>
        {loadingSeries ? (
          <div className="text-center py-5">
            <CSpinner style={{ color: ACCENT }} />
          </div>
        ) : (
          <CRow>
            <CCol lg={8} className="mb-3 mb-lg-0">
              {points.length === 0 ? (
                <Empty icon="query_stats">No data for this range yet.</Empty>
              ) : (
                <>
                  <div className="an-panel__label">CPU &amp; Memory</div>
                  <div style={{ height: 250 }}>
                    <CChartLine
                      key={`cpu-${isDark}`}
                      customTooltips={false}
                      data={{
                        labels,
                        datasets: [
                          lineDataset(
                            'CPU',
                            ACCENT,
                            points.map((p) => p.cpu),
                          ),
                          lineDataset(
                            'Memory',
                            theme.memory,
                            points.map((p) => p.ram),
                          ),
                        ],
                      }}
                      options={lineOptions()}
                    />
                  </div>
                  <div className="an-panel__label mt-3">Disk free</div>
                  <div style={{ height: 150 }}>
                    <CChartLine
                      key={`disk-${isDark}`}
                      customTooltips={false}
                      data={{
                        labels,
                        datasets: [
                          lineDataset(
                            'Disk free',
                            GOOD,
                            points.map((p) => p.disk),
                          ),
                        ],
                      }}
                      options={{
                        ...lineOptions(),
                        plugins: { ...lineOptions().plugins, legend: { display: false } },
                      }}
                    />
                  </div>
                </>
              )}
            </CCol>
            <CCol lg={4}>
              {selected ? (
                <div className="d-flex flex-column gap-4">
                  <div>
                    <div className="an-panel__label">Memory now</div>
                    <Donut
                      small
                      dark={isDark}
                      center={`${selected.ramUsedPercent}%`}
                      caption="used"
                      data={[
                        {
                          label: 'Used',
                          value: selected.ramUsedMb,
                          color: healthColor(selected.ramUsedPercent),
                          display: fmtGb(selected.ramUsedMb),
                        },
                        {
                          label: 'Free',
                          value: Math.max(0, selected.ramTotalMb - selected.ramUsedMb),
                          color: isDark ? '#3a4150' : '#dfe4ea',
                          display: fmtGb(Math.max(0, selected.ramTotalMb - selected.ramUsedMb)),
                        },
                      ]}
                    />
                  </div>
                  <div>
                    <div className="an-panel__label">
                      Storage now{selected.diskVolume ? ` (${selected.diskVolume})` : ''}
                    </div>
                    <Donut
                      small
                      dark={isDark}
                      center={`${100 - selected.diskFreePercent}%`}
                      caption="used"
                      data={[
                        {
                          label: 'Used',
                          value: Math.max(0, selected.diskTotalMb - selected.diskFreeMb),
                          color: healthColor(selected.diskFreePercent, true),
                          display: fmtGb(Math.max(0, selected.diskTotalMb - selected.diskFreeMb)),
                        },
                        {
                          label: 'Free',
                          value: selected.diskFreeMb,
                          color: isDark ? '#3a4150' : '#dfe4ea',
                          display: fmtGb(selected.diskFreeMb),
                        },
                      ]}
                    />
                  </div>
                </div>
              ) : (
                <Empty icon="touch_app">Select a server to see its current usage.</Empty>
              )}
            </CCol>
          </CRow>
        )}
      </div>

      {/* Distribution pies */}
      <CRow>
        <CCol lg={6} className="mb-3">
          <div className="an-panel">
            <div className="an-panel__head">
              <div className="an-panel__title">
                <span className="material-icons">pie_chart</span>
                Client databases per server
              </div>
            </div>
            <Donut
              dark={isDark}
              center={totalDbs}
              caption="databases"
              emptyText="No client databases yet."
              data={overview.map((s, i) => ({
                label: s.serverName,
                value: s.clientDbCount || 0,
                color: theme.palette[i % theme.palette.length],
              }))}
            />
          </div>
        </CCol>
        <CCol lg={6} className="mb-3">
          <div className="an-panel">
            <div className="an-panel__head">
              <div className="an-panel__title">
                <span className="material-icons">donut_large</span>
                Active alerts by condition
              </div>
            </div>
            <Donut
              dark={isDark}
              center={activeAlerts.length}
              caption="active"
              emptyIcon="verified"
              emptyText="All clear — no active alerts."
              data={alertsByKind}
            />
          </div>
        </CCol>
      </CRow>

      {/* Alerts feed */}
      <div className="an-panel mb-3">
        <div className="an-panel__head">
          <div className="an-panel__title">
            <span className="material-icons">notifications</span>
            Alerts
          </div>
          <Segmented
            options={[
              { key: 'active', label: `Active (${activeAlerts.length})` },
              { key: 'all', label: `All (${alerts.length})` },
            ]}
            value={alertFilter}
            onChange={setAlertFilter}
          />
        </div>
        <div className="an-table-wrap">
          <table className="table table-hover align-middle an-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Server</th>
                <th>Condition</th>
                <th>Reading</th>
                <th>Raised</th>
                <th>Status</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {shownAlerts.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <Empty icon="verified">
                      {alertFilter === 'active' ? 'No active alerts.' : 'No alerts recorded.'}
                    </Empty>
                  </td>
                </tr>
              )}
              {shownAlerts.map((a) => {
                const kind = kindOf(a.alertKind)
                return (
                  <tr key={a.id}>
                    <td>
                      <Tag tone={a.severity === 'Critical' ? 'is-danger' : 'is-warning'} dot>
                        {a.severity}
                      </Tag>
                    </td>
                    <td className="fw-semibold">{a.serverName}</td>
                    <td>
                      <span className="d-inline-flex align-items-center gap-1">
                        <span
                          className="material-icons"
                          style={{ fontSize: 15, color: kind.color }}
                        >
                          {kind.icon}
                        </span>
                        {kind.label}
                      </span>
                    </td>
                    <td title={a.message}>
                      {a.metric}
                      {a.threshold ? (
                        <span className="an-table__muted"> (≥ {a.threshold})</span>
                      ) : null}
                    </td>
                    <td
                      className="an-table__muted"
                      title={moment(a.raisedAt).format('YYYY-MM-DD HH:mm')}
                    >
                      {moment(a.raisedAt).fromNow()}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        {a.isActive ? (
                          <Tag tone="is-danger">Active</Tag>
                        ) : (
                          <Tag tone="is-muted">Resolved</Tag>
                        )}
                        {a.acknowledged && <Tag tone="is-success">Ack</Tag>}
                      </div>
                    </td>
                    <td className="text-end">
                      {!a.acknowledged && (
                        <button type="button" className="an-ack" onClick={() => acknowledge(a.id)}>
                          <span className="material-icons">done</span>
                          Acknowledge
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Refresh button whose ring fills toward the next auto-refresh, plus a "last updated" pill.
// Holds its own 1s tick so the countdown doesn't re-render the charts.
const RefreshControl = ({ lastRefresh, refreshing, onRefresh }) => {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const age = lastRefresh ? now - lastRefresh.getTime() : 0
  const elapsed = lastRefresh ? Math.min(100, (age / POLL_MS) * 100) : 0
  const stale = lastRefresh && age > POLL_MS * 2
  const secs = Math.max(0, Math.round(age / 1000))

  return (
    <>
      <span
        className={`an-live${stale ? ' is-stale' : ''}`}
        title={lastRefresh ? moment(lastRefresh).format('YYYY-MM-DD HH:mm:ss') : undefined}
      >
        <span className="an-live__dot" />
        {lastRefresh
          ? `Updated ${
              secs < 5 ? 'just now' : secs < 60 ? `${secs}s ago` : moment(lastRefresh).fromNow()
            }`
          : 'Connecting…'}
      </span>
      <button
        type="button"
        className={`an-refresh${refreshing ? ' is-busy' : ''}`}
        onClick={onRefresh}
        disabled={refreshing}
        title={`Auto-refreshes every ${POLL_MS / 1000}s`}
        style={{ '--elapsed': refreshing ? 100 : elapsed }}
      >
        <span className="an-refresh__ring">
          <span className="material-icons an-refresh__icon">refresh</span>
        </span>
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </>
  )
}

RefreshControl.propTypes = {
  lastRefresh: PropTypes.instanceOf(Date),
  refreshing: PropTypes.bool,
  onRefresh: PropTypes.func,
}

const Kpi = ({ tone, icon, value, label, meta }) => (
  <div className={`an-kpi ${tone}`}>
    <div className="an-kpi__icon">
      <span className="material-icons">{icon}</span>
    </div>
    <div className="an-kpi__body">
      <span className="an-kpi__value">{value}</span>
      <span className="an-kpi__label">{label}</span>
      {meta && <span className="an-kpi__meta">{meta}</span>}
    </div>
  </div>
)

Kpi.propTypes = {
  tone: PropTypes.string,
  icon: PropTypes.string,
  value: PropTypes.node,
  label: PropTypes.node,
  meta: PropTypes.node,
}

const Tag = ({ tone, dot, children }) => (
  <span className={`an-tag ${tone}`}>
    {dot && <span className="an-tag__dot" />}
    {children}
  </span>
)

Tag.propTypes = { tone: PropTypes.string, dot: PropTypes.bool, children: PropTypes.node }

const Segmented = ({ options, value, onChange }) => (
  <div className="an-seg" role="group">
    {options.map((o) => (
      <button
        key={o.key}
        type="button"
        className={value === o.key ? 'active' : undefined}
        aria-pressed={value === o.key}
        onClick={() => onChange(o.key)}
      >
        {o.label}
      </button>
    ))}
  </div>
)

Segmented.propTypes = {
  options: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, label: PropTypes.node })),
  value: PropTypes.string,
  onChange: PropTypes.func,
}

const Empty = ({ icon = 'inbox', children }) => (
  <div className="an-empty">
    <span className="material-icons">{icon}</span>
    <span>{children}</span>
  </div>
)

Empty.propTypes = { icon: PropTypes.string, children: PropTypes.node }

// One server: status tags, ring gauges for CPU / memory / disk, and client DB count.
const ServerCard = ({ server: s, selected, onSelect }) => (
  <div
    role="button"
    tabIndex={0}
    className={`an-server${selected ? ' is-selected' : ''}`}
    onClick={onSelect}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect()
      }
    }}
  >
    <div className="an-server__head">
      <span className="an-server__name" title={s.serverName}>
        {s.serverName}
      </span>
      <span className="an-server__tags">
        {s.isMaster && <Tag tone="is-info">Master</Tag>}
        <Tag tone={s.reachable ? 'is-success' : 'is-danger'} dot>
          {s.reachable ? 'Online' : 'Offline'}
        </Tag>
      </span>
    </div>
    <div className="an-server__gauges">
      <Gauge label="CPU" pct={s.cpuPercent} />
      <Gauge
        label="Memory"
        pct={s.ramUsedPercent}
        meta={`${fmtGb(s.ramUsedMb)} / ${fmtGb(s.ramTotalMb)}`}
      />
      <Gauge
        label="Disk"
        pct={100 - s.diskFreePercent}
        meta={`${fmtGb(s.diskFreeMb)} free${s.diskVolume ? ` · ${s.diskVolume}` : ''}`}
      />
    </div>
    <div className="an-server__foot">
      <span>
        Client DBs <strong>{s.clientDbCount}</strong>
      </span>
      {s.activeAlerts > 0 ? (
        <Tag tone={s.criticalAlerts > 0 ? 'is-danger' : 'is-warning'}>
          {s.activeAlerts} active alert{s.activeAlerts > 1 ? 's' : ''}
        </Tag>
      ) : (
        <Tag tone="is-muted">No alerts</Tag>
      )}
    </div>
  </div>
)

ServerCard.propTypes = {
  server: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func,
}

// A ring gauge (CSS conic-gradient) coloured by load.
const Gauge = ({ label, pct, meta }) => {
  const v = Math.max(0, Math.min(100, pct || 0))
  return (
    <div className="an-gauge">
      <div className="an-gauge__ring" style={{ '--pct': v, '--ring': healthColor(v) }}>
        <span className="an-gauge__value">{Math.round(v)}%</span>
      </div>
      <span className="an-gauge__label">{label}</span>
      {meta && <span className="an-gauge__meta">{meta}</span>}
    </div>
  )
}

Gauge.propTypes = { label: PropTypes.node, pct: PropTypes.number, meta: PropTypes.node }

// Doughnut chart with a centred total and an HTML legend (themed via CSS, unlike Chart.js's).
const Donut = ({ data, center, caption, dark, small, emptyText, emptyIcon }) => {
  const t = chartTheme(dark)
  const total = data.reduce((n, d) => n + (d.value || 0), 0)
  if (!total)
    return <Empty icon={emptyIcon || 'pie_chart_outline'}>{emptyText || 'No data.'}</Empty>

  return (
    <div className={`an-donut${small ? ' an-donut--sm' : ''}`}>
      <div className="an-donut__chart">
        <CChartDoughnut
          key={`donut-${dark}`}
          customTooltips={false}
          data={{
            labels: data.map((d) => d.label),
            datasets: [
              {
                data: data.map((d) => d.value),
                backgroundColor: data.map((d) => d.color),
                borderColor: t.surface,
                borderWidth: 2,
                hoverOffset: 6,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            cutout: '74%',
            layout: { padding: 6 },
            plugins: {
              legend: { display: false },
              tooltip: {
                ...tooltipOptions(t),
                callbacks: {
                  label: (c) =>
                    ` ${c.label}: ${data[c.dataIndex].display ?? c.formattedValue} (${Math.round(
                      (c.raw / total) * 100,
                    )}%)`,
                },
              },
            },
          }}
        />
        <div className="an-donut__center">
          <span className="an-donut__total">{center}</span>
          {caption && <span className="an-donut__caption">{caption}</span>}
        </div>
      </div>
      <ul className="an-donut__legend">
        {data.map((d, i) => (
          <li key={i}>
            <span className="an-donut__swatch" style={{ background: d.color }} />
            <span className="an-donut__name" title={d.label}>
              {d.label}
            </span>
            <span className="an-donut__val">{d.display ?? d.value}</span>
            <span className="an-donut__pct">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

Donut.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.node,
      value: PropTypes.number,
      color: PropTypes.string,
      display: PropTypes.node,
    }),
  ).isRequired,
  center: PropTypes.node,
  caption: PropTypes.node,
  dark: PropTypes.bool,
  small: PropTypes.bool,
  emptyText: PropTypes.node,
  emptyIcon: PropTypes.string,
}

const fmtGb = (mb) => {
  if (!mb || mb <= 0) return '0 GB'
  const gb = mb / 1024
  return gb >= 10 ? `${Math.round(gb)} GB` : `${gb.toFixed(1)} GB`
}

export default Analytics
