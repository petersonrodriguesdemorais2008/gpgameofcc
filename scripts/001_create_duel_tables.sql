-- Duel Rooms table for multiplayer matches
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

-- Chat messages for duel rooms
CREATE TABLE IF NOT EXISTS duel_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES duel_rooms(id) ON DELETE CASCADE,
  sender_id VARCHAR(50) NOT NULL,
  sender_name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game actions for real-time sync
CREATE TABLE IF NOT EXISTS duel_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES duel_rooms(id) ON DELETE CASCADE,
  player_id VARCHAR(50) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  action_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_duel_rooms_room_code ON duel_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_duel_rooms_status ON duel_rooms(status);
CREATE INDEX IF NOT EXISTS idx_duel_chat_room_id ON duel_chat(room_id);
CREATE INDEX IF NOT EXISTS idx_duel_actions_room_id ON duel_actions(room_id);
CREATE INDEX IF NOT EXISTS idx_duel_actions_created ON duel_actions(room_id, created_at);

-- Enable Row Level Security
ALTER TABLE duel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE duel_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE duel_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for duel_rooms (allow all operations for now since we're using player IDs, not auth)
CREATE POLICY "Allow all operations on duel_rooms" ON duel_rooms FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for duel_chat
CREATE POLICY "Allow all operations on duel_chat" ON duel_chat FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for duel_actions
CREATE POLICY "Allow all operations on duel_actions" ON duel_actions FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE duel_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE duel_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE duel_actions;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_duel_rooms_updated_at ON duel_rooms;
CREATE TRIGGER update_duel_rooms_updated_at
  BEFORE UPDATE ON duel_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique room codes
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS VARCHAR(6) AS $$
DECLARE
  chars VARCHAR := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result VARCHAR(6) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
