-- 0121: Fold Future Classic Constructed into Classic Constructed
--
-- Future CC was a separate deck format for spoiler-season brewing: the CC pool
-- plus every card printed in a set whose release date is still ahead. That
-- pool is now simply what a CC deck builds from (legality at play time is
-- Talishar's call), so the retired format name moves to CC. The CC banlist
-- already applied to Future CC decks, so nothing else about these decks
-- changes. Idempotent.

UPDATE decks
SET format = 'Classic Constructed'
WHERE format = 'Future Classic Constructed';
