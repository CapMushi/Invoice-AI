# Phase 1 Setup: Supabase Integration

## Overview
This document outlines the Phase 1 implementation of the invoice bot upgrade, which adds Supabase authentication and database foundation.

## What's Implemented

### ✅ Supabase Integration
- **Supabase Client Configuration**: `lib/supabase/config.ts`
- **Authentication Utilities**: `lib/supabase/auth.ts`
- **Database Schema**: `lib/supabase/schema.sql`
- **TypeScript Types**: Full type safety for database operations

### ✅ Authentication Components
- **AuthProvider**: Context provider for authentication state
- **AuthForm**: Supabase Auth UI component with OAuth providers
- **AuthCallback**: Handles OAuth redirects and profile creation
- **AuthGuard**: Route protection component

### ✅ Database Schema
- **profiles**: User profiles extending auth.users
- **teams**: Team/workspace management
- **team_members**: Role-based access control
- **quickbooks_tokens**: Encrypted token storage
- **RLS Policies**: Row-level security for data isolation

### ✅ Authentication Flow
- **Email/Password**: Standard Supabase Auth
- **OAuth Providers**: Google, GitHub integration
- **Session Management**: JWT-based sessions
- **Profile Creation**: Automatic profile creation on signup

## Environment Variables Required

Add these to your `.env.local` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# QuickBooks (existing)
QUICKBOOKS_CLIENT_ID=your_quickbooks_client_id
QUICKBOOKS_CLIENT_SECRET=your_quickbooks_client_secret
QUICKBOOKS_REDIRECT_URI=your_redirect_uri
QUICKBOOKS_ENVIRONMENT=sandbox

# OpenAI (existing)
OPENAI_API_KEY=your_openai_api_key
```

## Database Setup

1. **Create Supabase Project**: Set up a new Supabase project
2. **Run Schema**: Execute the SQL in `lib/supabase/schema.sql`
3. **Configure OAuth**: Set up Google and GitHub OAuth providers in Supabase dashboard
4. **Update Redirect URLs**: Add your domain to allowed redirect URLs

## File Structure

```
apps/web/
├── lib/supabase/
│   ├── config.ts          # Supabase client configuration
│   ├── auth.ts            # Authentication utilities
│   └── schema.sql         # Database schema
├── components/auth/
│   ├── AuthProvider.tsx   # Authentication context
│   ├── AuthForm.tsx       # Supabase Auth UI
│   ├── AuthCallback.tsx   # OAuth callback handler
│   └── AuthGuard.tsx      # Route protection
├── app/auth/
│   ├── page.tsx           # Authentication page
│   ├── callback/page.tsx  # OAuth callback page
│   └── auth.module.css    # Authentication styles
└── app/
    ├── layout.tsx         # Updated with AuthProvider
    └── page.tsx           # Updated with AuthGuard
```

## Key Features

### 🔐 Authentication
- **Supabase Auth UI**: Pre-built authentication forms
- **OAuth Integration**: Google and GitHub login
- **Session Management**: Automatic session handling
- **Profile Creation**: Automatic profile creation on signup

### 🗄️ Database
- **Row-Level Security**: Automatic data filtering
- **Type Safety**: Full TypeScript support
- **Automatic Triggers**: Profile creation on user signup
- **Encrypted Storage**: Secure token storage

### 🛡️ Security
- **RLS Policies**: Database-level security
- **User Isolation**: Users can only access their data
- **Encrypted Tokens**: QuickBooks tokens are encrypted
- **Session Validation**: Proper session management

## Usage

### Authentication Flow
1. User visits `/auth`
2. Signs in with email/password or OAuth
3. Redirected to `/auth/callback`
4. Profile created automatically
5. Redirected to main application

### Protected Routes
- All routes are protected by default
- Unauthenticated users redirected to `/auth`
- Authenticated users can access the application

### Database Operations
```typescript
// Get current user
const user = await getCurrentUser()

// Get user profile
const profile = await getUserProfile(userId)

// Get user's teams
const teams = await getUserTeams(userId)

// Check user role
const hasPermission = await checkUserRole(userId, teamId, ['admin'])
```

## Next Steps (Phase 2)

1. **QuickBooks OAuth Refactoring**: Associate tokens with authenticated users
2. **Team Management UI**: Build team creation and management interfaces
3. **AI Tools Refactoring**: Add team context to all AI tools
4. **Security Validation**: Test multi-user scenarios

## Testing

### Manual Testing
1. **Sign Up**: Create new account with email/password
2. **OAuth Login**: Test Google/GitHub login
3. **Session Persistence**: Verify session survives page refresh
4. **Profile Creation**: Check automatic profile creation
5. **Route Protection**: Verify unauthenticated users redirected

### Database Testing
1. **RLS Policies**: Verify users can only access their data
2. **Profile Creation**: Check automatic profile creation
3. **Token Storage**: Test encrypted token storage
4. **Team Isolation**: Verify data isolation between users

## Notes

- **No Breaking Changes**: Existing functionality preserved
- **Supabase Built-ins**: Using Supabase's built-in functions wherever possible
- **Type Safety**: Full TypeScript support throughout
- **Security First**: RLS policies and encryption implemented
- **Scalable Foundation**: Ready for Phase 2 multi-tenant features 