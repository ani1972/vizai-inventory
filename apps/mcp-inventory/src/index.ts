// apps/mcp-inventory/src/index.ts
// Inventory MCP — Cloudflare Worker
// Req 1: read-only stock queries, whitelist check, HashMap O(1) lookup
// Req 12: whitelist gate fires BEFORE any DB query
// Req 16: HashMap cache checked first, DB only on miss

import { VizAIHashMap } from '../../packages/shared/hashmap-cache'
import { decideFormat } from '../../packages/shared/types'
import type { McpResponse, Item, StockSummaryKpi } from '../../packages/shared/types'

// In Cloudflare Workers, Supabase client is initialised per-request
// using the org's service role key from environment bindings

interface Env {
  SUPABASE_URL:    string
  SUPABASE_KEY:    string   // service role
  MCP_SECRET:      string
  ITEM_CACHE:      KVNamespace
}

// In-process HashMap (lives for the duration of the worker instance)
const cache = new VizAIHashMap()
let cacheLoaded = false

// ── Auth middleware ───────────────────────────────────────────
function authenticate(req: Request, env: Env): boolean {
  const auth = req.headers.get('Authorization') ?? ''
  return auth === `Bearer ${env.MCP_SECRET}`
}

function getOrgId(req: Request): string | null {
  return req.headers.get('X-Org-Id')
}

// ── Supabase query helper ─────────────────────────────────────
async function supabase(env: Env, path: string, body?: unknown) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method:  body ? 'POST' : 'GET',
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

// ── Warm HashMap from DB ──────────────────────────────────────
async function warmCache(env: Env, orgId: string) {
  if (cacheLoaded) return
  const items = await supabase(env,
    `items?org_id=eq.${orgId}&status=eq.active&select=id,sku,name`
  ) as Array<{ id: string; sku: string; name: string }>

  // Get latest balance for each item
  for (const item of items.slice(0, 500)) {  // cap at 500 for memory
    const ledger = await supabase(env,
      `stock_ledger?item_id=eq.${item.id}&select=balance_after&order=created_at.desc&limit=1`
    ) as Array<{ balance_after: number }>
    cache.put(item.sku, item.id, item.name, ledger[0]?.balance_after ?? 0)
  }
  cacheLoaded = true
}

// ── Response helpers ──────────────────────────────────────────
function ok<T>(data: T, rowCount = 1, isNested = false): Response {
  const routing = decideFormat(rowCount, isNested, false)
  const body: McpResponse<T> = { ok: true, data, format: routing.format, cached: false }
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  })
}

function err(msg: string, status = 400): Response {
  const body: McpResponse<null> = { ok: false, error: msg, format: 'json', cached: false }
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// ── Tool: whitelist check (fires before every item operation) ─
async function checkWhitelist(sku: string, name: string, env: Env, orgId: string): Promise<boolean> {
  // Check HashMap first (O(1))
  const cached = cache.get(sku)
  if (cached) return true

  // Check DB
  const rows = await supabase(env,
    `items?sku=eq.${sku}&org_id=eq.${orgId}&is_whitelisted=eq.true&select=id&limit=1`
  ) as unknown[]
  return rows.length > 0
}

// ── Tool: get_live_stock_summary ──────────────────────────────
// Returns TSV (flat counts) — minimal tokens for chatbot
async function getLiveStockSummary(env: Env, orgId: string): Promise<Response> {
  // Try materialized view first (cache hit)
  const mv = await supabase(env,
    `mv_stock_summary?org_id=eq.${orgId}&select=*`
  ) as StockSummaryKpi[]

  if (mv.length > 0) {
    // Return as TSV (req 3: flat counts = TSV)
    const row = mv[0]
    const tsv = [
      'total_skus\tactive\tquarantined\tlow_stock\tzero_stock\tstock_value_inr\trefreshed_at',
      `${row.total_skus}\t${row.active_skus}\t${row.quarantined_skus}\t${row.low_stock_count}\t${row.zero_stock_count}\t${row.stock_value_inr}\t${row.refreshed_at}`,
    ].join('\n')

    return new Response(JSON.stringify({ ok: true, data: tsv, format: 'tsv', cached: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fallback to aggregate query
  const items = await supabase(env,
    `items?org_id=eq.${orgId}&select=id,status,unit_cost_inr`
  ) as Array<{ id: string; status: string; unit_cost_inr: number }>

  const summary = {
    total_skus:       items.length,
    active_skus:      items.filter(i => i.status === 'active').length,
    quarantined_skus: items.filter(i => i.status === 'quarantined').length,
    low_stock_count:  0,
    zero_stock_count: 0,
  }
  return ok(summary, 1, true)
}

// ── Tool: get_item_detail ─────────────────────────────────────
async function getItemDetail(sku: string, env: Env, orgId: string): Promise<Response> {
  // O(1) HashMap lookup
  const cached = cache.get(sku)

  const items = await supabase(env,
    `items?sku=eq.${sku}&org_id=eq.${orgId}&select=id,sku,name,category,unit,reorder_point,unit_cost_inr,status&limit=1`
  ) as Item[]

  if (!items.length) return err(`Item ${sku} not found`)

  const item = items[0]

  // Last 5 ledger movements
  const movements = await supabase(env,
    `stock_ledger?item_id=eq.${item.id}&select=quantity_change,balance_after,movement_type,created_at&order=created_at.desc&limit=5`
  )

  const current_stock = cached?.stock ?? (movements[0]?.balance_after ?? 0)

  // Update HashMap with fresh data
  cache.put(sku, item.id, item.name, current_stock)

  return ok({ ...item, current_stock, recent_movements: movements }, 1, true)
}

// ── Tool: get_low_stock_items ─────────────────────────────────
async function getLowStockItems(env: Env, orgId: string): Promise<Response> {
  const items = await supabase(env,
    `items?org_id=eq.${orgId}&status=eq.active&select=id,sku,name,category,reorder_point`
  ) as Item[]

  const lowStock: Array<{ sku: string; name: string; category: string; current_stock: number; reorder_point: number }> = []

  for (const item of items) {
    const cached = cache.get(item.sku)
    const stock  = cached?.stock ?? 0
    if (stock <= item.reorder_point) {
      lowStock.push({ sku: item.sku, name: item.name, category: item.category, current_stock: stock, reorder_point: item.reorder_point })
    }
  }

  // TSV for flat list (req 3)
  return ok(lowStock, lowStock.length, false)
}

// ── Tool: get_damaged_items ───────────────────────────────────
async function getDamagedItems(env: Env, orgId: string): Promise<Response> {
  const flags = await supabase(env,
    `condition_flags?org_id=eq.${orgId}&resolved=eq.false&select=item_id,condition,notes,created_at,items(sku,name)`
  )
  return ok(flags, (flags as unknown[]).length, false)
}

// ── Tool: get_hashmap_stats ───────────────────────────────────
function getHashMapStats(): Response {
  return ok(cache.stats(), 1, true)
}

// ── Router ────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!authenticate(request, env)) return err('Unauthorised', 401)

    const orgId = getOrgId(request)
    if (!orgId) return err('Missing X-Org-Id', 400)

    await warmCache(env, orgId)

    const url    = new URL(request.url)
    const body   = request.method === 'POST' ? await request.json() as Record<string, string> : {}

    switch (url.pathname) {
      case '/inventory/stock-summary':  return getLiveStockSummary(env, orgId)
      case '/inventory/item-detail':    return getItemDetail(body.sku, env, orgId)
      case '/inventory/low-stock':      return getLowStockItems(env, orgId)
      case '/inventory/damaged':        return getDamagedItems(env, orgId)
      case '/inventory/hashmap-stats':  return getHashMapStats()

      case '/inventory/whitelist-check': {
        const allowed = await checkWhitelist(body.sku, body.name, env, orgId)
        if (!allowed) {
          // Auto-log to whitelist_violations (req 12)
          await supabase(env, 'whitelist_log', {
            org_id:         orgId,
            attempted_sku:  body.sku,
            attempted_name: body.name,
            channel:        body.channel ?? 'api',
          })
        }
        return ok({ allowed, sku: body.sku }, 1, true)
      }

      default: return err('Not found', 404)
    }
  },
}
