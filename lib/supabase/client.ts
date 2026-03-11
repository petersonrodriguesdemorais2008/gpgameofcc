import { createBrowserClient, type SupabaseClient } from '@supabase/ssr'

let supabaseClient: SupabaseClient | null = null

export function createClient(): SupabaseClient | null {
  // Return cached client if available
  if (supabaseClient) {
    return supabaseClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Don't throw - just return null and let the app work without cloud features
    console.warn('[v0] Supabase not configured - cloud features disabled')
    return null
  }
  
  supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return supabaseClient
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
