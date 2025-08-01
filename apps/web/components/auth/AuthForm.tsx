'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase, isSupabaseConfigured } from '../../lib/supabase/config'

export default function AuthForm() {
  console.log('🔍 AuthForm Debug:', {
    isSupabaseConfigured,
    hasSupabaseClient: !!supabase,
    windowLocation: typeof window !== 'undefined' ? window.location.origin : 'server'
  })

  if (!isSupabaseConfigured) {
    return (
      <div className="auth-form-container">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <h3>Supabase Not Configured</h3>
          <p>Please configure your Supabase environment variables to enable authentication.</p>
          <p>Add these to your <code>.env.local</code> file:</p>
          <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
{`NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key`}
          </pre>
          <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            Debug: Check browser console for environment variable status
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-form-container">
      <Auth
        supabaseClient={supabase}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: '#00FFB2',
                brandAccent: '#00CC8E',
              },
            },
          },
        }}
        providers={['google', 'github']}
        redirectTo={`${window.location.origin}/auth/callback`}
        showLinks={true}
        view="sign_in"
        theme="dark"
      />
    </div>
  )
} 