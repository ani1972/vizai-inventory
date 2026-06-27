'use client'
// apps/web/app/user/page.tsx — Req 8: User view — search, browse, request
import { useState, useMemo } from 'react'
import { Sidebar }           from '../../components/Sidebar'
import { Chatbot }           from '../../components/Chatbot'
import { DrillPanel, DrillKpi, DrillRow } from '../../components/DrillPanel'
import { WhitelistPopup }    from '../../components/WhitelistPopup'
import { useUser }           from '../../hooks/useUser'

const CATALOGUE = [
  { sku: 'VZ-FLT-001', name: 'Electric Forklift 3T',    cat: 'Forklifts',     stock: 4,  status: 'ok',       price: '₹18,50,000' },
  { sku: 'VZ-FLT-002', name: 'Electric Forklift 5T',    cat: 'Forklifts',     stock: 2,  status: 'ok',       price: '₹24,00,000' },
  { sku: 'VZ-PLT-011', name: 'Pallet Truck 2T',         cat: 'Pallet Trucks', stock: 8,  status: 'ok',       price: '₹1,20,000'  },
  { sku: 'VZ-PLT-012', name: 'Pallet Truck 1.5T',       cat: 'Pallet Trucks', stock: 5,  status: 'ok',       price: '₹95,000'    },
  { sku: 'VZ-STK-021', name: 'Reach Stacker 1.6T',      cat: 'Stackers',      stock: 1,  status: 'low',      price: '₹4,80,000'  },
  { sku: 'VZ-STK-022', name: 'Walkie Stacker 1T',       cat: 'Stackers',      stock: 3,  status: 'ok',       price: '₹2,80,000'  },
  { sku: 'VZ-SCL-031', name: 'Scissor Lift 500kg',      cat: 'Scissor Lifts', stock: 3,  status: 'ok',       price: '₹6,20,000'  },
  { sku: 'VZ-SCL-032', name: 'Scissor Lift 1000kg',     cat: 'Scissor Lifts', stock: 2,  status: 'ok',       price: '₹9,80,000'  },
  { sku: 'VZ-IOT-041', name: 'IoT Gateway Module',      cat: 'IoT Devices',   stock: 12, status: 'ok',       price: '₹45,000'    },
  { sku: 'VZ-RFD-051', name: 'RFID Reader 900MHz',      cat: 'IoT Devices',   stock: 7,  status: 'ok',       price: '₹28,000'    },
  { sku: 'VZ-VIB-061', name: 'Vibration Sensor',        cat: 'IoT Devices',   stock: 0,  status: 'critical', price: '₹8,500'     },
  { sku: 'VZ-TMP-071', name: 'Temperature Sensor',      cat: 'IoT Devices',   stock: 6,  status: 'ok',       price: '₹6,500'     },
  { sku: 'VZ-SPA-044', name: 'Drive Motor 15kW',        cat: 'Spare Parts',   stock: 5,  status: 'ok',       price: '₹95,000'    },
  { sku: 'VZ-SPA-055', name: 'Hydraulic Cylinder',      cat: 'Spare Parts',   stock: 2,  status: 'low',      price: '₹42,000'    },
  { sku: 'VZ-SPA-066', name: 'Control Board PCB',       cat: 'Spare Parts',   stock: 8,  status: 'ok',       price: '₹18,000'    },
  { sku: 'VZ-SPA-077', name: 'Lithium Battery Pack 48V',cat: 'Spare Parts',   stock: 3,  status: 'ok',       price: '₹1,45,000'  },
]

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ok:       { bg: 'rgba(0,200,150,0.12)',   text: '#00C896', label: 'in stock'  },
  low:      { bg: 'rgba(245,166,35,0.12)',  text: '#F5A623', label: 'low stock' },
  critical: { bg: 'rgba(232,69,69,0.12)',   text: '#E84545', label: 'zero stock'},
}

const CATEGORIES = ['All', ...Array.from(new Set(CATALOGUE.map(i => i.cat)))]

export default function UserPage() {
  const { user }                          = useUser()
  const [query,  setQuery]               = useState('')
  const [cat,    setCat]                 = useState('All')
  const [drill,  setDrill]               = useState<{ open: boolean; item?: typeof CATALOGUE[0] }>({ open: false })
  const [wl,     setWl]                  = useState<{ open: boolean; name: string }>({ open: false, name: '' })
  const [addInput, setAddInput]          = useState('')

  const items = useMemo(() => {
    const q = query.toLowerCase()
    return CATALOGUE.filter(i =>
      (cat === 'All' || i.cat === cat) &&
      (!q || i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
    )
  }, [query, cat])

  const WHITELIST_KEYS = ['vz-', 'forklift', 'pallet', 'stacker', 'scissor', 'iot', 'rfid',
                          'vibration', 'sensor', 'gateway', 'motor', 'hydraulic', 'pcb', 'battery']

  function tryAdd() {
    const v = addInput.trim()
    if (!v) return
    const approved = WHITELIST_KEYS.some(k => v.toLowerCase().includes(k))
    if (!approved) { setWl({ open: true, name: v }); return }
    alert(`"${v}" is on the whitelist — item added.`)
    setAddInput('')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0D0F12' }}>
      <Sidebar role={user?.role ?? 'user'} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-3 px-4 h-12 flex-shrink-0"
                style={{ background: '#1A1D23', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex-1">
            <div className="text-sm font-medium text-white">Item catalogue</div>
            <div className="text-xs" style={{ color: '#5A6272' }}>Search · Browse · Request</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Search + add */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                 style={{ color: '#5A6272' }} aria-hidden="true" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search SKU or product name…"
                className="w-full pl-8 pr-4 py-2 text-sm rounded-lg outline-none transition-colors"
                style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.08)',
                         color: '#F0F2F5' }}
                aria-label="Search items"
              />
            </div>
            <input
              value={addInput}
              onChange={e => setAddInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && tryAdd()}
              placeholder="Add item…"
              className="px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.08)',
                       color: '#F0F2F5', width: 160 }}
              aria-label="Add item to inventory"
            />
            <button
              onClick={tryAdd}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-opacity hover:opacity-90"
              style={{ background: '#00C896', color: '#000' }}
            >
              Add
            </button>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCat(c)}
                      className="text-xs px-3 py-1.5 rounded-full transition-colors"
                      style={{
                        background: cat === c ? '#2A2F3A' : '#1A1D23',
                        color:      cat === c ? '#F0F2F5' : '#5A6272',
                        border:     `1px solid ${cat === c ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}`,
                      }}>
                {c}
              </button>
            ))}
            <span className="ml-auto text-xs self-center" style={{ color: '#5A6272' }}>
              {items.length} items
            </span>
          </div>

          {/* Table */}
          <div className="rounded-xl overflow-hidden"
               style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['SKU','Product','Category','Stock','Status',''].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ color: '#5A6272' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const sc = STATUS_COLORS[item.status]
                  return (
                    <tr key={item.sku}
                        className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                        onClick={() => setDrill({ open: true, item })}>
                      <td className="px-4 py-3 font-mono" style={{ color: '#F0F2F5' }}>{item.sku}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: '#F0F2F5' }}>{item.name}</td>
                      <td className="px-4 py-3" style={{ color: '#5A6272' }}>{item.cat}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: '#9BA3AF' }}>{item.stock}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded"
                              style={{ background: sc.bg, color: sc.text }}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                          style={{ background: '#22262E', color: '#4A9EFF', border: '1px solid rgba(74,158,255,0.2)' }}
                          onClick={e => { e.stopPropagation(); alert(`Request raised for ${item.sku}`) }}
                        >
                          Request
                        </button>
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
        title={drill.item?.sku ?? 'Item detail'}
        onClose={() => setDrill({ open: false })}
      >
        {drill.item && <>
          <DrillKpi label="SKU"       value={drill.item.sku} />
          <DrillKpi label="Product"   value={drill.item.name} />
          <DrillKpi label="Category"  value={drill.item.cat} />
          <DrillKpi label="In stock"  value={drill.item.stock} />
          <DrillKpi label="Unit cost" value={drill.item.price} />
          <DrillRow label="Status"  value={STATUS_COLORS[drill.item.status].label} accent />
          <button
            className="w-full mt-4 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: '#00C896', color: '#000' }}
            onClick={() => alert(`Request raised for ${drill.item?.sku}`)}
          >
            Raise request for this item
          </button>
        </>}
      </DrillPanel>

      <WhitelistPopup
        open={wl.open}
        blockedSku=""
        blockedName={wl.name}
        onClose={() => { setWl({ open: false, name: '' }); setAddInput('') }}
        onRequest={() => setAddInput('')}
      />

      <Chatbot />
    </div>
  )
}
