# Phase 1 Setup Guide

## Quick Start

The application is now configured to run without Supabase for development purposes. You can start the development server immediately:

```bash
npm run dev
```

## Environment Configuration

### Option 1: Run Without Supabase (Development Only)
The application will run with placeholder authentication. You'll see a message indicating Supabase is not configured.

### Option 2: Configure Supabase (Recommended)

1. **Create a Supabase Project**:
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anon key

2. **Create Environment File**:
   Create `.env.local` in the `apps/web/` directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# QuickBooks (existing)
QUICKBOOKS_CLIENT_ID=your_quickbooks_client_id
QUICKBOOKS_CLIENT_SECRET=your_quickbooks_client_secret
QUICKBOOKS_REDIRECT_URI=your_redirect_uri
QUICKBOOKS_ENVIRONMENT=sandbox

# OpenAI (existing)
OPENAI_API_KEY=your_openai_api_key
```

3. **Set Up Database**:
   - Go to your Supabase dashboard
   - Navigate to SQL Editor
   - Run the SQL from `lib/supabase/schema.sql`

4. **Configure OAuth Providers** (Optional):
   - In Supabase dashboard, go to Authentication > Providers
   - Configure Google and GitHub OAuth

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Current Status

- ✅ **Phase 1 Complete**: Supabase integration implemented
- ✅ **Fallback Mode**: App runs without Supabase configured
- ✅ **Authentication Ready**: Auth components and guards in place
- ✅ **Database Schema**: Ready for deployment

## Next Steps

1. **Configure Supabase** (if not done)
2. **Test Authentication**: Sign up/login flow
3. **Proceed to Phase 2**: QuickBooks OAuth refactoring

## Troubleshooting

### "Failed to fetch" Error
This was caused by missing environment variables. The app now handles this gracefully with fallback mode.

### Authentication Not Working
- Check that Supabase environment variables are set
- Verify database schema is deployed
- Check browser console for errors

### Development Mode
The app will show helpful messages when Supabase is not configured, allowing you to develop other features while setting up authentication. 