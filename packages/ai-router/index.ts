// packages/ai-router/index.ts
// Req 3 (format routing) + Req 4 (model routing) + orchestrator
// Token-optimised: classify BEFORE calling the model

import Anthropic from '@anthropic-ai/sdk'
import { routeModel, decideFormat, type McpResponse } from '../shared/types'

const anthropic = new Anthropic()  // uses ANTHROPIC_API_KEY env

// ── Tool definitions passed to model (token-lean) ────────────
// Only the tools relevant to the current scope are injected.
// Full tool list never sent in one shot — prevents the 24% context bleed.

const INVENTORY_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_live_stock_summary',
    description: 'Count items by status for the org. Returns TSV for token efficiency.',
    input_schema: {
      type: 'object' as const,
      properties: { org_id: { type: 'string' } },
      required: ['org_id'],
    },
  },
  {
    name: 'get_item_detail',
    description: 'Balance + last 5 movements for one SKU. Returns JSON.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sku:    { type: 'string' },
        org_id: { type: 'string' },
      },
      required: ['sku', 'org_id'],
    },
  },
  {
    name: 'get_low_stock_items',
    description: 'Items at or below reorder point. Returns TSV (flat list).',
    input_schema: {
      type: 'object' as const,
      properties: { org_id: { type: 'string' } },
      required: ['org_id'],
    },
  },
  {
    name: 'get_damaged_items',
    description: 'Items with unresolved condition flags. Returns TSV.',
    input_schema: {
      type: 'object' as const,
      properties: { org_id: { type: 'string' } },
      required: ['org_id'],
    },
  },
]

const ORDER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_open_orders',
    description: 'Open POs by status. Returns TSV for flat data, JSON for detail.',
    input_schema: {
      type: 'object' as const,
      properties: {
        org_id: { type: 'string' },
        status: { type: 'string', enum: ['pending','confirmed','shipped','overdue'] },
      },
      required: ['org_id'],
    },
  },
  {
    name: 'create_purchase_order',
    description: 'Create a PO for an item. Requires ops or manager role.',
    input_schema: {
      type: 'object' as const,
      properties: {
        org_id:       { type: 'string' },
        item_id:      { type: 'string' },
        supplier_id:  { type: 'string' },
        quantity:     { type: 'number' },
        unit_cost_inr: { type: 'number' },
        expected_at:  { type: 'string', description: 'ISO date string' },
      },
      required: ['org_id', 'item_id', 'quantity'],
    },
  },
]

// ── Tool scope selector (injects only what's needed) ─────────
function selectTools(query: string): Anthropic.Tool[] {
  const q = query.toLowerCase()
  const tools: Anthropic.Tool[] = []
  if (/stock|item|sku|product|inventory|damaged|low|working/i.test(q)) tools.push(...INVENTORY_TOOLS)
  if (/order|po|purchas|supplier|deliver|overdue/i.test(q)) tools.push(...ORDER_TOOLS)
  if (tools.length === 0) tools.push(...INVENTORY_TOOLS) // default
  return tools
}

// ── System prompt (role-aware, token-lean) ───────────────────
function buildSystemPrompt(role: string, orgName: string): string {
  const perms: Record<string, string> = {
    super_admin: 'full access to all data, users, and settings',
    manager:     'full inventory, orders, reports. cannot manage users',
    ops:         'can raise POs and update stock. cannot see cost data',
    user:        'can search items and raise requests. read-only',
  }
  return `You are the VizAI inventory assistant for ${orgName}.
User role: ${role}. Permissions: ${perms[role] ?? perms.user}.
Always respond concisely. Use INR (₹) for prices. Refer to actual SKUs and product names.
For counts, prefer a single number. For lists, keep to top 5 unless asked for more.
Never expose data outside the user's permission level.`
}

// ── Main orchestrator entry point ────────────────────────────
export interface ChatRequest {
  query:   string
  orgId:   string
  orgName: string
  userId:  string
  role:    string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface ChatResponse {
  text:       string
  model_used: string
  complexity: string
  tools_used: string[]
  tokens_in:  number
  tokens_out: number
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  // Step 1: route model (req 4)
  const { model, complexity } = routeModel(req.query)

  // Step 2: select only relevant tools (token saving)
  const tools = selectTools(req.query)

  // Step 3: build message list (last 6 turns only — session minimization)
  const recentHistory = req.history.slice(-6)
  const messages: Anthropic.MessageParam[] = [
    ...recentHistory,
    { role: 'user', content: req.query },
  ]

  // Step 4: first model call
  const response = await anthropic.messages.create({
    model,
    max_tokens: complexity === 'complex' ? 1500 : 512,
    system:     buildSystemPrompt(req.role, req.orgName),
    tools,
    messages,
  })

  const toolsUsed: string[] = []
  let finalText = ''

  // Step 5: handle tool use loop (agentic path)
  if (response.stop_reason === 'tool_use') {
    const toolCalls = response.content.filter(b => b.type === 'tool_use')
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const call of toolCalls) {
      if (call.type !== 'tool_use') continue
      toolsUsed.push(call.name)

      // Dispatch to the correct MCP worker
      const result = await dispatchToMcp(call.name, call.input as Record<string, string>, req.orgId)

      // Format routing (req 3): decide format before returning
      const routing = decideFormat(
        result.row_count ?? 1,
        result.is_nested ?? false,
        false
      )

      toolResults.push({
        type:        'tool_result',
        tool_use_id: call.id,
        content:     formatForModel(result.data, routing.format),
      })
    }

    // Second call with tool results
    const finalResponse = await anthropic.messages.create({
      model,
      max_tokens: complexity === 'complex' ? 1500 : 512,
      system:     buildSystemPrompt(req.role, req.orgName),
      tools,
      messages: [
        ...messages,
        { role: 'assistant', content: response.content },
        { role: 'user',      content: toolResults },
      ],
    })

    finalText = finalResponse.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('')

    return {
      text:       finalText,
      model_used: model,
      complexity,
      tools_used: toolsUsed,
      tokens_in:  response.usage.input_tokens + finalResponse.usage.input_tokens,
      tokens_out: response.usage.output_tokens + finalResponse.usage.output_tokens,
    }
  }

  // Workflow path (no tool use — cheapest path)
  finalText = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('')

  return {
    text:       finalText,
    model_used: model,
    complexity,
    tools_used: [],
    tokens_in:  response.usage.input_tokens,
    tokens_out: response.usage.output_tokens,
  }
}

// ── Format serialiser (req 3) ────────────────────────────────
function formatForModel(data: unknown, format: 'json' | 'tsv' | 'csv'): string {
  if (!data) return 'no data'
  if (format === 'json') return JSON.stringify(data)

  if (Array.isArray(data) && data.length > 0) {
    const headers = Object.keys(data[0] as object)
    const sep     = format === 'tsv' ? '\t' : ','
    const rows    = data.map(row =>
      headers.map(h => String((row as Record<string, unknown>)[h] ?? '')).join(sep)
    )
    return [headers.join(sep), ...rows].join('\n')
  }
  return String(data)
}

// ── MCP dispatcher (internal fetch to worker URLs) ───────────
async function dispatchToMcp(
  toolName: string,
  input: Record<string, string>,
  orgId: string
): Promise<{ data: unknown; row_count?: number; is_nested?: boolean }> {
  const MCP_BASE = process.env.MCP_BASE_URL ?? 'http://localhost:8787'
  const TOOL_MAP: Record<string, string> = {
    get_live_stock_summary: `${MCP_BASE}/inventory/stock-summary`,
    get_item_detail:        `${MCP_BASE}/inventory/item-detail`,
    get_low_stock_items:    `${MCP_BASE}/inventory/low-stock`,
    get_damaged_items:      `${MCP_BASE}/inventory/damaged`,
    get_open_orders:        `${MCP_BASE}/orders/open`,
    create_purchase_order:  `${MCP_BASE}/orders/create`,
  }

  const url = TOOL_MAP[toolName]
  if (!url) return { data: `Tool ${toolName} not found` }

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'X-Org-Id':      orgId,
      'X-Tool-Name':   toolName,
      // Token auth per request — no sessions (req 6 + MCP stateless rule)
      'Authorization': `Bearer ${process.env.MCP_SECRET}`,
    },
    body: JSON.stringify(input),
  })

  const json = await res.json() as McpResponse<unknown>
  return {
    data:       json.data,
    row_count:  Array.isArray(json.data) ? json.data.length : 1,
    is_nested:  typeof json.data === 'object' && !Array.isArray(json.data),
  }
}
