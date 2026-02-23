import { createClient } from '@supabase/supabase-js'

import { env } from '../config/env'

const realSupabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
})

declare global {
  interface Window {
    __MAESTRO_SUPABASE_MOCK__?: typeof realSupabase
  }
}

const browserMockSupabase =
  typeof window !== 'undefined' ? window.__MAESTRO_SUPABASE_MOCK__ : undefined

export const supabase = browserMockSupabase ?? realSupabase
