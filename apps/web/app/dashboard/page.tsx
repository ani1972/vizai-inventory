'use client'
// apps/web/app/dashboard/page.tsx
// Req 8: Manager dashboard — KPIs, stock chart, supplier fill rates, ledger
// Req 9: all numbers clickable → DrillPanel
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Sidebar }      from '../../components/Sidebar'
import { Chatbot }      from '../../components/Chatbot'
import { DrillPanel, DrillKpi, DrillRow } from '../../components/DrillPanel'
import { useUser }      from '../../hooks/useUser'

// ── Types ────────────────────────────────────────────────────
interface KpiData {
  total_skus:       number
  active_skus:      number
  quarantined_skus: number
  low_stock_count:  number
  zero_stock_count: number
  stock_value_inr:  number
}
interface LedgerRow {
  sku: string; name: string; quantity_change: number
  movement_type: string; created_at: string; client?: string
}
interface Notif {
  id: string; title: string; body: string
  trigger_type: string; is_read: boolean; created_at: string
}

const CHART_DATA = [
  { day: 'Mon', in: 22, out: 18 }, { day: 'Tue', in: 15, out: 22 },
  { day: 'Wed', in: 31, out: 14 }, { day: 'Thu', in: 18, out: 25 },
  { day: 'Fri', in: 27, out: 19 }, { day: 'Sat', in: 12, out: 8 },
  { day: 'Sun', in: 35, out: 28 },
]
const SUPPLIER_RATES = [
  { name: 'Godrej Material', rate: 96 }, { name: 'Honeywell India', rate: 94 },
  { name: 'Voltas Ltd',      rate: 91 }, { name: 'Zebra Tech',      rate: 85 },
  { name: 'ABB India',       rate: 88 }, { name: 'Parker Hannifin', rate: 72 },
]
const NOTIF_ICON: Record<string, string> = {
  zero_stock:     'ti-alert-circle',
  low_stock:      'ti-alert-triangle',
  condition_flag: 'ti-tool',
  po_overdue:     'ti-truck',
  iot_alert:      'ti-cpu',
}
const NOTIF_COLOR: Record<string, string> = {
  zero_stock: '#E84545', low_stock: '#F5A623',
  condition_flag: '#A78BFA', po_overdue: '#E84545', iot_alert: '#4A9EFF',
}

export default function DashboardPage() {
  const { user }                         = useUser()
  const [kpi,     setKpi]                = useState<KpiData | null>(null)
  const [ledger,  setLedger]             = useState<LedgerRow[]>([])
  const [notifs,  setNotifs]             = useState<Notif[]>([])
  const [drill,   setDrill]              = useState<{ open: boolean; title: string; content: React.ReactNode }>({ open: false, title: '', content: null })
  const [notifPanelOpen, setNotifPanel]  = useState(false)

  const unread = notifs.filter(n => !n.is_read).length

  const load = useCallback(async () => {
    if (!user) return
    try {
      const [kpiRes, ledgerRes, notifRes] = await Promise.all([
        fetch(`/api/inventory/summary?org_id=${user.org_id}`).then(r => r.json()),
        fetch(`/api/inventory/ledger?org_id=${user.org_id}&limit=5`).then(r => r.json()),
        fetch(`/api/notifications?org_id=${user.org_id}`).then(r => r.json()),
      ])
      if (kpiRes.data)    setKpi(kpiRes.data)
      if (ledgerRes.data) setLedger(ledgerRes.data)
      if (notifRes.data)  setNotifs(notifRes.data)
    } catch { /* use seed data if API not yet live */ }
  }, [user])

  useEffect(() => { load() }, [load])

  function openDrill(title: string, content: React.ReactNode) {
    setDrill({ open: true, title, content })
  }

  const kpiCards = [
    {
      label: 'Total active SKUs',
      value: kpi?.active_skus ?? 247,
      sub:   'items in stock',
      delta: '+12 this week',
      up:    true,
      accent: '#00C896',
      drill: () => openDrill('Active SKU breakdown', <>
        <DrillKpi label="Total SKUs"  value={kpi?.total_skus ?? 247} />
        <DrillKpi label="Forklifts"   value={6} />
        <DrillKpi label="IoT Devices" value={31} />
        <DrillKpi label="Spare Parts" value={180} />
        <DrillKpi label="Pallet Trucks" value={14} />
        <DrillKpi label="Scissor Lifts" value={8} />
      </>),
    },
    {
      label: 'Low stock alerts',
      value: kpi?.low_stock_count ?? 11,
      sub:   'below reorder point',
      delta: '3 critical',
      up:    false,
      accent: '#E84545',
      drill: () => openDrill('Low stock items', <>
        {['VZ-VIB-061 Vibration Sensor — 0 units','VZ-STK-021 Reach Stacker — 1 unit',
          'VZ-SPA-055 Hydraulic Cylinder — 2 units','VZ-FLT-002 Forklift 5T — 2 units',
          'VZ-PLT-012 Pallet Truck 1.5T — 2 units'].map(i => (
          <div key={i} className="p-3 rounded-lg text-xs" style={{ background: '#22262E', color: '#F0F2F5' }}>{i}</div>
        ))}
      </>),
    },
    {
      label: 'Open purchase orders',
      value: 18,
      sub:   '₹42.6L pending',
      delta: '5 arriving today',
      up:    true,
      accent: '#4A9EFF',
      drill: () => openDrill('Open POs', <>
        <DrillKpi label="Total open"    value={18} />
        <DrillKpi label="Arriving today" value={5} />
        <DrillKpi label="Overdue"       value="3" sub="Parker Hannifin delay" />
        <DrillKpi label="Total value"   value="₹42.6L" />
      </>),
    },
    {
      label: 'Items quarantined',
      value: kpi?.quarantined_skus ?? 4,
      sub:   'condition flagged',
      delta: '2 pending review',
      up:    false,
      accent: '#F5A623',
      drill: () => openDrill('Quarantined items', <>
        {['Drive Motor 15kW — bearing failure','IoT Gateway Module — firmware fault',
          'Hydraulic Cylinder — seal leak','RFID Reader — antenna damaged'].map(i => (
          <div key={i} className="p-3 rounded-lg text-xs" style={{ background: '#22262E', color: '#F5A623' }}>{i}</div>
        ))}
      </>),
    },
  ]

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0D0F12' }}>
      <Sidebar role={user?.role ?? 'manager'} unreadCount={unread} onNotif={() => setNotifPanel(p => !p)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-4 h-12 flex-shrink-0"
                style={{ background: '#1A1D23', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <div className="text-sm font-medium text-white">Manager dashboard</div>
            <div className="text-xs" style={{ color: '#5A6272' }}>
              VizAI Engineering · Medavakkam Warehouse · Chennai
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded font-mono"
                  style={{ background: '#22262E', color: '#00C896' }}>
              {user?.role ?? 'manager'}
            </span>
            <span className="text-xs" style={{ color: '#5A6272' }}>{user?.name}</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCards.map(k => (
              <button
                key={k.label}
                onClick={k.drill}
                className="text-left rounded-xl p-4 transition-all hover:border-white/20 cursor-pointer"
                style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)',
                         borderTop: `2px solid ${k.accent}` }}
                aria-label={`${k.label}: ${k.value} — click for details`}
              >
                <div className="text-xs uppercase tracking-wide mb-2" style={{ color: '#5A6272' }}>{k.label}</div>
                <div className="text-2xl font-medium font-mono" style={{ color: k.up ? '#F0F2F5' : k.accent }}>
                  {typeof k.value === 'number' ? k.value.toLocaleString('en-IN') : k.value}
                </div>
                <div className="text-xs mt-1" style={{ color: '#5A6272' }}>{k.sub}</div>
                <div className="text-xs mt-1 font-medium" style={{ color: k.up ? '#00C896' : '#E84545' }}>
                  {k.delta}
                </div>
              </button>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {/* Stock movement chart */}
            <div className="rounded-xl p-4"
                 style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">Stock movement — last 7 days</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(0,200,150,0.12)', color: '#00C896' }}>live</span>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={CHART_DATA} barGap={2}>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#5A6272' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: '#22262E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: '#9BA3AF' }}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="in"  name="In"  fill="#00C896" radius={[2,2,0,0]} />
                  <Bar dataKey="out" name="Out" fill="#E84545" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-xs" style={{ color: '#5A6272' }}>
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#00C896' }} />In
                </span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: '#5A6272' }}>
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#E84545' }} />Out
                </span>
              </div>
            </div>

            {/* Supplier fill rates */}
            <div className="rounded-xl p-4"
                 style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">Supplier fill rates</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#22262E', color: '#9BA3AF' }}>30 days</span>
              </div>
              <div className="space-y-2">
                {SUPPLIER_RATES.map(s => (
                  <div key={s.name} className="flex items-center gap-3">
                    <span className="text-xs w-28 truncate flex-shrink-0" style={{ color: '#9BA3AF' }}>{s.name}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#2A2F3A' }}>
                      <div className="h-full rounded-full transition-all"
                           style={{ width: `${s.rate}%`,
                                    background: s.rate >= 90 ? '#00C896' : s.rate >= 80 ? '#4A9EFF' : '#F5A623' }} />
                    </div>
                    <span className="text-xs font-mono w-8 text-right" style={{ color: '#9BA3AF' }}>{s.rate}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {/* Recent ledger */}
            <div className="rounded-xl p-4"
                 style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">Recent movements</span>
                <button onClick={() => openDrill('Stock ledger', <div className="text-xs text-gray-400">Full ledger loads from Inventory MCP</div>)}
                        className="text-xs hover:opacity-80 transition-opacity"
                        style={{ color: '#4A9EFF', background: 'none', border: 'none', cursor: 'pointer' }}>
                  view all
                </button>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {['SKU','Item','Change','Time'].map(h => (
                      <th key={h} className="text-left pb-2 font-medium" style={{ color: '#5A6272' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ledger.length ? ledger : [
                    { sku: 'VZ-IOT-041', name: 'IoT Gateway', quantity_change: 5,  movement_type: 'in',  created_at: '10:42' },
                    { sku: 'VZ-FLT-001', name: 'Forklift 3T', quantity_change: -1, movement_type: 'out', created_at: '09:15' },
                    { sku: 'VZ-SPA-044', name: 'Drive Motor',  quantity_change: 10, movement_type: 'in',  created_at: '08:50' },
                    { sku: 'VZ-VIB-061', name: 'Vibration Sensor', quantity_change: -3, movement_type: 'out', created_at: '08:30' },
                  ]).map((r, i) => (
                    <tr key={i} className="cursor-pointer hover:bg-white/[0.02] rounded"
                        onClick={() => openDrill(`SKU ${r.sku}`, <>
                          <DrillKpi label="SKU" value={r.sku} />
                          <DrillKpi label="Change" value={`${r.quantity_change > 0 ? '+' : ''}${r.quantity_change} units`} />
                          <DrillKpi label="Type"  value={r.movement_type} />
                        </>)}>
                      <td className="py-2 font-mono pr-2" style={{ color: '#F0F2F5' }}>{r.sku}</td>
                      <td className="py-2 pr-2" style={{ color: '#9BA3AF' }}>{r.name}</td>
                      <td className="py-2 pr-2">
                        <span className="px-1.5 py-0.5 rounded text-xs"
                              style={{
                                background: r.quantity_change > 0 ? 'rgba(0,200,150,0.12)' : 'rgba(232,69,69,0.12)',
                                color:      r.quantity_change > 0 ? '#00C896' : '#E84545',
                              }}>
                          {r.quantity_change > 0 ? '+' : ''}{r.quantity_change}
                        </span>
                      </td>
                      <td className="py-2" style={{ color: '#5A6272' }}>
                        {typeof r.created_at === 'string' && r.created_at.includes('T')
                          ? new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                          : r.created_at}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notifications */}
            <div className="rounded-xl p-4"
                 style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">Notifications</span>
                {unread > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(232,69,69,0.12)', color: '#E84545' }}>
                    {unread} unread
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {(notifs.length ? notifs.slice(0, 4) : [
                  { id: '1', title: 'VZ-VIB-061 at zero stock',         body: 'Vibration Sensor has 0 units', trigger_type: 'zero_stock',     is_read: false, created_at: '2 min ago' },
                  { id: '2', title: 'Hyundai India — high vibration',    body: 'IOT-HY-003 reading 8.4g',     trigger_type: 'iot_alert',      is_read: false, created_at: '18 min' },
                  { id: '3', title: 'PO-2024-0891 overdue',              body: 'Parker Hannifin 4 days late', trigger_type: 'po_overdue',     is_read: false, created_at: '2 hr' },
                  { id: '4', title: 'PO-2024-0894 shipped',              body: 'Vibration Sensor × 20',       trigger_type: 'po_received',    is_read: true,  created_at: '3 hr' },
                ]).map(n => (
                  <div key={n.id}
                       className="flex gap-2 p-2.5 rounded-lg cursor-pointer transition-colors hover:opacity-80"
                       style={{ background: '#22262E',
                                borderLeft: !n.is_read ? `2px solid ${NOTIF_COLOR[n.trigger_type] ?? '#00C896'}` : '2px solid transparent' }}
                       onClick={() => openDrill(n.title, <>
                         <DrillKpi label="Type" value={n.trigger_type.replace(/_/g,' ')} />
                         <DrillKpi label="Time" value={n.created_at} />
                         <p className="text-xs mt-2" style={{ color: '#9BA3AF' }}>{n.body}</p>
                       </>)}>
                    <i className={`ti ${NOTIF_ICON[n.trigger_type] ?? 'ti-bell'} text-sm mt-0.5 flex-shrink-0`}
                       style={{ color: NOTIF_COLOR[n.trigger_type] ?? '#9BA3AF' }} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{n.title}</div>
                      <div className="text-xs truncate mt-0.5" style={{ color: '#5A6272' }}>{n.body}</div>
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: '#5A6272' }}>{n.created_at}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      <DrillPanel open={drill.open} title={drill.title} onClose={() => setDrill(d => ({ ...d, open: false }))}>
        {drill.content}
      </DrillPanel>

      <Chatbot />
    </div>
  )
}
