// apps/mcp-alerts/src/index.ts
// Alerts MCP — Cloudflare Worker
// Req 13: notifications (low stock, condition, IoT, overdue)
// Req 14: report generation with 7/14/30d filters
// ZERO LLM calls — pure rule engine, deterministic

import { decideFormat } from '../../packages/shared/types'
import type { McpResponse, Notification } from '../../packages/shared/types'

interface Env {
  SUPABASE_URL:       string
  SUPABASE_KEY:       string
  MCP_SECRET:         string
  SENDGRID_API_KEY:   string
  SLACK_WEBHOOK_URL:  string
  REPORT_CACHE:       KVNamespace
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

// ── Notification dispatcher ───────────────────────────────────
async function dispatchNotification(
  notif: Omit<Notification, 'id' | 'created_at'>,
  env:   Env
): Promise<void> {
  // Always persist to DB (in_app channel)
  await sb(env, 'notifications', 'POST', { ...notif, channel: 'in_app' })

  // Email via SendGrid
  if (notif.channel === 'email' && env.SENDGRID_API_KEY) {
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: 'alerts@vizai.in' }] }],
        from:    { email: 'noreply@vizai.in', name: 'VizAI Inventory' },
        subject: notif.title,
        content: [{ type: 'text/plain', value: notif.body }],
      }),
    }).catch(() => {})
  }

  // Slack webhook
  if (env.SLACK_WEBHOOK_URL) {
    const emoji: Record<string, string> = {
      low_stock: ':warning:', zero_stock: ':red_circle:',
      condition_flag: ':hammer_and_wrench:', po_overdue: ':truck:',
      iot_alert: ':satellite:', whitelist_block: ':no_entry:',
    }
    await fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${emoji[notif.trigger_type] ?? ':bell:'} *${notif.title}*\n${notif.body}`,
      }),
    }).catch(() => {})
  }
}

// ── Tool: run_stock_alert_check ───────────────────────────────
// Called by pg_cron every 5 min via Supabase edge function
async function runStockAlertCheck(orgId: string, env: Env): Promise<Response> {
  const items = await sb(env,
    `items?org_id=eq.${orgId}&status=eq.active&select=id,sku,name,reorder_point`
  ) as Array<{ id: string; sku: string; name: string; reorder_point: number }>

  let fired = 0

  for (const item of items) {
    const ledger = await sb(env,
      `stock_ledger?item_id=eq.${item.id}&select=balance_after&order=created_at.desc&limit=1`
    ) as Array<{ balance_after: number }>

    const stock = ledger[0]?.balance_after ?? 0

    if (stock === 0) {
      await dispatchNotification({
        org_id:       orgId,
        item_id:      item.id,
        trigger_type: 'zero_stock',
        title:        `${item.sku} at zero stock`,
        body:         `${item.name} has 0 units. Reorder immediately.`,
        channel:      'in_app',
        is_read:      false,
        metadata:     { sku: item.sku, current_stock: 0, reorder_point: item.reorder_point },
      }, env)
      fired++
    } else if (stock <= item.reorder_point) {
      await dispatchNotification({
        org_id:       orgId,
        item_id:      item.id,
        trigger_type: 'low_stock',
        title:        `${item.sku} below reorder point`,
        body:         `${item.name} has ${stock} units (reorder at ${item.reorder_point}).`,
        channel:      'in_app',
        is_read:      false,
        metadata:     { sku: item.sku, current_stock: stock, reorder_point: item.reorder_point },
      }, env)
      fired++
    }
  }

  return ok({ checked: items.length, alerts_fired: fired }, 1, true)
}

// ── Tool: flag_condition ──────────────────────────────────────
async function flagCondition(input: Record<string, string>, orgId: string, env: Env): Promise<Response> {
  const { item_id, condition, notes, raised_by } = input
  if (!item_id || !condition) return err('item_id and condition required')

  // Create flag
  await sb(env, 'condition_flags', 'POST', {
    item_id, org_id: orgId, condition, notes, raised_by, resolved: false,
  })

  // Quarantine item
  await sb(env, `items?id=eq.${item_id}`, 'PATCH', { status: 'quarantined' })

  // Notify
  const item = (await sb(env, `items?id=eq.${item_id}&select=sku,name&limit=1`) as Array<{ sku: string; name: string }>)[0]
  await dispatchNotification({
    org_id:       orgId,
    item_id,
    trigger_type: 'condition_flag',
    title:        `${item?.sku ?? item_id} flagged — ${condition}`,
    body:         `${item?.name ?? 'Item'} has been quarantined. Condition: ${condition}. ${notes ?? ''}`,
    channel:      'in_app',
    is_read:      false,
    metadata:     { condition, notes, item_id },
  }, env)

  return ok({ flagged: true, item_id, condition }, 1, true)
}

// ── Tool: get_notifications ───────────────────────────────────
async function getNotifications(
  orgId: string, userId: string | undefined,
  filter: string | undefined, env: Env
): Promise<Response> {
  const userFilter  = userId ? `&user_id=eq.${userId}` : ''
  const typeFilter  = filter ? `&trigger_type=eq.${filter}` : ''
  const unreadFilter = '&is_read=eq.false'

  const notifs = await sb(env,
    `notifications?org_id=eq.${orgId}${userFilter}${typeFilter}${unreadFilter}&order=created_at.desc&limit=50`
  ) as Notification[]

  return ok(notifs, notifs.length, false)
}

// ── Tool: mark_notifications_read ────────────────────────────
async function markRead(ids: string[], orgId: string, env: Env): Promise<Response> {
  if (!ids.length) {
    await sb(env, `notifications?org_id=eq.${orgId}`, 'PATCH', { is_read: true })
  } else {
    for (const id of ids) {
      await sb(env, `notifications?id=eq.${id}&org_id=eq.${orgId}`, 'PATCH', { is_read: true })
    }
  }
  return ok({ marked: ids.length || 'all' }, 1, false)
}

// ── Tool: generate_report ─────────────────────────────────────
// Req 14: reports with 7/14/30d + custom date range filters
async function generateReport(input: Record<string, string>, orgId: string, env: Env): Promise<Response> {
  const { report_type, days, start_date, end_date, format_hint } = input

  // Build date range
  const to   = new Date()
  const from = start_date
    ? new Date(start_date)
    : new Date(to.getTime() - (Number(days ?? 7) * 24 * 60 * 60 * 1000))

  const filterKey = `${orgId}:${report_type}:${from.toISOString().slice(0, 10)}:${to.toISOString().slice(0, 10)}`

  // Check report_cache (TTL based)
  const cached = await sb(env,
    `report_cache?org_id=eq.${orgId}&filter_key=eq.${filterKey}&select=result,format&limit=1`
  ) as Array<{ result: unknown; format: string }>

  if (cached.length) {
    return new Response(JSON.stringify({
      ok: true, data: cached[0].result, format: cached[0].format, cached: true,
    }), { headers: { 'Content-Type': 'application/json' } })
  }

  // Generate fresh report
  let data: unknown
  const fromIso = from.toISOString()
  const toIso   = to.toISOString()

  switch (report_type) {
    case 'stock_movement':
      data = await sb(env,
        `stock_ledger?org_id=eq.${orgId}&created_at=gte.${fromIso}&created_at=lte.${toIso}&select=quantity_change,balance_after,movement_type,created_at,items(sku,name)&order=created_at.desc`
      )
      break

    case 'low_stock_log':
      data = await sb(env,
        `notifications?org_id=eq.${orgId}&trigger_type=in.(low_stock,zero_stock)&created_at=gte.${fromIso}&created_at=lte.${toIso}&select=title,body,created_at&order=created_at.desc`
      )
      break

    case 'supplier_sla':
      data = await sb(env,
        `purchase_orders?org_id=eq.${orgId}&created_at=gte.${fromIso}&status=in.(received,overdue)&select=status,expected_at,received_at,total_inr,suppliers(name)&order=created_at.desc`
      )
      break

    case 'condition_log':
      data = await sb(env,
        `condition_flags?org_id=eq.${orgId}&created_at=gte.${fromIso}&select=condition,notes,resolved,created_at,resolved_at,items(sku,name)&order=created_at.desc`
      )
      break

    case 'whitelist_violations':
      data = await sb(env,
        `whitelist_log?org_id=eq.${orgId}&created_at=gte.${fromIso}&select=attempted_sku,attempted_name,channel,created_at&order=created_at.desc`
      )
      break

    default:
      return err(`Unknown report type: ${report_type}`)
  }

  // Decide format (req 3)
  const rows   = Array.isArray(data) ? data.length : 1
  const routing = decideFormat(rows, false, false)
  const fmt    = (format_hint as 'json' | 'tsv' | 'csv') ?? routing.format

  // Cache result (TTL: 1hr for reports, 5min for live)
  const ttl = Number(days ?? 7) <= 1 ? 300 : 3600
  await sb(env, 'report_cache', 'POST', {
    org_id:     orgId,
    filter_key: filterKey,
    format:     fmt,
    result:     data,
    row_count:  rows,
    expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
  }).catch(() => {})

  return new Response(JSON.stringify({ ok: true, data, format: fmt, cached: false, row_count: rows }), {
    headers: { 'Content-Type': 'application/json' },
  })
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
      case '/alerts/stock-check':      return runStockAlertCheck(orgId, env)
      case '/alerts/flag-condition':   return flagCondition(body, orgId, env)
      case '/alerts/notifications':    return getNotifications(orgId, body.user_id, body.filter, env)
      case '/alerts/mark-read':        return markRead(JSON.parse(body.ids ?? '[]') as string[], orgId, env)
      case '/alerts/report':           return generateReport(body, orgId, env)
      default: return err('Not found', 404)
    }
  },
}
