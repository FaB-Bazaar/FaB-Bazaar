// GENERATED from deck-import-url.md — do not edit by hand.
// Regenerate with: npx tsx scripts/sync-import-url-guide.ts

export const IMPORT_URL_GUIDE = `# Deck Import URL — Integration Guide

FaB Bazaar can create a deck from a plain link. Your site builds a URL, the user
clicks it, FaB Bazaar shows a full preview (hero, equipment, deck, inventory,
warnings), and the deck is created only when the user confirms. Nothing is
written until they click **Import deck**; signed-out users are routed through
sign-in and returned to the same preview.

\`\`\`
https://fabbazaar.app/decks/import?name=…&format=…&hero=…&cards=…&inventory=…
\`\`\`

## Query parameters

| Param | Required | Description |
|---|---|---|
| \`format\` | yes | Deck format. Canonical names or aliases, case-insensitive (see below). |
| \`hero\` | yes | The hero card's id — a card token **without** a pitch suffix, e.g. \`arakni_marionette\`, \`oscilio_constella_intelligence\`. |
| \`cards\` | yes | Comma-separated card tokens, **one entry per physical copy** (\`3× Comet Storm\` = the token three times). Repeating the \`cards\` param itself is also allowed; all values are concatenated. |
| \`inventory\` | no | Sideboard cards, same grammar as \`cards\`. They land in the deck's inventory section (exported to Talishar as the sideboard). |
| \`name\` | no | Deck name. Prefilled into an editable field; defaults to "Imported \\<hero\\> deck". |

Standard URL-encoding applies (\`%2C\` and literal \`,\` are equivalent; spaces in
\`name\`/\`format\` may be \`+\` or \`%20\`).

### Formats

Canonical values: \`Classic Constructed\`, \`Future Classic Constructed\`, \`Silver Age\`,
\`Blitz\`, \`Commoner\`, \`Living Legend\`, \`Limited\`, \`Ultimate Pit Fight\`, \`Casual\`.

Accepted aliases: \`cc\` → Classic Constructed, \`fcc\` → Future Classic Constructed, \`sage\` / \`silver_age\` → Silver
Age, \`ll\` → Living Legend, \`upf\` → Ultimate Pit Fight. Anything else renders a
"missing a valid format" warning and disables the import.

## Card tokens

Two interchangeable spellings are accepted per token:

1. **Talishar card id** (preferred): lowercase \`snake_case\` of the card name
   with the pitch color appended — \`kiss_of_death_red\`,
   \`codex_of_frailty_yellow\`, \`shred_blue\`. Cards without a pitch (equipment,
   weapons, heroes) have no suffix: \`hunters_klaive\`, \`fyendals_spring_tunic\`.
   These are the same ids Talishar uses in-game.
2. **Kebab slug** (FaBrary-style): same tokens with hyphens —
   \`kiss-of-death-red\`, \`hunters-klaive\`. Provided for compatibility with
   existing FaBrary link generators.

Derivation rules, if you generate ids from card names: lowercase; strip
apostrophes, commas, colons and other punctuation; transliterate diacritics
(\`ā\`→\`a\`, \`é\`→\`e\`, …); spaces and hyphens become \`_\`; then append \`_red\` /
\`_yellow\` / \`_blue\` for pitch 1/2/3. The pitch word is appended even when the
name already ends in it (\`Backup Protocol: RED\`, pitch 1 →
\`backup_protocol_red_red\`).

Edge cases to know:

- **Double-faced cards** join their face names with a **double underscore**:
  \`Comet Storm // Shock\` → \`comet_storm__shock_red\`. Only the Talishar-id
  spelling can express this — the kebab form cannot, so use snake_case ids if
  your lists can contain double-faced cards.
- One hardcoded exception upstream: \`Goldfin Harpoon\` → \`goldfin_harpoon_yellow\`.
- If the hero also appears as an entry in \`cards\` (FaBrary links do this), it
  is recognized and skipped — the hero is added from the \`hero\` param.

**Rather than deriving ids, validate them.** The public, unauthenticated
endpoint used by the preview itself accepts up to 500 ids per call:

\`\`\`
POST https://fabbazaar.app/api/cards/by-talishar-id
Content-Type: application/json

{ "ids": ["comet_storm__shock_red", "hunters_klaive"] }
\`\`\`

The response maps each input id to the card (\`displayName\`, \`pitch\`,
\`imageUrl\`, …); ids missing from the map don't resolve and would be skipped at
import time. Integrate this once in CI or at link-generation time and bad
tokens never ship.

## What the user sees / what gets enforced

- Unknown tokens show an amber "couldn't be matched and will be skipped"
  warning listing the exact tokens; the rest of the deck still imports.
- Deck-building rules are enforced server-side at import: hero class/talent
  legality, per-format card legality, the active ban list, and per-card copy
  limits. Cards that violate them fail individually and are reported in the
  result toast — an off-class card doesn't block the rest of the list.
- After confirmation the user lands on the created deck page
  (\`/decks/<publicId>\`). The deck is private by default.

## Practical limits

- Keep URLs under ~2,000 characters (the safe cross-browser floor). A full
  80-card Classic Constructed list in Talishar ids runs ≈1,500–1,800
  characters, so standard decks fit without tricks.
- Card resolution is batched at 500 distinct ids per request — far above any
  legal deck.

## Binder prefill (collection import)

The same card-token grammar also drives the bulk-import page at
\`https://fabbazaar.app/browse\`:

\`\`\`
https://fabbazaar.app/browse?cards=fate_foreseen_red,fate_foreseen_red,kiss_of_death_red&binder=my-trades
\`\`\`

- \`cards\` — identical format to the deck import (one token per copy; Talishar
  ids or kebab slugs). The cards arrive pre-staged in the import list with a
  sensible default printing chosen; the user can swap printings, adjust
  quantities, and commit to a binder or their wants list.
- \`binder\` — optional binder slug to preselect as the destination.
- \`dest\` — optional; \`wants\` marks the link as a wants-list import: the "To
  Wants" action gets the primary styling and the banner directs the user to
  it. Anything else (or omitted) keeps the binder flow as primary. Both
  actions remain available either way.
- **Ownership netting**: for signed-in users the requested quantities are
  reduced by what they already own at the card level — any printing variant in
  any of their binders counts. Fully-covered cards are skipped and listed in a
  summary ("N of M requested copies are already in your binders"). Signed-out
  visitors get the full list staged plus a prompt to sign in for netting.
- Unlike the deck import there is no hero/format — it's a flat card list.

## Examples

Minimal:

\`\`\`
https://fabbazaar.app/decks/import?format=cc&hero=oscilio_constella_intelligence&cards=comet_storm__shock_red,comet_storm__shock_red,comet_storm__shock_red
\`\`\`

Full, with equipment, a mixed-spelling list, an inventory, and a name:

\`\`\`
https://fabbazaar.app/decks/import?name=Storm+Surge&format=Classic+Constructed&hero=oscilio_constella_intelligence&cards=fyendals-spring-tunic,comet_storm__shock_red,comet_storm__shock_red,comet_storm__shock_red,fate_foreseen_red,fate_foreseen_red&inventory=fate_foreseen_red
\`\`\`

Binder prefill — stage a card list into a specific binder, netted against what
the user already owns:

\`\`\`
https://fabbazaar.app/browse?cards=fate_foreseen_red,fate_foreseen_red,kiss_of_death_red&binder=my-trades
\`\`\`

Wants-list import — same page, but the link marks the list as "cards to
acquire", so the Wants action is primary (useful for "missing cards for this
deck" or store buylist links):

\`\`\`
https://fabbazaar.app/browse?cards=kiss_of_death_red,kiss_of_death_red,codex_of_frailty_yellow&dest=wants
\`\`\`
`;
