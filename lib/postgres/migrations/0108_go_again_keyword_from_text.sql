-- 0108: "go again" is a card's keyword even when it sits on an activated ability.
--
-- Why: cards.keywords comes from the fab-cube feed's card_keywords via the
-- nightly transformer (003 → 005), and the feed omits "go again" whenever it
-- belongs to an ability line ("Action -- destroy this: ... Go again") rather
-- than the card's top line. 203 cards on 2026-09-07 had it in their rules
-- text but not in keywords (Potion of Strength, Goliath Gauntlet, Cintari
-- Sellsword, Restless Corporal …), so keyword:"go again" — the most-typed
-- keyword — silently missed them. A GRANT to something else ("your next
-- attack gets go again") is not the card's keyword and stays out.
--
-- The durable fix lives in the transformer (augment_go_again_keyword in
-- 003_cards_to_printings_transformer.py; test_go_again_keyword.py). This
-- migration brings the DB to the SAME shape — 'go again' appended to the
-- existing array, as the transformer emits — so the app is right at deploy
-- time and the nightly upsert is a no-op. The regexp below was verified to
-- select exactly the same 203 cards as the Python rule.
--
-- Idempotent: only rows whose keywords lack 'go again' are touched.

UPDATE cards
SET keywords = array_append(COALESCE(keywords, '{}'), 'go again')
WHERE text IS NOT NULL
  AND NOT ('go again' = ANY(COALESCE(keywords, '{}')))
  AND regexp_replace(
        text,
        '(get|gets|gain|gains|has|have|with|grant|grants|granted|lose|loses)\s+(\+\d\{[a-z]\}\s+and\s+)?["'']?go again',
        '', 'gi'
      ) ~* '\mgo again\M';
