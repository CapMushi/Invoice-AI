'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/config'
import { upsertUserProfile } from '../../lib/supabase/auth'

export default function AuthCallback() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          setError('Authentication failed')
          setLoading(false)
          return
        }

        if (!session) {
          console.error('No session found')
          setError('No session found')
          setLoading(false)
          return
        }

        // Create or update user profile
        const profile = await upsertUserProfile(session.user.id, {
          full_name: session.user.user_metadata?.full_name || null,
          avatar_url: session.user.user_metadata?.avatar_url || null,
        })

        if (!profile) {
          console.error('Failed to create user profile')
          setError('Failed to create user profile')
          setLoading(false)
          return
        }

        console.log('Authentication successful, redirecting...')
        router.push('/')
      } catch (err) {
        console.error('Auth callback error:', err)
        setError('Authentication failed')
        setLoading(false)
      }
    }

    handleAuthCallback()
  }, [router])

  if (loading) {
    return (
      <div className="loading-spinner">
        <p>Completing authentication...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-message">
        <p>Error: {error}</p>
        <button onClick={() => router.push('/auth')}>
          Try Again
        </button>
      </div>
    )
  }

  return null
} 