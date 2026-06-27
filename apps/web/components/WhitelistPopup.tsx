'use client'
// apps/web/components/WhitelistPopup.tsx
// Req 12: fires when item not on approved list
import { useState } from 'react'

interface WhitelistPopupProps {
  open:         boolean
  blockedSku:   string
  blockedName:  string
  onClose:      () => void
  onRequest:    () => void
}

export function WhitelistPopup({ open, blockedSku, blockedName, onClose, onRequest }: WhitelistPopupProps) {
  const [requested, setRequested] = useState(false)

  function handleRequest() {
    setRequested(true)
    onRequest()
    setTimeout(() => { setRequested(false); onClose() }, 2000)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
           style={{ background: '#1A1D23', border: '1px solid rgba(255,255,255,0.08)' }}
           role="alertdialog" aria-modal="true" aria-labelledby="wl-title">

        {/* Red stripe */}
        <div style={{ height: 4, background: '#E84545' }} />

        <div className="p-5">
          {/* Icon + title */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(232,69,69,0.12)', border: '1px solid rgba(232,69,69,0.2)' }}>
              <i className="ti ti-ban text-xl" style={{ color: '#E84545' }} aria-hidden="true" />
            </div>
            <div>
              <h2 id="wl-title" className="text-sm font-medium text-white mb-1">
                Item not on approved list
              </h2>
              <p className="text-xs leading-relaxed" style={{ color: '#9BA3AF' }}>
                This item isn&apos;t approved for procurement at VizAI Engineering.
                Only whitelisted equipment and raw materials may be added.
              </p>
            </div>
          </div>

          {/* Blocked item card */}
          <div className="rounded-lg p-3 mb-3"
               style={{ background: '#22262E', border: '1px solid rgba(232,69,69,0.15)' }}>
            <div className="text-xs mb-1 font-mono" style={{ color: '#E84545' }}>
              {blockedSku || 'NOT ON WHITELIST'}
            </div>
            <div className="text-sm font-medium text-white">{blockedName}</div>
            <div className="text-xs mt-1" style={{ color: '#5A6272' }}>
              Not found in approved catalogue
            </div>
          </div>

          {/* Rule box */}
          <div className="rounded-lg p-3 mb-3 text-xs leading-relaxed"
               style={{ background: '#22262E', color: '#9BA3AF' }}>
            <span className="text-white font-medium">Why was this blocked? </span>
            VizAI&apos;s whitelist covers industrial equipment, IoT devices, and certified spare parts only.
            Consumer goods and unrelated materials are not approved.
          </div>

          {/* Contact */}
          <div className="rounded-lg p-3 mb-4 flex items-center gap-3"
               style={{ background: '#22262E' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                 style={{ background: 'rgba(74,158,255,0.15)', color: '#4A9EFF' }}>
              RK
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium text-white">Rajesh Kumar — Procurement manager</div>
              <div className="text-xs mt-0.5" style={{ color: '#5A6272' }}>
                Raise an approval request to add this item
              </div>
            </div>
            <i className="ti ti-mail text-base" style={{ color: '#4A9EFF' }} aria-hidden="true" />
          </div>

          {/* Actions */}
          {requested ? (
            <div className="text-center py-2 text-sm" style={{ color: '#00C896' }}>
              <i className="ti ti-circle-check mr-2" aria-hidden="true" />
              Request sent to Rajesh Kumar
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleRequest}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                style={{ background: '#00C896', color: '#000' }}
              >
                Request approval
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg text-sm transition-colors"
                style={{ background: '#2A2F3A', color: '#F0F2F5', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Audit log badge */}
          <div className="mt-3 text-center">
            <span className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{ background: 'rgba(232,69,69,0.1)', color: '#E84545' }}>
              Logged {new Date().toLocaleTimeString('en-IN')} · whitelist_log
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
