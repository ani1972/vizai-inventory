'use client'
// apps/web/components/Sidebar.tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const NAV = [
  { href: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { href: '/ops',       icon: 'ti-packages',         label: 'Operations' },
  { href: '/user',      icon: 'ti-search',            label: 'Items' },
  { href: '/reports',   icon: 'ti-chart-bar',         label: 'Reports' },
  { href: '/iot',       icon: 'ti-cpu',               label: 'IoT' },
  { href: '/settings',  icon: 'ti-settings',          label: 'Settings' },
]
const ADMIN_NAV = [
  { href: '/admin',     icon: 'ti-shield',            label: 'Admin' },
]

interface SidebarProps {
  role:          string
  unreadCount?:  number
  onNotif?:      () => void
}

export function Sidebar({ role, unreadCount = 0, onNotif }: SidebarProps) {
  const path = usePathname()

  return (
    <aside
      className="flex flex-col items-center py-3 gap-1 flex-shrink-0"
      style={{ width: 56, background: '#1A1D23', borderRight: '1px solid rgba(255,255,255,0.05)' }}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <Link href="/dashboard"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-black text-xs font-bold mb-3"
            style={{ background: '#00C896' }}
            aria-label="VizAI home">
        VZ
      </Link>

      {NAV.map(n => (
        <Link
          key={n.href}
          href={n.href}
          title={n.label}
          className={clsx(
            'w-9 h-9 rounded-lg flex items-center justify-center transition-colors text-base',
            path.startsWith(n.href)
              ? 'text-acc'
              : 'text-gray-600 hover:text-gray-300 hover:bg-s3'
          )}
          style={path.startsWith(n.href) ? { background: '#2A2F3A', color: '#00C896' } : undefined}
          aria-current={path.startsWith(n.href) ? 'page' : undefined}
        >
          <i className={`ti ${n.icon}`} aria-hidden="true" />
        </Link>
      ))}

      {/* Notifications bell */}
      <button
        onClick={onNotif}
        title="Notifications"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-base text-gray-600 hover:text-gray-300 hover:bg-s3 relative transition-colors"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ''}`}
      >
        <i className="ti ti-bell" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                style={{ background: '#E84545' }} aria-hidden="true" />
        )}
      </button>

      <div className="flex-1" />

      {/* Admin link — only for super_admin */}
      {role === 'super_admin' && ADMIN_NAV.map(n => (
        <Link
          key={n.href}
          href={n.href}
          title={n.label}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-base text-gray-600 hover:text-gray-300 hover:bg-s3 transition-colors"
        >
          <i className={`ti ${n.icon}`} aria-hidden="true" />
        </Link>
      ))}
    </aside>
  )
}
