-- Fix chat table columns if needed
-- Drop and recreate duel_chat with correct column names

-- First, drop the table if it exists (will cascade delete the policies)
DROP TABLE IF EXISTS duel_chat CASCADE;

-- Recreate with correct column names
CREATE TABLE IF NOT EXISTS duel_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES duel_rooms(id) ON DELETE CASCADE,
  sender_id VARCHAR(50) NOT NULL,
  sender_name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_duel_chat_room_id ON duel_chat(room_id);

-- Enable RLS
ALTER TABLE duel_chat ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations on duel_chat" ON duel_chat FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE duel_chat;
