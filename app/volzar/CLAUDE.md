# Volzar Chat UI

## Rendering rules

- **Every card list renders through `CardTable`** (VolzarChat.tsx) — binder/wants (flat `tableRows`), deck drills / hero kits / comparisons / archetype consensus (`tableSections`), and AI search results. New card-shaped results must emit CardRow rows, not text lines. Columns are adaptive (only rendered when some row has data); a tail note column (`CardRow.note`) gets its header via `QuickActionResult.tableNoteHeader` (e.g. "Decks", "Owned").
- **Table thumbnails need `max-w-none`** — the global `img{max-width:100%}` reset lets auto table layout collapse the `w-9` image cell to 0-width whenever a sibling column demands `w-full`. Symptom: images "never load" but their naturalWidth is fine.
- **Model markdown** gets `{p}/{d}/{r}/{h}/{i}` glyphs + literal `<br>` → line break via `rehypeRuleGlyphs` (rule-glyphs.ts). rehype-raw is deliberately OFF — raw HTML renders as text unless that plugin converts it.

## Card hover tags (linkify)

- Card names in replies hover-link ONLY if a tool's STRUCTURED payload carried them: `harvestCardsFromStructured` reads `results[].printings`, top-level `cards[]`, and `deck.*`. The MCP server route must place the payload in `structuredContent` — spreading `...result` into the JSON-RPC result is NOT enough (the browser bridge reads only `structuredContent`). `get_results` is the reference: it emits `cards[]` (name + printing_id + image_url).

## Behaviors

- Auto-scroll keys on `items[]` — anything that grows a card IN PLACE (e.g. the matchup panel) needs its own scroll effect (see the matchupPanels effect).
- Instant pickers (Decks to beat / archetype / kit) are mutually exclusive and close when their action runs — keep new pickers consistent.
- `fetchToBeatHeroes` PAGINATES: `/api/decks/community` clamps limit to 50/page and the featured pool is 100+, so a single page silently drops heroes from the dropdown.
- Matchup swap-row thumbnails come from the deck card's `tableSections` via `buildSwapLookup` — the deck drill must keep its Inventory section or side-in enrichment silently degrades to name-only rows.
- **Add-card split buttons** (My binders tri-button: truncated target-binder-name segment picks via dropdown, + adds to it; My wants plus) open the shared `CardSearchDialog`. The dialog closes itself in the SAME tick as `onSelectCard`, so added-card labels are recorded optimistically before the POST resolves; `flushAddDialog` folds them into one data card + one pending-context entry on close. Runners (`addSearchSelectionToBinder`/`...ToWants`) pass `forTrade` through verbatim — no `?? true` coercion.
- "Swap printing" in the rail reuses the deck page's `ViewPrintingsDialog`, which fetches by `card_unique_id` — resolve it from the previewed `printingId` via `/api/search/core?printingId=` first. Preview-only/ephemeral: it swaps the rail's in-memory preview and writes nothing. Do NOT wire `/api/decks/[deckId]/printings/swap` — that persists a deck copy; chat has none.
