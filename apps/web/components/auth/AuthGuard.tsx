'use client'

import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { isSupabaseConfigured } from '../../lib/supabase/config'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
}

export default function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  console.log('🔍 AuthGuard Debug:', { user, profile, loading, requireAuth, isSupabaseConfigured })

  useEffect(() => {
    // Skip auth checks if Supabase is not configured
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured - skipping auth guard')
      return
    }

    console.log('🔍 AuthGuard useEffect:', { loading, user, profile, requireAuth })

    if (!loading) {
      // If user exists but no profile, they need to sign in again
      if (user && !profile) {
        console.log('🔍 AuthGuard: User exists but no profile, redirecting to /auth')
        router.push('/auth')
        return
      }
      
      if (requireAuth && !user) {
        console.log('🔍 AuthGuard: Redirecting to /auth (no user)')
        router.push('/auth')
      } else if (!requireAuth && user && profile) {
        console.log('🔍 AuthGuard: Redirecting to / (user exists with profile)')
        router.push('/')
      }
    }
  }, [user, profile, loading, requireAuth, router])

  // Skip auth checks if Supabase is not configured
  if (!isSupabaseConfigured) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="loading-spinner">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (requireAuth && !user) {
    return null // Will redirect to /auth
  }

  if (!requireAuth && user) {
    return null // Will redirect to /
  }

  return <>{children}</>
} 