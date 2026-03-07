import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error('Missing Supabase env vars. Check your .env file.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
