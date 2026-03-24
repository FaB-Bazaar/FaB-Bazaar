-- Add double-faced card (DFC) linking fields to printings table
-- other_face_printing_id: the printing_id of the other face (NULL for single-faced cards)
-- is_front_face: true for front face or single-faced cards, false for back face printings

ALTER TABLE printings ADD COLUMN IF NOT EXISTS other_face_printing_id TEXT;
ALTER TABLE printings ADD COLUMN IF NOT EXISTS is_front_face BOOLEAN NOT NULL DEFAULT true;
