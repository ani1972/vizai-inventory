// apps/web/app/api/chat/route.ts
// Req 2: chatbot API — role-aware, connects to AI router
// Req 4: model routing happens inside ai-router package
// Session minimization: history capped at 6 turns

import { NextRequest, NextResponse } from 'next/server'
import { chat } from '../../../../../packages/ai-router'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    query:   string
    history: Array<{ role: 'user' | 'assistant'; content: string }>
    session_token: string
  }

  if (!body.query?.trim()) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  // Verify session and get user
  const { data: { user }, error: authErr } = await supabase.auth.getUser(body.session_token)
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Get user profile + org
  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id, organisations(name)')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
  }

  // Whitelist pre-check: if query mentions an item, check before calling model
  // Req 12: no MCP call made for blocked items
  const skuMatch = body.query.match(/\b(VZ-[A-Z]+-\d+)\b/i)
  if (skuMatch) {
    const res = await fetch(`${process.env.MCP_BASE_URL}/inventory/whitelist-check`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MCP_SECRET}`,
        'X-Org-Id':      profile.org_id,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ sku: skuMatch[1], channel: 'chatbot' }),
    })
    const wl = await res.json() as { data?: { allowed: boolean } }
    if (wl.data && !wl.data.allowed) {
      return NextResponse.json({
        text:       `"${skuMatch[1]}" is not on the approved whitelist for VizAI Engineering. I can't process requests for this item. Contact your procurement manager to request approval.`,
        model_used: 'none (pre-filtered)',
        complexity: 'simple',
        tools_used: [],
        tokens_in:  0,
        tokens_out: 0,
        blocked:    true,
      })
    }
  }

  // Route to AI (req 4: model routing inside chat())
  try {
    const response = await chat({
      query:   body.query,
      orgId:   profile.org_id,
      orgName: (profile.organisations as { name?: string } | null)?.name ?? 'VizAI',
      userId:  user.id,
      role:    profile.role,
      history: body.history.slice(-6),  // session minimization
    })

    return NextResponse.json(response)
  } catch (e) {
    console.error('AI router error', e)
    return NextResponse.json({ error: 'Chat service error' }, { status: 500 })
  }
}
