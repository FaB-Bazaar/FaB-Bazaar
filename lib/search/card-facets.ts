/**
 * card-facets.ts — SEED DATA for the interpretive card "facet" tag vocabulary.
 *
 * ⚠️ This is no longer the runtime source of truth. The live vocabulary lives in
 * the `facet_tag_definitions` table (created/edited via the /admin/card-facets
 * content manager). This array was the original 26-tag seed, mirrored verbatim
 * into migration 0060's INSERT. It is kept as documentation / a reference for the
 * `add-search-facet` skill — runtime validation reads the DB, not this file.
 *
 * Dimensions:
 *   mechanical — what the card's TEXT does (observable on the card)
 *   strategic  — how the card is USED / what it's good against (not on the card)
 *   synergy    — named packages / themes the card plays with
 */

export type FacetDimension = 'mechanical' | 'strategic' | 'synergy';

export interface FacetTag {
  id: string;
  dim: FacetDimension;
  label: string;
  def: string;
  draft?: boolean;
}

export const FACET_TAGS = [
  // ── Mechanical — what the card's text does ──
  { id: 'pseudo-draw', dim: 'mechanical', label: 'Pseudo-draw',
    def: 'Banishes/reveals cards from your own deck so you effectively draw or dig (e.g. "banish the top card, you may play it").' },
  { id: 'combo-buff', dim: 'mechanical', label: 'Buffs combo',
    def: 'Grants a bonus (power/effect) to cards with the combo keyword.' },
  { id: 'combo-enabler', dim: 'mechanical', label: 'Combo enabler',
    def: 'Assembles a combo line by finding/drawing/sequencing combo pieces (tutor, dig, reveal-into, or top-deck ordering) so the chain can be executed — distinct from combo-buff (which pumps combo cards).' },
  { id: 'chain-extender', dim: 'mechanical', label: 'Chain extender',
    def: 'Keeps the combat chain going — grants go again, or lets you play another attack to continue the chain.' },
  { id: 'on-hit-payoff', dim: 'mechanical', label: 'On-hit payoff',
    def: 'Has a significant effect that triggers only if the attack hits.' },
  { id: 'disruption', dim: 'mechanical', label: 'Disruption',
    def: "Attacks the opponent's resources — hand, arsenal, deck, board, or abilities." },
  { id: 'tutor', dim: 'mechanical', label: 'Tutor',
    def: 'Searches your deck for a specific card or a card matching criteria.' },
  { id: 'recursion', dim: 'mechanical', label: 'Recursion',
    def: 'Returns cards from your graveyard or banish zone to hand or deck.' },
  { id: 'cost-reduction', dim: 'mechanical', label: 'Cost reduction',
    def: 'Reduces the resource cost of a future/next card play — a tempo enabler that lets you do more in a turn.' },
  { id: 'evasive', dim: 'mechanical', label: 'Evasive',
    def: 'Restricts how the opponent can defend it — can\'t be blocked by certain cards, or is otherwise hard to defend against (broader than truly unblockable, which is rare).' },
  { id: 'name-copy', dim: 'mechanical', label: 'Name copy',
    def: 'Takes on another card\'s name (or copies a card), acting as flexible glue in name-dependent combo lines.' },
  { id: 'scaling', dim: 'mechanical', label: 'Scaling',
    def: 'Effect grows with a repeatable quantity — copies on the chain, attacks that have hit, cards controlled, etc.' },

  // ── Strategic / meta — how the card is used (NOT on the card) ──
  { id: 'beats-fatigue', dim: 'strategic', label: 'Beats fatigue',
    def: "Helps push lethal through a defensive/fatigue plan — contributes to a single over-the-top turn that exceeds the opponent's per-turn block ceiling (stacked go-again hits, dominate to punch through blocks, damage multipliers, or the setup that assembles it). Usually requires setup, not luck — it is NOT out-grinding them." },
  { id: 'setup', dim: 'strategic', label: 'Setup',
    def: 'Committed/invested now for a deferred, conditional payoff — prepares a future card or a specific opportunity (bank arsenal, load graveyard, place a token/state, start a line) rather than immediate impact; often you must wait for the right follow-up.' },
  { id: 'top-deck-order', dim: 'strategic', label: 'Top-deck order',
    def: 'Arranges cards on TOP of the deck to control near-future draws (the mirror of pitch-stack, which orders the bottom) — beats the random draw to line up a sequence.' },
  { id: 'density-dependent', dim: 'strategic', label: 'Density-dependent',
    def: 'Payoff depends on your deck\'s density of a card type (e.g. reveal/dig effects that want a high combo count) — a deckbuilding constraint and a variance source.' },
  { id: 'key-turn', dim: 'strategic', label: 'Key turn',
    def: 'One-time-use (usually equipment that destroys itself for a burst) saved and deployed on a single pivotal turn — you pick the moment because you only get one.' },
  { id: 'pitch-stack', dim: 'strategic', label: 'Pitch stack',
    def: 'Deliberately pitched for resources to send it to the BOTTOM of the deck, so you can deterministically assemble a specific future sequence (often a combo line) instead of relying on random draws.' },

  // ── Synergy: name-pattern groups (cards check "a card with X in its name") ──
  { id: 'gustwave', dim: 'synergy', label: 'Gustwave (name group)',
    def: 'Cards that check "a card with gustwave in its name" (e.g. Bonds of Ancestry, Retrace the Past). A name-PATTERN group, not a single line.' },
  { id: 'vengeance', dim: 'synergy', label: 'Vengeance (name group)',
    def: 'Cards that check "a card with vengeance in its name" (e.g. Enact Vengeance). Name-pattern group.' },

  // ── Synergy: combo lines. A `-line` tag is named after the line's FINISHER
  //    (payoff card) and applied to EVERY card that leads to it (incl. the finisher). ──
  { id: 'flood-line', dim: 'synergy', label: 'Flood line',
    def: 'Finisher: Flood of Force. Leaders: Torrent of Tempo → Rushing River → Flood of Force.' },
  { id: 'lord-of-wind-line', dim: 'synergy', label: 'Lord of Wind line',
    def: 'Finisher: Lord of Wind (self-recycling loop). Leaders: Surging Strike → Whelming Gustwave → Mugenshi: RELEASE → Lord of Wind. NOT the Hundred Winds package despite "wind".' },
  { id: 'dishonor-line', dim: 'synergy', label: 'Dishonor line',
    def: 'Finisher: Dishonor (ability strip). Leaders: Bonds of Ancestry → Dishonor; also needs Surging Strike + Descendent Gustwave controlled.' },
  { id: 'winds-of-eternity-line', dim: 'synergy', label: 'Winds of Eternity line',
    def: 'Finisher: Winds of Eternity. Leaders: Hundred Winds (stack copies) → Winds of Eternity (shuffle them back to recycle).' },
  { id: 'break-tide-line', dim: 'synergy', label: 'Break Tide line',
    def: 'Finisher: Break Tide (dominate burst). Leaders: Rushing River / Flood of Force → Break Tide.' },

  { id: 'combo-package', dim: 'synergy', label: 'Combo package',
    def: 'General combo-chain piece (plays with combo-keyword cards) when no more-specific line applies.' },
] as const satisfies readonly FacetTag[];

// NOTE: runtime helpers (isFacetTag / FACET_TAG_IDS / facetsByDim) were removed
// when the vocabulary moved to the facet_tag_definitions table — validate against
// the DB (FacetService), not this seed array.
