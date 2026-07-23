-- Repair: superadmin-owned featured decks ARE Decks to Beat entries, but the
-- bulk tournament imports set featured without is_system_deck. That mismatch
-- leaked every reference deck into Community listings, the owner's personal
-- views (navbar, decks page, MCP list_decks, Talishar sync), and defeated the
-- listPublicDecks system-deck exclusion.
--
-- Scope: only decks owned by a superadmin — a curator-featured deck belonging
-- to a regular member is a genuine community deck and keeps its flags.
UPDATE decks d
SET is_system_deck = true
FROM users u
WHERE d.user_id = u.id
  AND u.is_super_admin = true
  AND d.featured = true
  AND d.is_system_deck = false;
