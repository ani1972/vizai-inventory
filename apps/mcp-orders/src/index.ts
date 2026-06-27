// apps/mcp-orders/src/index.ts
// Orders MCP — Cloudflare Worker
// Req 1: create, update, cancel POs
// Req 15: Zoho Inventory sync for orders

import { decideFormat } from '../../packages/shared/types'
import type { McpResponse, PurchaseOrder, ZohoSyncResult } from '../../packages/shared/types'

interface Env {
  SUPABASE_URL:      string
  SUPABASE_KEY:      string
  MCP_SECRET:        string
  ZOHO_CLIENT_ID:    string
  ZOHO_CLIENT_SECRET: string
  ZOHO_REFRESH_TOKEN: string
  ZOHO_ORG_ID:       string
  ZOHO_DC:           string   // 'in' for India
  ZOHO_TOKEN_CACHE:  KVNamespace
}

function authenticate(req: Request, env: Env): boolean {
  return req.headers.get('Authorization') === `Bearer ${env.MCP_SECRET}`
}

function getOrgId(req: Request): string | null {
  return req.headers.get('X-Org-Id')
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

// ── Zoho OAuth token (cached in KV, refreshed when expired) ──
async function getZohoToken(env: Env): Promise<string> {
  const cached = await env.ZOHO_TOKEN_CACHE.get('access_token')
  if (cached) return cached

  const dc = env.ZOHO_DC ?? 'in'
  const res = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
    method: 'POST',
    body:   new URLSearchParams({
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

// ── Zoho API call ─────────────────────────────────────────────
async function zohoApi(env: Env, path: string, method = 'GET', body?: unknown) {
  const token = await getZohoToken(env)
  const dc    = env.ZOHO_DC ?? 'in'
  const res   = await fetch(`https://inventory.zoho.${dc}/api/v1/${path}?organization_id=${env.ZOHO_ORG_ID}`, {
    method,
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type':  'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

// ── Tool: get_open_orders ─────────────────────────────────────
async function getOpenOrders(orgId: string, status: string | undefined, env: Env): Promise<Response> {
  const statusFilter = status ? `&status=eq.${status}` : '&status=not.in.(received,cancelled)'
  const orders = await sb(env,
    `purchase_orders?org_id=eq.${orgId}${statusFilter}&select=id,status,quantity,total_inr,expected_at,created_at,items(sku,name,category),suppliers(name)&order=created_at.desc&limit=50`
  ) as PurchaseOrder[]

  // TSV for flat list (req 3)
  return ok(orders, orders.length, false)
}

// ── Tool: create_purchase_order ───────────────────────────────
async function createPurchaseOrder(input: Record<string, unknown>, orgId: string, env: Env): Promise<Response> {
  const { item_id, supplier_id, quantity, unit_cost_inr, expected_at } = input

  if (!item_id || !quantity) return err('item_id and quantity are required')

  // Create in Supabase
  const pos = await sb(env, 'purchase_orders', 'POST', {
    org_id:        orgId,
    item_id,
    supplier_id,
    quantity:      Number(quantity),
    unit_cost_inr: Number(unit_cost_inr ?? 0),
    expected_at,
    status:        'pending',
  }) as PurchaseOrder[]

  const po = pos[0]
  if (!po) return err('Failed to create PO')

  // Sync to Zoho if configured (req 15)
  if (env.ZOHO_CLIENT_ID) {
    try {
      const zohoRes = await zohoApi(env, 'purchaseorders', 'POST', {
        vendor_id:    input.zoho_vendor_id,
        purchaseorder_number: po.id.slice(0, 8).toUpperCase(),
        line_items: [{
          item_id:  input.zoho_item_id,
          quantity: Number(quantity),
          rate:     Number(unit_cost_inr ?? 0),
        }],
      }) as { purchaseorder?: { purchaseorder_id: string } }

      if (zohoRes.purchaseorder?.purchaseorder_id) {
        await sb(env,
          `purchase_orders?id=eq.${po.id}`,
          'PATCH',
          { zoho_po_id: zohoRes.purchaseorder.purchaseorder_id }
        )
      }
    } catch {
      // Zoho sync failure is non-blocking — local PO already created
    }
  }

  // Audit log
  await sb(env, 'audit_log', 'POST', {
    org_id:      orgId,
    action:      'po_created',
    entity_type: 'purchase_orders',
    entity_id:   po.id,
    payload:     { quantity, unit_cost_inr, supplier_id },
  })

  return ok(po, 1, true)
}

// ── Tool: update_order_status ─────────────────────────────────
async function updateOrderStatus(poId: string, status: string, orgId: string, env: Env): Promise<Response> {
  const validTransitions: Record<string, string[]> = {
    pending:   ['confirmed', 'cancelled'],
    confirmed: ['shipped',   'cancelled'],
    shipped:   ['received',  'overdue'],
    overdue:   ['received',  'cancelled'],
  }

  const existing = await sb(env,
    `purchase_orders?id=eq.${poId}&org_id=eq.${orgId}&select=status,zoho_po_id&limit=1`
  ) as PurchaseOrder[]

  if (!existing.length) return err('PO not found')

  const current = existing[0].status
  if (!validTransitions[current]?.includes(status)) {
    return err(`Cannot transition from ${current} to ${status}`)
  }

  const updates: Record<string, unknown> = { status }
  if (status === 'received') updates.received_at = new Date().toISOString()

  await sb(env, `purchase_orders?id=eq.${poId}`, 'PATCH', updates)

  // Sync status to Zoho
  if (existing[0].zoho_po_id && env.ZOHO_CLIENT_ID) {
    const zohoStatus: Record<string, string> = {
      confirmed: 'open', shipped: 'billed', received: 'billed', cancelled: 'cancelled',
    }
    if (zohoStatus[status]) {
      await zohoApi(env, `purchaseorders/${existing[0].zoho_po_id}/status/${zohoStatus[status]}`, 'POST')
        .catch(() => {})
    }
  }

  // Fire notification for overdue POs (req 13)
  if (status === 'overdue') {
    await sb(env, 'notifications', 'POST', {
      org_id:       orgId,
      trigger_type: 'po_overdue',
      title:        `PO overdue`,
      body:         `Purchase order ${poId.slice(0, 8)} is past its expected delivery date.`,
      channel:      'in_app',
    })
  }

  return ok({ poId, newStatus: status }, 1, true)
}

// ── Tool: zoho_full_sync ──────────────────────────────────────
// Req 15: pull all items + POs from Zoho and reconcile with local DB
async function zohoFullSync(orgId: string, env: Env): Promise<Response> {
  const result: ZohoSyncResult = { synced: 0, skipped: 0, errors: 0, details: [] }

  // Pull items from Zoho
  const zohoItems = await zohoApi(env, 'items?filter_by=Status.Active') as {
    items?: Array<{ item_id: string; name: string; sku: string; rate: number; unit: string; reorder_level: number; stock_on_hand: number }>
  }

  for (const zi of zohoItems.items ?? []) {
    try {
      await sb(env, 'items', 'POST', {
        org_id:          orgId,
        sku:             zi.sku || zi.item_id,
        name:            zi.name,
        category:        'Zoho Import',
        unit:            zi.unit ?? 'unit',
        reorder_point:   zi.reorder_level ?? 0,
        unit_cost_inr:   zi.rate ?? 0,
        is_whitelisted:  true,
        zoho_item_id:    zi.item_id,
      })
      result.synced++
    } catch {
      result.skipped++
    }
  }

  await sb(env, 'zoho_sync_log', 'POST', {
    org_id:         orgId,
    sync_type:      'full',
    direction:      'pull',
    records_synced: result.synced,
    status:         result.errors > 0 ? 'partial' : 'success',
    completed_at:   new Date().toISOString(),
  })

  return ok(result, 1, true)
}

// ── Router ────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!authenticate(request, env)) return err('Unauthorised', 401)
    const orgId = request.headers.get('X-Org-Id')
    if (!orgId) return err('Missing X-Org-Id', 400)

    const url  = new URL(request.url)
    const body = request.method === 'POST' ? await request.json() as Record<string, unknown> : {}

    switch (url.pathname) {
      case '/orders/open':        return getOpenOrders(orgId, body.status as string, env)
      case '/orders/create':      return createPurchaseOrder(body, orgId, env)
      case '/orders/update':      return updateOrderStatus(body.po_id as string, body.status as string, orgId, env)
      case '/orders/zoho-sync':   return zohoFullSync(orgId, env)
      default: return err('Not found', 404)
    }
  },
}
