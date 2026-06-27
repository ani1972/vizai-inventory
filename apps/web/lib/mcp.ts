// apps/web/lib/mcp.ts
// Typed client for all 4 MCP workers
// Called from server components / API routes only (MCP_SECRET stays server-side)

const BASE  = process.env.MCP_BASE_URL  ?? 'http://localhost:8787'
const SECRET = process.env.MCP_SECRET   ?? ''

async function call<T>(path: string, orgId: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  body ? 'POST' : 'GET',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SECRET}`,
      'X-Org-Id':      orgId,
    },
    body: body ? JSON.stringify(body) : undefined,
    next: { revalidate: 0 },
  })
  const json = await res.json() as { ok: boolean; data: T; error?: string }
  if (!json.ok) throw new Error(json.error ?? 'MCP error')
  return json.data
}

// ── Inventory MCP ────────────────────────────────────────────
export const inventory = {
  stockSummary:   (orgId: string)                    => call('/inventory/stock-summary', orgId),
  itemDetail:     (orgId: string, sku: string)       => call('/inventory/item-detail', orgId, { sku }),
  lowStock:       (orgId: string)                    => call('/inventory/low-stock', orgId),
  damaged:        (orgId: string)                    => call('/inventory/damaged', orgId),
  hashmapStats:   (orgId: string)                    => call('/inventory/hashmap-stats', orgId),
  whitelistCheck: (orgId: string, sku: string, name: string) =>
    call<{ allowed: boolean }>('/inventory/whitelist-check', orgId, { sku, name }),
}

// ── Orders MCP ──────────────────────────────────────────────
export const orders = {
  open:      (orgId: string, status?: string)           => call('/orders/open', orgId, { status }),
  create:    (orgId: string, data: Record<string, unknown>) => call('/orders/create', orgId, data),
  update:    (orgId: string, poId: string, status: string)  => call('/orders/update', orgId, { po_id: poId, status }),
  zohoSync:  (orgId: string)                            => call('/orders/zoho-sync', orgId),
}

// ── Supplier MCP ────────────────────────────────────────────
export const supplier = {
  list:        (orgId: string)                      => call('/supplier/list', orgId),
  forItem:     (orgId: string, sku: string)         => call('/supplier/for-item', orgId, { sku }),
  leadTimes:   (orgId: string)                      => call('/supplier/lead-times', orgId),
  overdue:     (orgId: string)                      => call('/supplier/overdue', orgId),
}

// ── Alerts MCP ──────────────────────────────────────────────
export const alerts = {
  notifications: (orgId: string, filter?: string)   => call('/alerts/notifications', orgId, { filter }),
  markRead:      (orgId: string, ids: string[])     => call('/alerts/mark-read', orgId, { ids: JSON.stringify(ids) }),
  flagCondition: (orgId: string, data: Record<string, unknown>) => call('/alerts/flag-condition', orgId, data),
  report:        (orgId: string, data: Record<string, unknown>) => call('/alerts/report', orgId, data),
  stockCheck:    (orgId: string)                    => call('/alerts/stock-check', orgId),
}
