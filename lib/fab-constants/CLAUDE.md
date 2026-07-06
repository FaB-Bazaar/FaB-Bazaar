# lib/fab-constants

Static game/presentation constants for Flesh and Blood. Imported via the barrel at `@/lib/fab-constants` or by sub-module (`@/lib/fab-constants/heroes`, etc.).

## Heroes module (3 files, dependency graph: `heroes-rosters` ← `heroes-meta` ← `heroes`)

### `heroes-rosters.ts` — display-only roster + legality fallback
Pure data + roster-local helpers. Imports nothing from siblings.

- `HERO_INFO` / `YOUNG_HERO_INFO` — canonical lowercase keys. **Not** the source of truth for legality — the `cards` table is (see below). Roster is used for display metadata (shortName, nicknames, cardUniqueId for portraits, class-bucketed pickers) and as a fallback for `getHeroInfo` when a hero row hasn't synced yet.
- `HeroInfo` / `HeroEntry` interfaces, `HeroName` / `YoungHeroName` types.
- `getHeroesGroupedByClass`, `getYoungHeroesGroupedByClass`, `getAllClasses` — sorted class-bucketed views for UI pickers.

> **Source of truth for hero legality is the DB, not this file.** `PostgresDeckService.addPrintings` reads `cards.classes`, `cards.talents`, `cards.essences` directly. Pipeline 003 derives essences from the `"essence of X"` keyword on the hero card. Do **not** re-derive talents from `cards.types` against a hardcoded talent list — `revered`/`reviled` (and any future talent) will silently break. Just read `cards.talents` as the pipeline writes it.

### `heroes-meta.ts` — external integrations + competitive meta + showcase art
Imports only from `heroes-rosters`.

- `TALISHAR_HERO_IDS` — lowercase card `display_name` → Talishar hero code. Values are Talishar's canonical printing (its original set), NOT our earliest `collector_number` — Heralds "HER" reprints differ (Brevant = `TCC027`, not `HER102`). Sync from Talishar-FE `src/routes/index/components/filter/constants.ts`. Consumers (`/api/talishar/decks`, deck export, the `/decks` Talishar toggle) resolve the hero from the deck's hero CARD's canonical name, NOT `decks.hero_name` — a young nickname (`victor goldmane`) collides with the adult printing (`HVY048` vs `HVY047`).
- `LIVING_LEGEND_POINTS` + `LIVING_LEGEND_THRESHOLD` + `LIVING_LEGEND_POINTS_UPDATED_AT` + `LIVING_LEGEND_POINTS_SOURCE_LABEL` + `getLivingLegendPoints` / `isLivingLegendGraduated` — leaderboard snapshot updated manually from fabtcg.com. Consumed only by `/kits` today.
- `HERO_MARVEL_PRINTING_IDS` + `getHeroMarvelImageUrl` — cold-foil showcase art for hero portraits on the Starter Kits pages. Keys are adult hero names (never young).

### `heroes.ts` — public entry point
Re-exports everything from `heroes-rosters` and `heroes-meta`, plus owns the lookup/display helpers that depend on both rosters and nicknames.

- `HERO_NICKNAMES` — shorthand → full display name (e.g. `'slippy' → 'Arakni, 5L!p3d 7hRu 7h3 cR4X'`). Used by the search shorthand parser and `toHeroDisplayName`.
- `ResourceLink` interface.
- `getHeroInfo` — fuzzy lookup (full name / nickname / shortName, any casing).
- `normalizeHeroName`, `normalizeClassName` — write-path canonicalization; `normalizeHeroName` returns the lowercase key if recognized, otherwise the trimmed original.
- `toHeroDisplayName` — canonical key → properly-cased name via nickname map, falling back to title-case.
- `getHeroesByFormatDetailed` — segmented `{ adult, young }` roster with display names; lives here (not in meta) to keep the dep graph acyclic since it uses `toHeroDisplayName`.

## Import rules

- **Consumers** keep importing from `@/lib/fab-constants/heroes` or the barrel — the split is invisible.
- **Editing roster data?** `heroes-rosters.ts`. **Updating LL points or Marvel art?** `heroes-meta.ts`. **Adding a lookup helper?** `heroes.ts`.
- **Never** have `heroes-rosters` or `heroes-meta` import from `heroes.ts` — that creates a circular dep since `heroes.ts` re-exports them.

## Contract tests

`heroes.test.ts` pins every public export's presence and spot-checks representative values + helper behavior. Run after any edit to roster data, LL snapshot, or Marvel IDs.
