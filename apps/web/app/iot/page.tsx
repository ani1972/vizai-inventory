'use client'
// apps/web/app/iot/page.tsx — Req 17: IoT device monitoring
import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/Sidebar'
import { Chatbot } from '../../components/Chatbot'
import { DrillPanel, DrillKpi, DrillRow } from '../../components/DrillPanel'
import { useUser } from '../../hooks/useUser'

const DEVICES = [
  { id: 'IOT-AL-001', type: 'gateway',   client: 'Ashok Leyland', loc: 'Medavakkam Bay A',        status: 'online',  ping: '2s ago',   reading: { signal: '98%', uptime: '99.9%' } },
  { id: 'IOT-AL-002', type: 'gateway',   client: 'Ashok Leyland', loc: 'Medavakkam Bay B',        status: 'online',  ping: '4s ago',   reading: { signal: '95%', uptime: '99.7%' } },
  { id: 'IOT-HY-003', type: 'vibration', client: 'Hyundai India', loc: 'VGP Pushpa Nagar',        status: 'alert',   ping: '1s ago',   reading: { vibration: '8.4g', threshold: '6.0g' } },
  { id: 'IOT-TV-004', type: 'rfid',      client: 'TVS Motors',    loc: 'Medavakkam Gate',         status: 'online',  ping: '8s ago',   reading: { scans_today: 142 } },
  { id: 'IOT-FX-005', type: 'gateway',   client: 'Foxconn Chennai', loc: 'Sholinganallur',        status: 'online',  ping: '3s ago',   reading: { signal: '91%', uptime: '99.2%' } },
  { id: 'IOT-AL-006', type: 'rfid',      client: 'Ashok Leyland', loc: 'Medavakkam Bay C',        status: 'online',  ping: '12s ago',  reading: { scans_today: 87 } },
  { id: 'IOT-TV-007', type: 'vibration', client: 'TVS Motors',    loc: 'Ambattur Industrial Estate', status: 'offline', ping: '1hr ago', reading: null },
  { id: 'IOT-HY-008', type: 'gateway',   client: 'Hyundai India', loc: 'SIPCOT Irungattukottai',  status: 'offline', ping: '2hr ago',  reading: null },
]

const STATUS_STYLE: Record<string, { dot: string; text: string; label: string }> = {
  online:  { dot: '#00C896', text: '#00C896', label: 'online'  },
  alert:   { dot: '#F5A623', text: '#F5A623', label: 'alert'   },
  offline: { dot: '#5A6272', text: '#5A6272', label: 'offline' },
  maintenance: { dot: '#4A9EFF', text: '#4A9EFF', label: 'maintenance' },
}

export default function IoTPage() {
  const { user } = useUser()
  const [tick, setTick] = useState(0)
  const [drill, setDrill] = useState<{ open: boolean; d?: typeof DEVICES[0] }>({ open: false })
  const [filter, setFilter] = useState('all')

  // Simulate live ping updates
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 3000)
    return () => clearInterval(t)
  }, [])

  const filtered = filter === 'all' ? DEVICES : DEVICES.filter(d => d.status === filter)
  const onlineCount = DEVICES.filter(d => d.status === 'online').length
  const alertCount  = DEVICES.filter(d => d.status === 'alert').length
  const offlineCount = DEVICES.filter(d => d.status === 'offline').length

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0D0F12' }}>
      <Sidebar role={user?.role ?? 'ops'} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 h-12 flex-shrink-0"
                style={{ background: '#1A1D23', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <div className="text-sm font-medium text-white">IoT device monitor</div>
            <div className="text-xs" style={{ color: '#5A6272' }}>Ashok Leyland · TVS Motors · Hyundai India · Foxconn Chennai</div>
          </div>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: '#00C896' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: '#00C896' }} aria-hidden="true" />
            live
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Devices online',  value: onlineCount,  sub: `of ${DEVICES.length} registered`, color: '#00C896' },
              { label: 'Active alerts',   value: alertCount,   sub: 'Hyundai high vibration',          color: '#F5A623' },
              { label: 'Offline',         value: offlineCount, sub: 'last seen > 1hr',                 color: '#5A6272' },
              { label: 'Avg ping',        value: '24ms',       sub: 'last 5 min',                      color: '#4A9EFF' },
            ].map(k => (
              <div key={k.label} className="rounded-xl p-4"
                   style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)', borderTop: `2px solid ${k.color}` }}>
                <div className="text-xs uppercase tracking-wide mb-1" style={{ color: '#5A6272' }}>{k.label}</div>
                <div className="text-2xl font-medium font-mono" style={{ color: k.color }}>{k.value}</div>
                <div className="text-xs mt-1" style={{ color: '#5A6272' }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Alert banner for Hyundai */}
          {alertCount > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-xl"
                 style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)' }}>
              <i className="ti ti-alert-triangle text-lg flex-shrink-0" style={{ color: '#F5A623' }} aria-hidden="true" />
              <div>
                <div className="text-sm font-medium" style={{ color: '#F5A623' }}>
                  IOT-HY-003 — High vibration threshold exceeded
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#9BA3AF' }}>
                  Reading 8.4g · Threshold 6.0g · VGP Pushpa Nagar Warehouse · Hyundai India
                  · Notification sent to Rajesh Kumar
                </div>
              </div>
            </div>
          )}

          {/* Device table */}
          <div className="rounded-xl overflow-hidden"
               style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b"
                 style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <span className="text-sm font-medium text-white">Device status</span>
              <div className="flex gap-1 p-1 rounded-md" style={{ background: '#0D0F12' }}>
                {['all','online','alert','offline'].map(s => (
                  <button key={s} onClick={() => setFilter(s)}
                          className="text-xs px-2 py-1 rounded transition-colors"
                          style={{ background: filter === s ? '#2A2F3A' : 'none',
                                   color: filter === s ? '#F0F2F5' : '#5A6272',
                                   border: 'none', cursor: 'pointer' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Device ID','Type','Client','Location','Last ping','Status','Reading'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ color: '#5A6272' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const sc = STATUS_STYLE[d.status]
                  return (
                    <tr key={d.id}
                        className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                        onClick={() => setDrill({ open: true, d })}>
                      <td className="px-4 py-3 font-mono" style={{ color: '#F0F2F5' }}>{d.id}</td>
                      <td className="px-4 py-3 capitalize" style={{ color: '#9BA3AF' }}>{d.type}</td>
                      <td className="px-4 py-3" style={{ color: '#9BA3AF' }}>{d.client}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#5A6272' }}>{d.loc}</td>
                      <td className="px-4 py-3" style={{ color: '#5A6272' }}>{d.ping}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: sc.dot,
                                         animation: d.status === 'online' ? 'pulse 2s infinite' : d.status === 'alert' ? 'pulse 0.8s infinite' : 'none' }}
                                aria-hidden="true" />
                          <span style={{ color: sc.text }}>{sc.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: '#5A6272' }}>
                        {d.reading ? Object.entries(d.reading).map(([k,v]) => `${k}: ${v}`).join(' · ') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      <DrillPanel
        open={drill.open}
        title={drill.d?.id ?? 'Device detail'}
        onClose={() => setDrill({ open: false })}
      >
        {drill.d && <>
          <DrillKpi label="Device ID" value={drill.d.id} />
          <DrillKpi label="Type"      value={drill.d.type} />
          <DrillKpi label="Client"    value={drill.d.client} />
          <DrillKpi label="Status"    value={drill.d.status} />
          <DrillRow label="Location"  value={drill.d.loc} />
          <DrillRow label="Last ping" value={drill.d.ping} />
          {drill.d.reading && Object.entries(drill.d.reading).map(([k,v]) => (
            <DrillRow key={k} label={k.replace(/_/g,' ')} value={String(v)} accent />
          ))}
          {drill.d.status === 'alert' && (
            <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(245,166,35,0.08)', color: '#F5A623', border: '1px solid rgba(245,166,35,0.2)' }}>
              Alert notification sent to Rajesh Kumar · Slack + email dispatched
            </div>
          )}
        </>}
      </DrillPanel>

      <Chatbot />
    </div>
  )
}
