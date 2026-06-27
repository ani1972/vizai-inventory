'use client'
// apps/web/hooks/useUser.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

export interface UserProfile {
  id:       string
  name:     string
  email:    string
  role:     'super_admin' | 'manager' | 'ops' | 'user'
  org_id:   string
  org_name: string
  plan:     string
}

export function useUser() {
  const [user,    setUser]    = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
      else { setUser(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, role, org_id, organisations(name, plan)')
      .eq('id', userId)
      .single()
    if (data) {
      setUser({
        id:       data.id,
        name:     data.name,
        email:    data.email,
        role:     data.role,
        org_id:   data.org_id,
        org_name: (data.organisations as { name: string } | null)?.name ?? 'VizAI',
        plan:     (data.organisations as { plan: string } | null)?.plan ?? 'pro',
      })
    }
    setLoading(false)
  }

  return { user, session, loading }
}
