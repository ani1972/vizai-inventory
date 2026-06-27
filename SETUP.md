# VizAI Inventory — Complete Setup Guide

## 15-minute deployment checklist

### Step 1 — Supabase (5 min)
1. Create a new project at https://supabase.com
2. Go to SQL editor → run `infra/supabase/migrations/001_initial_schema.sql`
3. Then run `infra/supabase/rls.sql`
4. Copy your project URL and anon + service role keys from Settings → API

### Step 2 — Environment (2 min)
```bash
cp .env.example apps/web/.env.local
```
Fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`.
Set `MCP_SECRET` to any random 32-char string.

### Step 3 — Seed data (1 min)
```bash
npm run db:seed
```
This creates VizAI Engineering org, 16 items, 6 suppliers, 8 IoT devices,
and initial stock levels.

### Step 4 — Cloudflare Workers (5 min)
```bash
npm install -g wrangler
wrangler login

# Create KV namespaces (run once):
wrangler kv:namespace create ITEM_CACHE
wrangler kv:namespace create ZOHO_TOKEN_CACHE
wrangler kv:namespace create REPORT_CACHE
# Paste the returned IDs into each wrangler.toml

# Set secrets on each worker:
for WORKER in mcp-inventory mcp-orders mcp-supplier mcp-alerts; do
  wrangler secret put SUPABASE_URL   --name vizai-$WORKER
  wrangler secret put SUPABASE_KEY   --name vizai-$WORKER
  wrangler secret put MCP_SECRET     --name vizai-$WORKER
done

bash scripts/deploy-workers.sh
```

### Step 5 — Web app (2 min)
```bash
cd apps/web
npm install
npm run dev        # local
# OR
vercel --prod      # deploy to Vercel
```

### Step 6 — Zoho Inventory (optional)
1. Go to https://inventory.zoho.in → Settings → Developer → OAuth
2. Create a client app with redirect URI `https://your-domain/api/auth/zoho/callback`
3. Generate a refresh token via Zoho OAuth flow
4. In the app: Settings → Integrations → Zoho → fill in and click Connect

### Step 7 — Notification channels (optional)
- **Slack**: Create an incoming webhook at https://api.slack.com/messaging/webhooks
  → add to `SLACK_WEBHOOK_URL` secret in each MCP worker
- **Email**: Create a SendGrid account at https://sendgrid.com
  → verify your sender domain → add API key to `SENDGRID_API_KEY`

---

## Create the first super admin user

After seeding, go to your Supabase dashboard → Authentication → Users → Invite a user.
Then run this SQL to grant super_admin role:

```sql
UPDATE users SET role = 'super_admin'
WHERE email = 'your@email.com';
```

---

## Local development with MCP workers

Run the inventory worker locally alongside the web app:

```bash
# Terminal 1 — web app
cd apps/web && npm run dev

# Terminal 2 — inventory MCP
cd apps/mcp-inventory && npx wrangler dev --port 8787

# Terminal 3 — orders MCP
cd apps/mcp-orders && npx wrangler dev --port 8788
```

Set in `.env.local`:
```
MCP_BASE_URL=http://localhost:8787
```

---

## GitHub repository setup

```bash
git init
git remote add origin https://github.com/YOUR_ORG/vizai-inventory.git
git add .
git commit -m "feat: initial VizAI inventory system — all 17 requirements"
git push -u origin main
```

Add all secrets from the table in README.md to GitHub → Settings → Secrets → Actions.
Push to main to trigger automatic deployment.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `MCP unreachable` in chatbot | Check `MCP_BASE_URL` and that workers are deployed |
| `Unauthorised 401` from MCP | Verify `MCP_SECRET` matches in web app and all workers |
| Zoho sync fails | Regenerate refresh token — they expire after 60 days of inactivity |
| Notifications not sending | Check `SLACK_WEBHOOK_URL` and `SENDGRID_API_KEY` secrets on alert worker |
| Dashboard shows no data | Run `npm run db:seed` to seed initial VizAI product data |
| PWA not installing | Ensure site is served over HTTPS (required for service worker) |
