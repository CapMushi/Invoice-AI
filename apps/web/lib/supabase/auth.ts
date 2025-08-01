import { supabase } from './config'
import type { Database } from './config'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type TeamMember = Database['public']['Tables']['team_members']['Row']
export type QuickBooksTokens = Database['public']['Tables']['quickbooks_tokens']['Row']

// Get current user using Supabase built-in function
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Error getting current user:', error)
    return null
  }
  return user
}

// Get user profile using Supabase built-in function
export async function getUserProfile(userId: string) {
  console.log('🔍 getUserProfile called with userId:', userId)
  
  if (!userId) {
    console.error('Error getting user profile: No userId provided')
    return null
  }

  try {
    // Try a simpler query first to test connection
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
    
    console.log('🔍 Test query result:', { testData, testError })

    // Now try the actual query - use maybeSingle to handle missing profiles gracefully
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    console.log('🔍 getUserProfile result:', { profile, error, hasProfile: !!profile })

    if (error) {
      console.error('Error getting user profile:', error)
      return null
    }
    
    return profile
  } catch (err) {
    console.error('Exception in getUserProfile:', err)
    return null
  }
}

// Create or update user profile using Supabase built-in function
export async function upsertUserProfile(userId: string, profile: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      ...profile,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting user profile:', error)
    return null
  }
  return data
}

// Get user's teams using Supabase built-in function
export async function getUserTeams(userId: string) {
  const { data: teams, error } = await supabase
    .from('team_members')
    .select(`
      team_id,
      role,
      teams (
        id,
        team_name,
        created_by
      )
    `)
    .eq('user_id', userId)

  if (error) {
    console.error('Error getting user teams:', error)
    return []
  }
  return teams
}

// Get team members using Supabase built-in function
export async function getTeamMembers(teamId: string) {
  const { data: members, error } = await supabase
    .from('team_members')
    .select(`
      user_id,
      role,
      profiles (
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('team_id', teamId)

  if (error) {
    console.error('Error getting team members:', error)
    return []
  }
  return members
}

// Check user role for a specific team using Supabase built-in function
export async function checkUserRole(userId: string, teamId: string, allowedRoles: string[]) {
  const { data: member, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .single()

  if (error || !member) {
    return false
  }

  return allowedRoles.includes(member.role)
}

// Get QuickBooks tokens for user using Supabase built-in function
export async function getQuickBooksTokens(userId: string) {
  const { data: tokens, error } = await supabase
    .from('quickbooks_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('Error getting QuickBooks tokens:', error)
    return null
  }
  return tokens
}

// Store QuickBooks tokens using Supabase built-in function
export async function storeQuickBooksTokens(userId: string, tokens: Omit<QuickBooksTokens, 'user_id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('quickbooks_tokens')
    .upsert({
      user_id: userId,
      ...tokens,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('Error storing QuickBooks tokens:', error)
    return null
  }
  return data
}

// Sign out using Supabase built-in function
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error)
      return false
    }
    
    // Clear any local storage that might be causing issues
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sb-access-token')
      localStorage.removeItem('sb-refresh-token')
      sessionStorage.clear()
    }
    
    return true
  } catch (err) {
    console.error('Exception in signOut:', err)
    return false
  }
} 