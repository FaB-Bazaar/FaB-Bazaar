-- 0093: link the double-sided promo/token faces at HER146 and ROS257.
--
-- Both collectors carry two-faced physical cards whose rows were created
-- unlinked (both faces marked front, no other_face_printing_id), surfacing
-- as key collisions in the deterministic image-id audit:
--
--   HER146 (Super Slam promo): Kassai of the Golden Sand (front) //
--     Tuffnut, Bumbling Hulkster (back). CardVault face ids: HER146-RF
--     (Kassai) vs HER146-ARF (Tuffnut).
--
--   ROS257 (Rosetta token sheet, fab-cube "V2"/"V2_BACK" scans — each image
--     is a two-up spread of one token's faces):
--       token A: Embodiment of Earth (front) // Runechant, green art (back)
--       token B: Embodiment of Lightning (front) // Runechant, purple art (back)
--
-- printing_ids verified identical on local and prod (both descend from the
-- same pipeline rows). Idempotent: fixed values keyed by immutable PKs.

-- HER146 — Kassai // Tuffnut
UPDATE printings SET is_front_face = false, other_face_printing_id = 'MTd66PGLqznJ7KGrGczmW'
  WHERE printing_id = 'GKzW9mhtMFRMfQNzpNcw8';
UPDATE printings SET is_front_face = true, other_face_printing_id = 'GKzW9mhtMFRMfQNzpNcw8'
  WHERE printing_id = 'MTd66PGLqznJ7KGrGczmW';

-- ROS257 token A — Embodiment of Earth // Runechant (green)
UPDATE printings SET is_front_face = false, other_face_printing_id = 'WNJdpMp9wf7tn9wWPhj9q'
  WHERE printing_id = 'T68NPBcTGDQgnjKJLqC6h';
UPDATE printings SET is_front_face = true, other_face_printing_id = 'T68NPBcTGDQgnjKJLqC6h'
  WHERE printing_id = 'WNJdpMp9wf7tn9wWPhj9q';

-- ROS257 token B — Embodiment of Lightning // Runechant (purple)
UPDATE printings SET is_front_face = false, other_face_printing_id = 'TTnpW9DRppzPFb8zbhgTL'
  WHERE printing_id = 'BNQBRkrQCn6pJd9fmGMf7';
UPDATE printings SET is_front_face = true, other_face_printing_id = 'BNQBRkrQCn6pJd9fmGMf7'
  WHERE printing_id = 'TTnpW9DRppzPFb8zbhgTL';
