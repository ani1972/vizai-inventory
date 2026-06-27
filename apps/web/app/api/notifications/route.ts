// apps/web/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const orgId  = req.nextUrl.searchParams.get('org_id')
  const filter = req.nextUrl.searchParams.get('filter') ?? undefined
  if (!orgId) return NextResponse.json({ error: 'Missing org_id' }, { status: 400 })
  try {
    const res = await fetch(`${process.env.MCP_BASE_URL}/alerts/notifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MCP_SECRET}`,
        'X-Org-Id':      orgId,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ filter }),
    })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'MCP unreachable' }, { status: 502 })
  }
}

export async function PATCH(req: NextRequest) {
  const { org_id, ids } = await req.json() as { org_id: string; ids: string[] }
  const res = await fetch(`${process.env.MCP_BASE_URL}/alerts/mark-read`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MCP_SECRET}`,
      'X-Org-Id':      org_id,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ ids: JSON.stringify(ids) }),
  })
  return NextResponse.json(await res.json())
}
