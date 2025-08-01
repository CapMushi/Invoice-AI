import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Debug logging to help troubleshoot environment variables
console.log('🔍 Supabase Config Debug:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlLength: supabaseUrl?.length || 0,
  keyLength: supabaseAnonKey?.length || 0,
  url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'undefined',
  key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'undefined'
})

// Create a fallback client for development when env vars are not set
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

// Check if Supabase is properly configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

// Database types for TypeScript
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
          updated_at: string | null
          created_via_invitation: boolean | null
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          updated_at?: string | null
          created_via_invitation?: boolean | null
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          updated_at?: string | null
          created_via_invitation?: boolean | null
        }
      }
      teams: {
        Row: {
          id: string
          team_name: string
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          team_name: string
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          team_name?: string
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      team_members: {
        Row: {
          id: string
          team_id: string | null
          user_id: string | null
          role: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          team_id?: string | null
          user_id?: string | null
          role?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          team_id?: string | null
          user_id?: string | null
          role?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      quickbooks_tokens: {
        Row: {
          id: string
          user_id: string | null
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          realm_id: string | null
          expires_at: string | null
          created_at: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          realm_id?: string | null
          expires_at?: string | null
          created_at?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          realm_id?: string | null
          expires_at?: string | null
          created_at?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
      }
    }
  }
}