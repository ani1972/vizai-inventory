'use client'
// apps/web/components/DrillPanel.tsx
// Req 9: click any number or row → slide-in detail panel
import { useEffect, useRef } from 'react'
import clsx from 'clsx'

interface DrillPanelProps {
  open:     boolean
  title:    string
  onClose:  () => void
  children: React.ReactNode
}

export function DrillPanel({ open, title, onClose, children }: DrillPanelProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (ref.current && !ref.current.contains(e.target as Node)) onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={ref}
        className={clsx(
          'w-full max-w-sm bg-s1 border-l border-white/10 h-full overflow-y-auto',
          'flex flex-col',
          'animate-in slide-in-from-right duration-200'
        )}
        style={{ background: '#1A1D23' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 sticky top-0 z-10"
             style={{ background: '#1A1D23' }}>
          <span className="text-sm font-medium text-white">{title}</span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded"
            aria-label="Close panel"
          >
            <i className="ti ti-x text-base" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-3">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Reusable drill KPI card ──────────────────────────────────
export function DrillKpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: '#22262E' }}>
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-lg font-medium font-mono text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

// ── Drill ledger row ─────────────────────────────────────────
export function DrillRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={clsx('text-xs font-mono', accent ? 'text-acc' : 'text-gray-300')}
            style={accent ? { color: '#00C896' } : undefined}>
        {value}
      </span>
    </div>
  )
}
