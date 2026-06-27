'use client'
// apps/web/components/Chatbot.tsx
// Req 2: role-aware chatbot widget, always visible
// Shows model used, tokens, complexity on each response

import { useState, useRef, useEffect } from 'react'
import { useUser } from '../hooks/useUser'

interface Message {
  role:       'user' | 'assistant'
  content:    string
  model?:     string
  complexity?: string
  tokens_in?:  number
  tokens_out?: number
  blocked?:   boolean
}

export function Chatbot() {
  const [open,    setOpen]    = useState(false)
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<Message[]>([])
  const endRef  = useRef<HTMLDivElement>(null)
  const { user, session } = useUser()

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  async function send() {
    const q = input.trim()
    if (!q || loading) return

    const userMsg: Message = { role: 'user', content: q }
    setHistory(h => [...h, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          query:         q,
          session_token: session?.access_token,
          history:       history.map(m => ({ role: m.role, content: m.content })).slice(-6),
        }),
      })

      const data = await res.json() as {
        text: string; model_used: string; complexity: string;
        tokens_in: number; tokens_out: number; blocked?: boolean
      }

      setHistory(h => [...h, {
        role:       'assistant',
        content:    data.text,
        model:      data.model_used,
        complexity: data.complexity,
        tokens_in:  data.tokens_in,
        tokens_out: data.tokens_out,
        blocked:    data.blocked,
      }])
    } catch {
      setHistory(h => [...h, {
        role:    'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }])
    } finally {
      setLoading(false)
    }
  }

  const QUICK_QUERIES = [
    'How many items are working?',
    'What is low on stock?',
    'Show open purchase orders',
    'Any damaged items today?',
  ]

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg hover:bg-emerald-400 transition-colors"
        aria-label="Open VizAI assistant"
      >
        <i className={`ti ${open ? 'ti-x' : 'ti-message'} text-xl`} aria-hidden="true" />
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-96 h-[520px] bg-[#1A1D23] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
            <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center text-black text-xs font-bold">V</div>
            <div className="flex-1">
              <div className="text-sm font-medium text-white">VizAI assistant</div>
              <div className="text-xs text-gray-500">{user?.role} · {user?.org_name}</div>
            </div>
            <button
              onClick={() => setHistory([])}
              className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded"
              title="Clear chat"
            >
              Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-3">Quick questions:</p>
                {QUICK_QUERIES.map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); setTimeout(send, 50) }}
                    className="block w-full text-left text-xs text-gray-300 bg-[#22262E] hover:bg-[#2A2F3A] rounded-lg px-3 py-2 border border-white/8 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {history.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-emerald-500/20 text-white border border-emerald-500/20'
                    : msg.blocked
                      ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                      : 'bg-[#22262E] text-gray-200 border border-white/8'
                }`}>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  {msg.model && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-white/8">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                        msg.complexity === 'complex' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {msg.model.split('-').slice(-2).join('-')}
                      </span>
                      <span className="text-xs text-gray-600">
                        ↑{msg.tokens_in} ↓{msg.tokens_out}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#22262E] border border-white/8 rounded-xl px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
                           style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/8">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask about stock, orders, devices…"
                className="flex-1 bg-[#22262E] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-emerald-500/40 transition-colors"
                disabled={loading}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="w-9 h-9 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 rounded-lg flex items-center justify-center text-black transition-colors"
                aria-label="Send message"
              >
                <i className="ti ti-send text-base" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
