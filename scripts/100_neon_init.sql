-- Schema consolidado para Neon Postgres.
-- Substitui os scripts 001/002/003 do Supabase.
-- Diferencas em relacao ao Supabase:
--   * sem RLS (o browser nunca acessa o banco; tudo passa por API routes server-side)
--   * sem ALTER PUBLICATION supabase_realtime (Neon nao tem Realtime; usamos polling com cursor)
--   * duel_actions e duel_chat ganham `seq BIGSERIAL`, que e a base do cursor de sincronia do PVP

-- ---------------------------------------------------------------------------
-- Salas de duelo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS duel_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(6) UNIQUE NOT NULL,
  host_id VARCHAR(50) NOT NULL,
  host_name VARCHAR(100) NOT NULL,
  host_deck JSONB,
  guest_id VARCHAR(50),
  guest_name VARCHAR(100),
  guest_deck JSONB,
  host_ready BOOLEAN DEFAULT FALSE,
  guest_ready BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'waiting', -- waiting, ready, playing, finished
  game_state JSONB,
  current_turn VARCHAR(50),
  turn_number INTEGER DEFAULT 1,
  phase VARCHAR(20) DEFAULT 'draw',
  winner_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Chat da sala. `seq` permite polling incremental (WHERE seq > cursor).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS duel_chat (
  seq BIGSERIAL PRIMARY KEY,
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES duel_rooms(id) ON DELETE CASCADE,
  sender_id VARCHAR(50) NOT NULL,
  sender_name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Acoes do duelo. `seq` e a ordem canonica e o cursor do polling.
-- O antigo `sequence_number` (que era gravado com valor fixo 1) foi removido.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS duel_actions (
  seq BIGSERIAL PRIMARY KEY,
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES duel_rooms(id) ON DELETE CASCADE,
  player_id VARCHAR(50) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  action_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Contas do jogo (auth propria com scrypt, nao e Supabase Auth nem Better Auth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  unique_code VARCHAR(12) UNIQUE,
  password_hash TEXT NOT NULL,
  session_token TEXT UNIQUE,
  progress JSONB,
  last_saved TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT game_accounts_identifier CHECK (
    email IS NOT NULL OR unique_code IS NOT NULL
  )
);

-- ---------------------------------------------------------------------------
-- Indices
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_duel_rooms_room_code ON duel_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_duel_rooms_status ON duel_rooms(status);
CREATE INDEX IF NOT EXISTS idx_duel_chat_room_seq ON duel_chat(room_id, seq);
CREATE INDEX IF NOT EXISTS idx_duel_actions_room_seq ON duel_actions(room_id, seq);
CREATE INDEX IF NOT EXISTS idx_game_accounts_email ON game_accounts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_game_accounts_unique_code ON game_accounts(unique_code) WHERE unique_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_game_accounts_session_token ON game_accounts(session_token) WHERE session_token IS NOT NULL;

-- ---------------------------------------------------------------------------
-- updated_at automatico em duel_rooms
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_duel_rooms_updated_at ON duel_rooms;
CREATE TRIGGER update_duel_rooms_updated_at
  BEFORE UPDATE ON duel_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
