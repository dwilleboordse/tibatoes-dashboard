import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      setProfile(data ?? null)
    } catch (e) {
      console.error('[auth] loadProfile failed', e)
      setProfile(null)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!active) return
        const u = data.session?.user ?? null
        setUser(u)
        if (u) await loadProfile(u.id)
      } catch (e) {
        console.error('[auth] getSession failed', e)
      } finally {
        if (active) setLoading(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) await loadProfile(u.id)
      else setProfile(null)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }
  async function signOut() { await supabase.auth.signOut() }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
