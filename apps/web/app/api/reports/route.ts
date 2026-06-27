// apps/web/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, string>
  const orgId = body.org_id
  if (!orgId) return NextResponse.json({ error: 'Missing org_id' }, { status: 400 })
  try {
    const res = await fetch(`${process.env.MCP_BASE_URL}/alerts/report`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MCP_SECRET}`,
        'X-Org-Id':      orgId,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'MCP unreachable' }, { status: 502 })
  }
}
