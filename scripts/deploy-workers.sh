#!/bin/bash
set -e
echo "Deploying all 4 MCP workers to Cloudflare..."
cd apps/mcp-inventory && npx wrangler deploy && cd ../..
cd apps/mcp-orders    && npx wrangler deploy && cd ../..
cd apps/mcp-supplier  && npx wrangler deploy && cd ../..
cd apps/mcp-alerts    && npx wrangler deploy && cd ../..
echo "All workers deployed."
