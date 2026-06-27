'use client'
// apps/web/app/ops/page.tsx — Req 8: Operations/Execution view
import { useState } from 'react'
import { Sidebar }  from '../../components/Sidebar'
import { Chatbot }  from '../../components/Chatbot'
import { DrillPanel, DrillKpi, DrillRow } from '../../components/DrillPanel'
import { useUser }  from '../../hooks/useUser'

const POS = [
  { id: 'PO-2024-0895', item: 'Electric Forklift 5T',   supplier: 'Godrej Material', qty: 1,  value: '₹24,00,000', status: 'confirmed', exp: 'Today',   sku: 'VZ-FLT-002' },
  { id: 'PO-2024-0894', item: 'Vibration Sensor ×20',  supplier: 'Honeywell India',  qty: 20, value: '₹1,70,000',  status: 'shipped',   exp: 'Today',   sku: 'VZ-VIB-061' },
  { id: 'PO-2024-0891', item: 'Hydraulic Cylinder',    supplier: 'Parker Hannifin',  qty: 5,  value: '₹2,10,000',  status: 'overdue',   exp: 'Jun 22',  sku: 'VZ-SPA-055' },
  { id: 'PO-2024-0888', item: 'Drive Motor 15kW',      supplier: 'ABB India',        qty: 8,  value: '₹7,60,000',  status: 'pending',   exp: 'Jun 28',  sku: 'VZ-SPA-044' },
  { id: 'PO-2024-0885', item: 'RFID Reader 900MHz',    supplier: 'Zebra Tech',       qty: 10, value: '₹2,80,000',  status: 'pending',   exp: 'Jun 30',  sku: 'VZ-RFD-051' },
  { id: 'PO-2024-0880', item: 'Reach Stacker 1.6T',   supplier: 'Godrej Material',  qty: 2,  value: '₹9,60,000',  status: 'pending',   exp: 'Jul 5',   sku: 'VZ-STK-021' },
]

const STATUS_COLOR: Record<string, string> = {
  confirmed: '#00C896', shipped: '#4A9EFF', overdue: '#E84545', pending: '#9BA3AF', received: '#A78BFA',
}
const STATUS_BG: Record<string, string> = {
  confirmed: 'rgba(0,200,150,0.12)', shipped: 'rgba(74,158,255,0.12)',
  overdue: 'rgba(232,69,69,0.12)', pending: 'rgba(255,255,255,0.06)', received: 'rgba(167,139,250,0.12)',
}

export default function OpsPage() {
  const { user } = useUser()
  const [drill, setDrill]      = useState<{ open: boolean; title: string; po?: typeof POS[0] }>({ open: false, title: '' })
  const [filter, setFilter]    = useState<string>('all')

  const filtered = filter === 'all' ? POS : POS.filter(p => p.status === filter)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0D0F12' }}>
      <Sidebar role={user?.role ?? 'ops'} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 h-12 flex-shrink-0"
                style={{ background: '#1A1D23', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <div className="text-sm font-medium text-white">Ops — execution view</div>
            <div className="text-xs" style={{ color: '#5A6272' }}>Live PO queue · Medavakkam Warehouse</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Open POs today', value: 18, sub: '5 arriving today', color: '#00C896' },
              { label: 'Overdue',        value: 3,  sub: 'escalated to mgr', color: '#E84545' },
              { label: 'Receipts today', value: 7,  sub: '₹8.2L stock in',   color: '#4A9EFF' },
              { label: 'Reorder needed', value: 11, sub: '3 at zero stock',   color: '#F5A623' },
            ].map(k => (
              <div key={k.label} className="rounded-xl p-4"
                   style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)', borderTop: `2px solid ${k.color}` }}>
                <div className="text-xs uppercase tracking-wide mb-1" style={{ color: '#5A6272' }}>{k.label}</div>
                <div className="text-2xl font-medium font-mono" style={{ color: k.color }}>{k.value}</div>
                <div className="text-xs mt-1" style={{ color: '#5A6272' }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* PO table */}
          <div className="rounded-xl overflow-hidden"
               style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b"
                 style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <span className="text-sm font-medium text-white">Purchase order queue</span>
              <div className="flex gap-1 p-1 rounded-md" style={{ background: '#0D0F12' }}>
                {['all','pending','confirmed','shipped','overdue'].map(s => (
                  <button key={s} onClick={() => setFilter(s)}
                          className="text-xs px-2 py-1 rounded transition-colors"
                          style={{
                            background: filter === s ? '#2A2F3A' : 'none',
                            color: filter === s ? '#F0F2F5' : '#5A6272',
                            border: 'none', cursor: 'pointer',
                          }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {['PO #','Item','Supplier','Qty','Value','Status','Expected',''].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ color: '#5A6272' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(po => (
                    <tr key={po.id}
                        className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                        onClick={() => setDrill({ open: true, title: po.id, po })}>
                      <td className="px-4 py-3 font-mono" style={{ color: '#F0F2F5' }}>{po.id}</td>
                      <td className="px-4 py-3" style={{ color: '#9BA3AF' }}>{po.item}</td>
                      <td className="px-4 py-3" style={{ color: '#9BA3AF' }}>{po.supplier}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: '#9BA3AF' }}>{po.qty}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: '#F0F2F5' }}>{po.value}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs"
                              style={{ background: STATUS_BG[po.status], color: STATUS_COLOR[po.status] }}>
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: po.status === 'overdue' ? '#E84545' : '#5A6272' }}>
                        {po.exp}
                      </td>
                      <td className="px-4 py-3">
                        {po.status === 'shipped' && (
                          <button className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                                  style={{ background: 'rgba(0,200,150,0.12)', color: '#00C896', border: 'none', cursor: 'pointer' }}
                                  onClick={e => { e.stopPropagation(); alert(`Mark PO ${po.id} as received`) }}>
                            Mark received
                          </button>
                        )}
                        {po.status === 'overdue' && (
                          <button className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                                  style={{ background: 'rgba(232,69,69,0.12)', color: '#E84545', border: 'none', cursor: 'pointer' }}
                                  onClick={e => { e.stopPropagation(); alert(`Chase supplier: ${po.supplier}`) }}>
                            Chase supplier
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      <DrillPanel
        open={drill.open}
        title={drill.title}
        onClose={() => setDrill(d => ({ ...d, open: false }))}
      >
        {drill.po && <>
          <DrillKpi label="SKU"      value={drill.po.sku} />
          <DrillKpi label="Item"     value={drill.po.item} />
          <DrillKpi label="Supplier" value={drill.po.supplier} />
          <DrillKpi label="Quantity" value={drill.po.qty} />
          <DrillKpi label="Value"    value={drill.po.value} />
          <DrillKpi label="Status"   value={drill.po.status} />
          <DrillKpi label="Expected" value={drill.po.exp} />
          <DrillRow label="PO number" value={drill.po.id} />
        </>}
      </DrillPanel>

      <Chatbot />
    </div>
  )
}
