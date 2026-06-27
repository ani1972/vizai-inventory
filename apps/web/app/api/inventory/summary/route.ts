// apps/web/app/api/inventory/summary/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'Missing org_id' }, { status: 400 })
  try {
    const res = await fetch(`${process.env.MCP_BASE_URL}/inventory/stock-summary`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MCP_SECRET}`,
        'X-Org-Id':      orgId,
        'Content-Type':  'application/json',
      },
    })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'MCP unreachable' }, { status: 502 })
  }
}
