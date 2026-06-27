// apps/mcp-supplier/src/index.ts
// Supplier MCP — Cloudflare Worker
// Req 1: unifies REST/EDI supplier APIs behind one interface
// Tools: get_suppliers, get_supplier_quotes, get_lead_times, update_fill_rate
// Format routing: TSV for flat lists, JSON for nested quote objects

import { decideFormat } from '../../../packages/shared/types'
import type { McpResponse, Supplier } from '../../../packages/shared/types'

interface Env {
  SUPABASE_URL: string
  SUPABASE_KEY: string
  MCP_SECRET:   string
  // Zoho Inventory vendor API (reuses Orders MCP tokens via KV)
  ZOHO_CLIENT_ID:     string
  ZOHO_CLIENT_SECRET: string
  ZOHO_REFRESH_TOKEN: string
  ZOHO_ORG_ID:        string
  ZOHO_DC:            string
  ZOHO_TOKEN_CACHE:   KVNamespace
}

function authenticate(req: Request, env: Env): boolean {
  return req.headers.get('Authorization') === `Bearer ${env.MCP_SECRET}`
}

async function sb(env: Env, path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey':        env.SUPABASE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

function ok<T>(data: T, rows = 1, nested = false): Response {
  const routing = decideFormat(rows, nested, false)
  const body: McpResponse<T> = { ok: true, data, format: routing.format, cached: false }
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}

function err(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: msg, format: 'json', cached: false }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

async function getZohoToken(env: Env): Promise<string | null> {
  if (!env.ZOHO_CLIENT_ID) return null
  const cached = await env.ZOHO_TOKEN_CACHE.get('access_token')
  if (cached) return cached
  const dc = env.ZOHO_DC ?? 'in'
  const res = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     env.ZOHO_CLIENT_ID,
      client_secret: env.ZOHO_CLIENT_SECRET,
      refresh_token: env.ZOHO_REFRESH_TOKEN,
    }),
  })
  const json = await res.json() as { access_token: string; expires_in: number }
  await env.ZOHO_TOKEN_CACHE.put('access_token', json.access_token, {
    expirationTtl: json.expires_in - 60,
  })
  return json.access_token
}

// ── Tool: get_suppliers ───────────────────────────────────────
// Returns supplier list with fill rate + lead time — TSV format
async function getSuppliers(orgId: string, env: Env): Promise<Response> {
  const suppliers = await sb(env,
    `suppliers?org_id=eq.${orgId}&select=id,name,contact_email,avg_lead_days,fill_rate_pct&order=fill_rate_pct.desc`
  ) as Supplier[]
  // TSV: flat list, no nesting (req 3)
  return ok(suppliers, suppliers.length, false)
}

// ── Tool: get_supplier_for_item ───────────────────────────────
// Given a SKU, returns best supplier by fill rate + lead time
async function getSupplierForItem(sku: string, orgId: string, env: Env): Promise<Response> {
  // Find item
  const items = await sb(env,
    `items?sku=eq.${sku}&org_id=eq.${orgId}&select=id,name,category&limit=1`
  ) as Array<{ id: string; name: string; category: string }>
  if (!items.length) return err(`Item ${sku} not found`)

  // Get PO history to find which suppliers have fulfilled this item
  const pos = await sb(env,
    `purchase_orders?item_id=eq.${items[0].id}&status=eq.received&select=supplier_id,suppliers(id,name,avg_lead_days,fill_rate_pct,contact_email)&order=created_at.desc&limit=10`
  ) as Array<{ supplier_id: string; suppliers: Supplier }>

  const supplierMap = new Map<string, Supplier>()
  for (const po of pos) {
    if (po.suppliers && !supplierMap.has(po.supplier_id)) {
      supplierMap.set(po.supplier_id, po.suppliers)
    }
  }

  const ranked = Array.from(supplierMap.values())
    .sort((a, b) => (b.fill_rate_pct ?? 0) - (a.fill_rate_pct ?? 0))

  return ok({ item: items[0], recommended_suppliers: ranked }, 1, true)
}

// ── Tool: get_lead_times ──────────────────────────────────────
// Returns TSV of supplier + avg lead days for dashboard view
async function getLeadTimes(orgId: string, env: Env): Promise<Response> {
  const suppliers = await sb(env,
    `suppliers?org_id=eq.${orgId}&select=name,avg_lead_days,fill_rate_pct&order=avg_lead_days.asc`
  ) as Array<{ name: string; avg_lead_days: number; fill_rate_pct: number }>

  // Also pull Zoho vendor data if connected
  let zohoVendors: Array<{ vendor_name: string; payment_terms?: string }> = []
  const token = await getZohoToken(env)
  if (token) {
    const dc = env.ZOHO_DC ?? 'in'
    const res = await fetch(
      `https://inventory.zoho.${dc}/api/v1/contacts?contact_type=vendor&organization_id=${env.ZOHO_ORG_ID}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    )
    const json = await res.json() as { contacts?: Array<{ vendor_name: string; payment_terms?: string }> }
    zohoVendors = json.contacts ?? []
  }

  return ok({ local_suppliers: suppliers, zoho_vendors: zohoVendors.length }, suppliers.length, false)
}

// ── Tool: update_fill_rate ────────────────────────────────────
// Called after PO receipt to update supplier's running fill rate
async function updateFillRate(
  supplierId: string, orgId: string,
  delivered: boolean, env: Env
): Promise<Response> {
  const suppliers = await sb(env,
    `suppliers?id=eq.${supplierId}&org_id=eq.${orgId}&select=fill_rate_pct&limit=1`
  ) as Array<{ fill_rate_pct: number }>
  if (!suppliers.length) return err('Supplier not found')

  const current = suppliers[0].fill_rate_pct ?? 80
  // Exponential moving average (alpha=0.1)
  const updated = delivered
    ? parseFloat((current * 0.9 + 100 * 0.1).toFixed(1))
    : parseFloat((current * 0.9 + 0 * 0.1).toFixed(1))

  await sb(env, `suppliers?id=eq.${supplierId}`, 'PATCH', { fill_rate_pct: updated })

  return ok({ supplier_id: supplierId, old_fill_rate: current, new_fill_rate: updated }, 1, false)
}

// ── Tool: get_overdue_suppliers ───────────────────────────────
// Returns suppliers with currently overdue POs — alert source
async function getOverdueSuppliers(orgId: string, env: Env): Promise<Response> {
  const overdue = await sb(env,
    `purchase_orders?org_id=eq.${orgId}&status=eq.overdue&select=id,expected_at,quantity,total_inr,items(sku,name),suppliers(name,contact_email)&order=expected_at.asc`
  )
  return ok(overdue, (overdue as unknown[]).length, false)
}

// ── Router ────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!authenticate(request, env)) return err('Unauthorised', 401)
    const orgId = request.headers.get('X-Org-Id')
    if (!orgId) return err('Missing X-Org-Id', 400)

    const url  = new URL(request.url)
    const body = request.method === 'POST' ? await request.json() as Record<string, string> : {}

    switch (url.pathname) {
      case '/supplier/list':             return getSuppliers(orgId, env)
      case '/supplier/for-item':         return getSupplierForItem(body.sku, orgId, env)
      case '/supplier/lead-times':       return getLeadTimes(orgId, env)
      case '/supplier/update-fill-rate': return updateFillRate(body.supplier_id, orgId, body.delivered === 'true', env)
      case '/supplier/overdue':          return getOverdueSuppliers(orgId, env)
      default: return err('Not found', 404)
    }
  },
}
