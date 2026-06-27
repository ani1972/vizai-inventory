# VizAI Inventory System
# Full-stack agentic inventory management — all 17 requirements

## Architecture
```
apps/
  web/              Next.js 14 PWA (frontend + chatbot API)
  mcp-inventory/    Cloudflare Worker — read-only stock, whitelist, HashMap
  mcp-orders/       Cloudflare Worker — POs, Zoho sync
  mcp-supplier/     Cloudflare Worker — quotes, lead times
  mcp-alerts/       Cloudflare Worker — notifications, reports

packages/
  shared/           Types, format router, model router, HashMap cache
  db/               Supabase client helpers
  ai-router/        Orchestrator — model routing, tool dispatch, session mgmt

infra/
  supabase/
    migrations/     001_initial_schema.sql (13 tables, indexes, partitions, RLS)
    seed/           VizAI product data (Ashok Leyland, TVS, Hyundai India, Foxconn)
```

## Requirements coverage
| # | Requirement                        | Implemented in                     |
|---|------------------------------------|------------------------------------|
| 1 | 4 MCP servers                      | apps/mcp-*/                        |
| 2 | Role-aware chatbot                 | apps/web/components/Chatbot.tsx    |
| 3 | Format routing (JSON/TSV/CSV)      | packages/shared/types.ts           |
| 4 | Model routing (Haiku/Sonnet)       | packages/ai-router/index.ts        |
| 5 | User friendly (3-click rule)       | apps/web/ (dashboard + chatbot)    |
| 6 | Maintenance-free (serverless)      | Cloudflare Workers + Vercel        |
| 7 | Cross-platform PWA                 | apps/web/next.config.ts (PWA)      |
| 8 | 3 dashboard views                  | apps/web/app/dashboard/            |
| 9 | Click-to-detail on all numbers     | apps/web/components/DrillPanel.tsx |
|10 | Super admin panel                  | apps/web/app/admin/                |
|11 | No blacklist (VizAI raw materials) | migration: is_whitelisted default  |
|12 | Whitelist gate + popup             | mcp-inventory /whitelist-check     |
|13 | Notifications (stock + condition)  | mcp-alerts/flag-condition          |
|14 | Reports with date filters          | mcp-alerts/report                  |
|15 | Zoho Inventory integration         | mcp-orders/zoho-sync               |
|16 | HashMap cache (djb2)               | packages/shared/hashmap-cache.ts   |
|17 | IoT devices + AMC                  | migration: iot_devices, amc table  |

## Token optimisation summary
- Format routing: TSV saves ~40% vs JSON for flat data
- Model routing: Haiku for simple queries (4× cheaper than Sonnet)
- Tool scope: only relevant tools injected per query
- Session cap: max 6 turns of history sent to model
- Whitelist pre-filter: blocked items never reach LLM
- Materialized view: dashboard KPIs cached, zero per-request DB cost
- report_cache: expensive aggregates cached 1hr
- Partial indexes: only unread/unresolved rows indexed

## Setup

### 1. Supabase
```bash
supabase init
supabase db push   # runs 001_initial_schema.sql
```

### 2. Environment variables
Copy .env.example → .env.local and fill in all values.

### 3. Cloudflare Workers (4 MCPs)
```bash
cd apps/mcp-inventory && npx wrangler deploy
cd apps/mcp-orders    && npx wrangler deploy
cd apps/mcp-supplier  && npx wrangler deploy
cd apps/mcp-alerts    && npx wrangler deploy
```

### 4. Frontend
```bash
cd apps/web && npm run dev
```

### 5. Zoho connection
Go to Settings → Integrations → Zoho Inventory.
Enter Organisation ID, Client ID, Client Secret.
Click "Connect & Sync" to run initial full sync.
