-- Tabela de contas do jogo (autenticacao customizada, sem Supabase Auth)
-- Esta tabela e usada pela API /api/account para registro, login e save de progresso.
-- O progresso completo do jogador fica no campo JSONB `progress`.

CREATE TABLE IF NOT EXISTS game_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Pelo menos um dos dois deve estar preenchido (email OU unique_code)
  email TEXT UNIQUE,
  unique_code VARCHAR(12) UNIQUE,
  -- Senha com hash scrypt (salt:hash)
  password_hash TEXT NOT NULL,
  -- Token de sessao (gerado no login/registro, valida requests de save/load)
  session_token TEXT UNIQUE,
  -- Progresso completo do jogador serializado em JSON
  progress JSONB,
  last_saved TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT game_accounts_identifier CHECK (
    email IS NOT NULL OR unique_code IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_game_accounts_email
  ON game_accounts(email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_game_accounts_unique_code
  ON game_accounts(unique_code) WHERE unique_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_game_accounts_session_token
  ON game_accounts(session_token) WHERE session_token IS NOT NULL;

-- RLS: A tabela so e acessada pelo service_role (server-side), nunca pelo cliente browser.
ALTER TABLE game_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS game_accounts_service_all
  ON game_accounts FOR ALL USING (true) WITH CHECK (true);
