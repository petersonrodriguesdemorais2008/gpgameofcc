import { createBrowserClient, type SupabaseClient } from '@supabase/ssr'

let supabaseClient: SupabaseClient | null = null

export function createClient(): SupabaseClient | null {
  // Return cached client if already created successfully
  if (supabaseClient) {
    return supabaseClient
  }

  const rawUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!rawUrl || !anonKey) {
    console.warn('[Supabase] Variáveis de ambiente não encontradas.')
    return null
  }

  // Sanitize: remove trailing slash from URL
  const supabaseUrl = rawUrl.replace(/\/+$/, '')

  // Validate URL format
  if (!supabaseUrl.startsWith('https://')) {
    console.error('[Supabase] URL inválida — deve começar com https://')
    return null
  }

  try {
    supabaseClient = createBrowserClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
    console.log('[Supabase] Cliente criado com sucesso para:', supabaseUrl)
    return supabaseClient
  } catch (err) {
    console.error('[Supabase] Erro ao criar cliente:', err)
    return null
  }
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// Reset cached client (useful for testing)
export function resetClient(): void {
  supabaseClient = null
}
