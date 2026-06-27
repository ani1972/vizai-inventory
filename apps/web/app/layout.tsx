import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       'VizAI Inventory',
  description: 'Agentic inventory management for VizAI Engineering',
  manifest:    '/manifest.json',
  icons:       { icon: '/icon-192.png', apple: '/icon-512.png' },
}
export const viewport: Viewport = {
  themeColor:  '#0D0F12',
  width:       'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.2.0/dist/tabler-icons.min.css" />
      </head>
      <body className="bg-bg text-white antialiased">{children}</body>
    </html>
  )
}
