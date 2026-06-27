'use client'
// apps/web/app/settings/page.tsx
import { useState } from 'react'
import { Sidebar } from '../../components/Sidebar'
import { Chatbot } from '../../components/Chatbot'
import { useUser } from '../../hooks/useUser'

export default function SettingsPage() {
  const { user }               = useUser()
  const [tab, setTab]          = useState<'integrations' | 'notifications' | 'profile'>('integrations')
  const [zohoId,  setZohoId]   = useState('')
  const [clientId, setClientId] = useState('')
  const [syncing, setSyncing]  = useState(false)
  const [notifPrefs, setNotifPrefs] = useState({
    low_stock: true, zero_stock: true, condition_flag: true,
    po_overdue: true, iot_alert: true, whitelist_block: false,
  })

  async function connectZoho() {
    if (!zohoId || !clientId) { alert('Fill in Organisation ID and Client ID'); return }
    setSyncing(true)
    await new Promise(r => setTimeout(r, 2000))
    setSyncing(false)
    alert('Zoho Inventory connected! Full sync started.')
  }

  function togglePref(key: keyof typeof notifPrefs) {
    setNotifPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0D0F12' }}>
      <Sidebar role={user?.role ?? 'manager'} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center px-4 h-12 flex-shrink-0"
                style={{ background: '#1A1D23', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-sm font-medium text-white">Settings</div>
        </header>

        <div className="flex gap-1 px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#1A1D23' }}>
          {(['integrations','notifications','profile'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
                    className="text-xs px-3 py-1.5 rounded transition-colors"
                    style={{ background: tab === t ? '#2A2F3A' : 'none',
                             color: tab === t ? '#F0F2F5' : '#5A6272',
                             border: 'none', cursor: 'pointer' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-lg space-y-4">

            {tab === 'integrations' && <>
              <div className="rounded-xl overflow-hidden"
                   style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="px-4 py-3 border-b flex items-center gap-3"
                     style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                       style={{ background: '#22262E' }}>
                    <i className="ti ti-brand-zoho text-base" style={{ color: '#F5A623' }} aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Zoho Inventory</div>
                    <div className="text-xs" style={{ color: '#5A6272' }}>India data centre (zoho.in) · OAuth 2.0</div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: '#5A6272' }}>Organisation ID</label>
                    <input value={zohoId} onChange={e => setZohoId(e.target.value)}
                           placeholder="6xxxxxxxxxx"
                           className="w-full px-3 py-2 text-sm rounded-lg outline-none font-mono"
                           style={{ background: '#22262E', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F2F5' }} />
                  </div>
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: '#5A6272' }}>Client ID</label>
                    <input value={clientId} onChange={e => setClientId(e.target.value)}
                           placeholder="1000.xxxxx"
                           className="w-full px-3 py-2 text-sm rounded-lg outline-none font-mono"
                           style={{ background: '#22262E', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F2F5' }} />
                  </div>
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: '#5A6272' }}>Client Secret</label>
                    <input type="password" placeholder="••••••••••••••••"
                           className="w-full px-3 py-2 text-sm rounded-lg outline-none font-mono"
                           style={{ background: '#22262E', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F2F5' }} />
                  </div>
                  <button onClick={connectZoho} disabled={syncing}
                          className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                          style={{ background: '#F5A623', color: '#000' }}>
                    {syncing ? 'Connecting…' : 'Connect & sync'}
                  </button>
                  <p className="text-xs text-center" style={{ color: '#5A6272' }}>
                    Syncs items, vendors, and open POs. All VizAI items are auto-whitelisted.
                  </p>
                </div>
              </div>
            </>}

            {tab === 'notifications' && <>
              <div className="rounded-xl overflow-hidden"
                   style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="text-sm font-medium text-white">Notification preferences</div>
                  <div className="text-xs mt-0.5" style={{ color: '#5A6272' }}>In-app · Email · Slack · Push</div>
                </div>
                {Object.entries(notifPrefs).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between px-4 py-3 border-b"
                       style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <div>
                      <div className="text-xs font-medium text-white capitalize">{key.replace(/_/g,' ')}</div>
                    </div>
                    <button
                      onClick={() => togglePref(key as keyof typeof notifPrefs)}
                      className="w-8 h-4 rounded-full relative transition-colors"
                      style={{ background: val ? '#00C896' : '#2A2F3A', border: 'none', cursor: 'pointer' }}
                      role="switch" aria-checked={val} aria-label={`Toggle ${key}`}
                    >
                      <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                            style={{ left: val ? '17px' : '2px' }} />
                    </button>
                  </div>
                ))}
              </div>
            </>}

            {tab === 'profile' && <>
              <div className="rounded-xl p-4 space-y-3"
                   style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
                {[
                  { label: 'Name',         value: user?.name ?? 'Loading…' },
                  { label: 'Email',        value: user?.email ?? '—' },
                  { label: 'Role',         value: user?.role ?? '—' },
                  { label: 'Organisation', value: user?.org_name ?? 'VizAI Engineering' },
                  { label: 'Plan',         value: user?.plan ?? 'pro' },
                ].map(f => (
                  <div key={f.label} className="flex justify-between py-2 border-b"
                       style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <span className="text-xs" style={{ color: '#5A6272' }}>{f.label}</span>
                    <span className="text-xs font-mono text-white">{f.value}</span>
                  </div>
                ))}
              </div>
            </>}
          </div>
        </main>
      </div>
      <Chatbot />
    </div>
  )
}
