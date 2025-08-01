'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../../lib/supabase/config'
import { getCurrentUser, getUserProfile } from '../../lib/supabase/auth'
import type { Profile } from '../../lib/supabase/auth'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('🔍 AuthProvider: Starting auth setup, isSupabaseConfigured:', isSupabaseConfigured)
    
    // Skip Supabase auth if not configured
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured - skipping authentication')
      setLoading(false)
      return
    }

    // Get initial session using Supabase built-in function
    const getInitialSession = async () => {
      try {
        console.log('🔍 AuthProvider: Getting initial session...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        console.log('🔍 AuthProvider: Initial session result:', { 
          hasSession: !!session, 
          hasUser: !!session?.user,
          userId: session?.user?.id,
          error 
        })
        
        if (error) {
          console.error('Error getting initial session:', error)
          setLoading(false)
          return
        }

        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          console.log('🔍 AuthProvider: Getting profile for user:', session.user.id)
          setLoading(false) // Set loading to false immediately
          
          // Load profile in background
          getUserProfile(session.user.id)
            .then(userProfile => {
              console.log('🔍 AuthProvider: Profile result:', { userProfile })
              setProfile(userProfile)
            })
            .catch(error => {
              console.error('🔍 AuthProvider: Error getting profile (initial):', error)
              setProfile(null)
            })
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error)
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes using Supabase built-in function
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔍 AuthProvider: Auth state changed:', event, session)
        
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          console.log('🔍 AuthProvider: Getting profile for user (auth change):', session.user.id)
          setLoading(false) // Set loading to false immediately
          
          // Load profile in background
          getUserProfile(session.user.id)
            .then(userProfile => {
              console.log('🔍 AuthProvider: Profile result (auth change):', { userProfile })
              setProfile(userProfile)
            })
            .catch(error => {
              console.error('🔍 AuthProvider: Error getting profile:', error)
              setProfile(null)
            })
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error)
    }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 