'use client'
// apps/web/app/admin/page.tsx — Req 10: Super admin panel
import { useState } from 'react'
import { Sidebar }  from '../../components/Sidebar'
import { Chatbot }  from '../../components/Chatbot'
import { DrillPanel, DrillKpi, DrillRow } from '../../components/DrillPanel'
import { useUser }  from '../../hooks/useUser'

const MOCK_USERS = [
  { id: '1', name: 'Rajesh Kumar',   email: 'rajesh@vizai.in',  role: 'manager',     active: true,  last_login: '2 hr ago' },
  { id: '2', name: 'Priya Subramanian', email: 'priya@vizai.in', role: 'ops',        active: true,  last_login: '15 min ago' },
  { id: '3', name: 'Karthik Anand', email: 'karthik@vizai.in', role: 'ops',          active: true,  last_login: '1 hr ago' },
  { id: '4', name: 'Meena Lakshmi', email: 'meena@vizai.in',   role: 'user',         active: true,  last_login: 'Yesterday' },
  { id: '5', name: 'Arun Selvam',   email: 'arun@vizai.in',    role: 'user',         active: false, last_login: '2 weeks ago' },
]
const AUDIT = [
  { action: 'po_created',   user: 'Priya Subramanian', detail: 'PO-2024-0895 · ₹24,00,000', time: '10:42' },
  { action: 'item_flagged', user: 'Karthik Anand',     detail: 'VZ-SPA-044 Drive Motor — bearing failure', time: '09:15' },
  { action: 'zoho_sync',    user: 'System',            detail: '16 items synced · 0 errors', time: '06:00' },
  { action: 'login',        user: 'Rajesh Kumar',      detail: 'Medavakkam · Chrome', time: 'Yesterday' },
]
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  super_admin: { bg: 'rgba(167,139,250,0.12)', text: '#A78BFA' },
  manager:     { bg: 'rgba(0,200,150,0.12)',   text: '#00C896' },
  ops:         { bg: 'rgba(74,158,255,0.12)',  text: '#4A9EFF' },
  user:        { bg: 'rgba(255,255,255,0.06)', text: '#9BA3AF' },
}
const ROLE_ORDER = ['super_admin','manager','ops','user']

export default function AdminPage() {
  const { user }                         = useUser()
  const [users, setUsers]                = useState(MOCK_USERS)
  const [drill, setDrill]                = useState<{ open: boolean; u?: typeof MOCK_USERS[0] }>({ open: false })
  const [tab,   setTab]                  = useState<'users' | 'audit' | 'whitelist' | 'settings'>('users')

  if (user && user.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#0D0F12' }}>
        <div className="text-center">
          <i className="ti ti-shield-off text-4xl mb-4" style={{ color: '#E84545' }} aria-hidden="true" />
          <div className="text-white font-medium">Access denied</div>
          <div className="text-sm mt-1" style={{ color: '#5A6272' }}>Super admin only</div>
        </div>
      </div>
    )
  }

  function toggleActive(id: string) {
    setUsers(us => us.map(u => u.id === id ? { ...u, active: !u.active } : u))
  }
  function changeRole(id: string, role: string) {
    setUsers(us => us.map(u => u.id === id ? { ...u, role } : u))
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0D0F12' }}>
      <Sidebar role="super_admin" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 h-12 flex-shrink-0"
                style={{ background: '#1A1D23', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <div className="text-sm font-medium text-white">Super admin panel</div>
            <div className="text-xs" style={{ color: '#5A6272' }}>VizAI Engineering — full access</div>
          </div>
          <span className="text-xs px-2 py-1 rounded font-mono"
                style={{ background: 'rgba(167,139,250,0.12)', color: '#A78BFA' }}>
            super_admin
          </span>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#1A1D23' }}>
          {(['users','audit','whitelist','settings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
                    className="text-xs px-3 py-1.5 rounded transition-colors"
                    style={{
                      background: tab === t ? '#2A2F3A' : 'none',
                      color: tab === t ? '#F0F2F5' : '#5A6272',
                      border: 'none', cursor: 'pointer',
                    }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto p-4">

          {/* Users tab */}
          {tab === 'users' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">Team members</span>
                <button className="text-xs px-3 py-1.5 rounded font-medium transition-opacity hover:opacity-90"
                        style={{ background: '#00C896', color: '#000', border: 'none', cursor: 'pointer' }}
                        onClick={() => alert('Invite user modal')}>
                  <i className="ti ti-plus mr-1" aria-hidden="true" />Invite user
                </button>
              </div>
              <div className="rounded-xl overflow-hidden"
                   style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {['Name','Email','Role','Last login','Status','Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ color: '#5A6272' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const rc = ROLE_COLORS[u.role]
                      return (
                        <tr key={u.id}
                            className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                            onClick={() => setDrill({ open: true, u })}>
                          <td className="px-4 py-3 font-medium" style={{ color: '#F0F2F5' }}>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                                   style={{ background: '#22262E', color: '#9BA3AF' }}>
                                {u.name[0]}
                              </div>
                              {u.name}
                            </div>
                          </td>
                          <td className="px-4 py-3" style={{ color: '#5A6272' }}>{u.email}</td>
                          <td className="px-4 py-3">
                            <select
                              value={u.role}
                              onClick={e => e.stopPropagation()}
                              onChange={e => changeRole(u.id, e.target.value)}
                              className="text-xs px-2 py-1 rounded outline-none"
                              style={{ background: rc.bg, color: rc.text, border: 'none', cursor: 'pointer' }}
                            >
                              {ROLE_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3" style={{ color: '#5A6272' }}>{u.last_login}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded"
                                  style={{ background: u.active ? 'rgba(0,200,150,0.12)' : 'rgba(232,69,69,0.12)',
                                           color: u.active ? '#00C896' : '#E84545' }}>
                              {u.active ? 'active' : 'suspended'}
                            </span>
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <button
                              className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                              style={{ background: '#22262E', color: u.active ? '#E84545' : '#00C896',
                                       border: 'none', cursor: 'pointer' }}
                              onClick={() => toggleActive(u.id)}
                            >
                              {u.active ? 'Suspend' : 'Reactivate'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Audit tab */}
          {tab === 'audit' && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-white mb-3">Audit log</div>
              {AUDIT.map((a, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg"
                     style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#00C896' }} />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-white">{a.action.replace(/_/g,' ')}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#5A6272' }}>{a.detail}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs" style={{ color: '#9BA3AF' }}>{a.user}</div>
                    <div className="text-xs" style={{ color: '#5A6272' }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Whitelist tab */}
          {tab === 'whitelist' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">Approved items whitelist</span>
                <button className="text-xs px-3 py-1.5 rounded font-medium"
                        style={{ background: '#00C896', color: '#000', border: 'none', cursor: 'pointer' }}
                        onClick={() => alert('Bulk CSV import modal')}>
                  <i className="ti ti-upload mr-1" aria-hidden="true" />Import CSV
                </button>
              </div>
              <div className="rounded-xl p-3 text-xs" style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="font-medium text-white mb-2">Protected VizAI raw materials (cannot be removed)</div>
                <div className="flex flex-wrap gap-2">
                  {['Electric Forklifts','Pallet Trucks','Stackers','Scissor Lifts',
                    'IoT Gateway Modules','RFID Readers','Vibration Sensors',
                    'Drive Motors','Hydraulic Cylinders','Control PCBs','Battery Packs'].map(i => (
                    <span key={i} className="px-2 py-1 rounded-full"
                          style={{ background: 'rgba(0,200,150,0.1)', color: '#00C896', border: '1px solid rgba(0,200,150,0.2)' }}>
                      {i}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl p-3 text-xs" style={{ background: '#1A1D23', border: '1px solid rgba(232,69,69,0.15)' }}>
                <div className="font-medium mb-2" style={{ color: '#E84545' }}>Recent whitelist blocks</div>
                {[
                  { item: 'Sugar 5kg', user: 'Meena Lakshmi', time: '10 min ago' },
                  { item: 'Cement 50kg', user: 'Arun Selvam',  time: '2 hr ago' },
                ].map((b, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b last:border-0"
                       style={{ borderColor: 'rgba(255,255,255,0.04)', color: '#9BA3AF' }}>
                    <span>{b.item}</span>
                    <span style={{ color: '#5A6272' }}>{b.user} · {b.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings tab */}
          {tab === 'settings' && (
            <div className="space-y-3 max-w-lg">
              <div className="text-sm font-medium text-white mb-3">Organisation settings</div>
              {[
                { label: 'Organisation', value: 'VizAI Engineering' },
                { label: 'Plan',         value: 'Pro' },
                { label: 'Product limit', value: '1,000 SKUs' },
                { label: 'Zoho DC',      value: 'India (in)' },
                { label: 'Zoho Org ID',  value: '••••••••••' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between p-3 rounded-lg"
                     style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-xs" style={{ color: '#5A6272' }}>{s.label}</span>
                  <span className="text-xs font-mono text-white">{s.value}</span>
                </div>
              ))}
              <button className="w-full py-2.5 rounded-lg text-sm font-medium mt-2 transition-opacity hover:opacity-90"
                      style={{ background: '#4A9EFF', color: '#fff', border: 'none', cursor: 'pointer' }}
                      onClick={() => alert('Zoho connect flow')}>
                Reconnect Zoho Inventory
              </button>
            </div>
          )}
        </main>
      </div>

      <DrillPanel
        open={drill.open}
        title={drill.u?.name ?? 'User detail'}
        onClose={() => setDrill({ open: false })}
      >
        {drill.u && <>
          <DrillKpi label="Name"  value={drill.u.name} />
          <DrillKpi label="Email" value={drill.u.email} />
          <DrillKpi label="Role"  value={drill.u.role} />
          <DrillKpi label="Status" value={drill.u.active ? 'Active' : 'Suspended'} />
          <DrillRow label="Last login" value={drill.u.last_login} />
        </>}
      </DrillPanel>

      <Chatbot />
    </div>
  )
}
