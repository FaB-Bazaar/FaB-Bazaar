-- 0060_add_facet_tag_definitions.sql
-- Runtime vocabulary for curated card facets. Replaces the compile-time
-- FACET_TAGS const (lib/search/card-facets.ts) as the SOURCE OF TRUTH for which
-- facet tags exist, so curators can create tags from the admin UI without a deploy.
--
-- card_facet_tags.tag now FK-references this table ON DELETE RESTRICT, so a tag
-- definition cannot be deleted while any card still uses it (delete-only-when-
-- unassigned). Deleting a definition never touches the cards table; removing an
-- assignment only ever rewrites cards.facet_tags (recomputed from card_facet_tags).
--
-- Ordering is load-bearing: create table -> seed -> backfill any drifted tag ->
-- add FK. Adding the FK before every existing card_facet_tags.tag has a matching
-- definition would abort the migration.

-- 1. Definitions table (the runtime vocabulary).
CREATE TABLE IF NOT EXISTS facet_tag_definitions (
  id         text PRIMARY KEY,                 -- slug, e.g. 'combo-enabler'
  dim        text NOT NULL,                    -- 'mechanical' | 'strategic' | 'synergy'
  label      text NOT NULL,
  def        text NOT NULL DEFAULT '',
  draft      boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Seed the 26 vocabulary tags (mirrors lib/search/card-facets.ts FACET_TAGS).
--    Dollar-quoted defs so embedded quotes/apostrophes need no escaping.
INSERT INTO facet_tag_definitions (id, dim, label, def) VALUES
  ('pseudo-draw',   'mechanical', 'Pseudo-draw',   $def$Banishes/reveals cards from your own deck so you effectively draw or dig (e.g. "banish the top card, you may play it").$def$),
  ('combo-buff',    'mechanical', 'Buffs combo',   $def$Grants a bonus (power/effect) to cards with the combo keyword.$def$),
  ('combo-enabler', 'mechanical', 'Combo enabler', $def$Assembles a combo line by finding/drawing/sequencing combo pieces (tutor, dig, reveal-into, or top-deck ordering) so the chain can be executed — distinct from combo-buff (which pumps combo cards).$def$),
  ('chain-extender','mechanical', 'Chain extender',$def$Keeps the combat chain going — grants go again, or lets you play another attack to continue the chain.$def$),
  ('on-hit-payoff', 'mechanical', 'On-hit payoff', $def$Has a significant effect that triggers only if the attack hits.$def$),
  ('disruption',    'mechanical', 'Disruption',    $def$Attacks the opponent's resources — hand, arsenal, deck, board, or abilities.$def$),
  ('tutor',         'mechanical', 'Tutor',         $def$Searches your deck for a specific card or a card matching criteria.$def$),
  ('recursion',     'mechanical', 'Recursion',     $def$Returns cards from your graveyard or banish zone to hand or deck.$def$),
  ('cost-reduction','mechanical', 'Cost reduction',$def$Reduces the resource cost of a future/next card play — a tempo enabler that lets you do more in a turn.$def$),
  ('evasive',       'mechanical', 'Evasive',       $def$Restricts how the opponent can defend it — can't be blocked by certain cards, or is otherwise hard to defend against (broader than truly unblockable, which is rare).$def$),
  ('name-copy',     'mechanical', 'Name copy',     $def$Takes on another card's name (or copies a card), acting as flexible glue in name-dependent combo lines.$def$),
  ('scaling',       'mechanical', 'Scaling',       $def$Effect grows with a repeatable quantity — copies on the chain, attacks that have hit, cards controlled, etc.$def$),
  ('beats-fatigue', 'strategic',  'Beats fatigue', $def$Helps push lethal through a defensive/fatigue plan — contributes to a single over-the-top turn that exceeds the opponent's per-turn block ceiling (stacked go-again hits, dominate to punch through blocks, damage multipliers, or the setup that assembles it). Usually requires setup, not luck — it is NOT out-grinding them.$def$),
  ('setup',         'strategic',  'Setup',         $def$Committed/invested now for a deferred, conditional payoff — prepares a future card or a specific opportunity (bank arsenal, load graveyard, place a token/state, start a line) rather than immediate impact; often you must wait for the right follow-up.$def$),
  ('top-deck-order','strategic',  'Top-deck order',$def$Arranges cards on TOP of the deck to control near-future draws (the mirror of pitch-stack, which orders the bottom) — beats the random draw to line up a sequence.$def$),
  ('density-dependent','strategic','Density-dependent',$def$Payoff depends on your deck's density of a card type (e.g. reveal/dig effects that want a high combo count) — a deckbuilding constraint and a variance source.$def$),
  ('key-turn',      'strategic',  'Key turn',      $def$One-time-use (usually equipment that destroys itself for a burst) saved and deployed on a single pivotal turn — you pick the moment because you only get one.$def$),
  ('pitch-stack',   'strategic',  'Pitch stack',   $def$Deliberately pitched for resources to send it to the BOTTOM of the deck, so you can deterministically assemble a specific future sequence (often a combo line) instead of relying on random draws.$def$),
  ('gustwave',      'synergy',    'Gustwave (name group)', $def$Cards that check "a card with gustwave in its name" (e.g. Bonds of Ancestry, Retrace the Past). A name-PATTERN group, not a single line.$def$),
  ('vengeance',     'synergy',    'Vengeance (name group)',$def$Cards that check "a card with vengeance in its name" (e.g. Enact Vengeance). Name-pattern group.$def$),
  ('flood-line',    'synergy',    'Flood line',    $def$Finisher: Flood of Force. Leaders: Torrent of Tempo → Rushing River → Flood of Force.$def$),
  ('lord-of-wind-line','synergy', 'Lord of Wind line',$def$Finisher: Lord of Wind (self-recycling loop). Leaders: Surging Strike → Whelming Gustwave → Mugenshi: RELEASE → Lord of Wind. NOT the Hundred Winds package despite "wind".$def$),
  ('dishonor-line', 'synergy',    'Dishonor line', $def$Finisher: Dishonor (ability strip). Leaders: Bonds of Ancestry → Dishonor; also needs Surging Strike + Descendent Gustwave controlled.$def$),
  ('winds-of-eternity-line','synergy','Winds of Eternity line',$def$Finisher: Winds of Eternity. Leaders: Hundred Winds (stack copies) → Winds of Eternity (shuffle them back to recycle).$def$),
  ('break-tide-line','synergy',   'Break Tide line',$def$Finisher: Break Tide (dominate burst). Leaders: Rushing River / Flood of Force → Break Tide.$def$),
  ('combo-package', 'synergy',    'Combo package', $def$General combo-chain piece (plays with combo-keyword cards) when no more-specific line applies.$def$)
ON CONFLICT (id) DO NOTHING;

-- 3. Defensive backfill: any tag already present in card_facet_tags but missing a
--    definition (drift / ad-hoc data) gets a placeholder draft definition so the
--    FK below can't fail. A curator can edit these afterward.
INSERT INTO facet_tag_definitions (id, dim, label, def, draft)
SELECT DISTINCT cft.tag, 'mechanical', cft.tag, '', true
FROM card_facet_tags cft
LEFT JOIN facet_tag_definitions d ON d.id = cft.tag
WHERE d.id IS NULL;

-- 4. Now every card_facet_tags.tag has a definition — add the guard FK.
--    ON DELETE RESTRICT => a tag definition cannot be deleted while assigned.
ALTER TABLE card_facet_tags DROP CONSTRAINT IF EXISTS card_facet_tags_tag_fkey;
ALTER TABLE card_facet_tags
  ADD CONSTRAINT card_facet_tags_tag_fkey
  FOREIGN KEY (tag) REFERENCES facet_tag_definitions(id) ON DELETE RESTRICT;
