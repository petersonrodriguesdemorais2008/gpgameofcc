import "server-only"
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

// Cliente admin (service role) — usar SOMENTE no servidor.
// Nunca importe este arquivo em componentes client.
export function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error("Supabase admin environment variables are not configured")
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
