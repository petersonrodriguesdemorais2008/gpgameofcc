-- Add sequence_number column to duel_actions table for action ordering
-- This ensures actions are processed in the correct order

-- Add the column if it doesn't exist
ALTER TABLE duel_actions 
ADD COLUMN IF NOT EXISTS sequence_number BIGINT DEFAULT 0;

-- Update existing NULL values with sequential numbers using a subquery
WITH numbered_actions AS (
  SELECT id, row_number() OVER (PARTITION BY room_id ORDER BY created_at) as rn
  FROM duel_actions
  WHERE sequence_number IS NULL OR sequence_number = 0
)
UPDATE duel_actions
SET sequence_number = numbered_actions.rn
FROM numbered_actions
WHERE duel_actions.id = numbered_actions.id;

-- Function to get the next sequence number for a room
CREATE OR REPLACE FUNCTION get_next_action_sequence(p_room_id UUID)
RETURNS BIGINT AS $$
DECLARE
  max_seq BIGINT;
BEGIN
  -- Get the maximum sequence number for this room
  SELECT COALESCE(MAX(sequence_number), 0) INTO max_seq
  FROM duel_actions
  WHERE room_id = p_room_id;
  
  RETURN max_seq + 1;
END;
$$ LANGUAGE plpgsql;

-- Add index for better performance on sequence_number queries
CREATE INDEX IF NOT EXISTS idx_duel_actions_sequence 
ON duel_actions(room_id, sequence_number);
