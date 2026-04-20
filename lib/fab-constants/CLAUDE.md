# lib/fab-constants

Static game/presentation constants for Flesh and Blood. Imported via the barrel at `@/lib/fab-constants` or by sub-module (`@/lib/fab-constants/heroes`, etc.).

## Heroes module (3 files, dependency graph: `heroes-rosters` ← `heroes-meta` ← `heroes`)

### `heroes-rosters.ts` — canonical roster data (leaf)
Pure data + roster-local helpers. Imports nothing from siblings.

- `HERO_INFO` / `YOUNG_HERO_INFO` — canonical lowercase keys; the source of truth for hero class/talent/essence/shortName.
- `HeroInfo` / `HeroEntry` interfaces, `HeroName` / `YoungHeroName` types.
- `getHeroesGroupedByClass`, `getYoungHeroesGroupedByClass`, `getAllClasses` — sorted class-bucketed views for UI pickers.

### `heroes-meta.ts` — external integrations + competitive meta + showcase art
Imports only from `heroes-rosters`.

- `TALISHAR_HERO_IDS` — canonical hero key → Talishar collector number. Used by deck export + `/api/talishar/decks`.
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
