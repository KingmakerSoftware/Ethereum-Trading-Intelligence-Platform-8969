import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://caxwxxqlyznymadgaqwj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNheHd4eHFseXpueW1hZGdhcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1MTIyNjgsImV4cCI6MjA2NzA4ODI2OH0.vHj0fZ8k77GUcEzg96BDiq8ilv77TeQTI6Ol97k6bnM'

if(SUPABASE_URL === 'https://<PROJECT-ID>.supabase.co' || SUPABASE_ANON_KEY === '<ANON_KEY>') {
  throw new Error('Missing Supabase variables');
}

export default createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})