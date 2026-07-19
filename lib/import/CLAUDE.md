# Card Import (CardVault / LSS)

## CardVault API (api.cardvault.fabtcg.com/carddb/api/v1/)

- `advanced-search/?q=<query>` or `?set_code=X&page_size=250&page=N` — trailing slash REQUIRED (301 otherwise); large page sizes honored; paginate via `next`. Collector-code search returns ALL cards sharing the number (DFC promos: HER146 → Kassai AND Tuffnut).
- `card_id/<slug>/` — full card payload, same `{count,next,previous,results}` shape the capture files store. Slug = transliterated lowercase name (`slugifyCardName` in `cardvault-capture.ts`).
- `capture-cardvault.ts` (v2) is a pure API client — no browser. Etiquette everywhere: identified UA, delay+jitter, honor 429 Retry-After, cache permanently.
- Not everything is on CardVault: fab-cube-only tokens (ROS257) and some finishes (LSS023 cold) return "no search results" — that's real absence, not an error.

## import-i18n invariants (learned from the May-2026 twin cohort)

- **Art comes from the LSS FACE** (`art_type`), never blanket-mirrored from the English counterpart — two prints can share a foiling and differ only by art (rainbow regular vs `-EA`). The EN mirror query ranks by face art match.
- **Same-run twin prints** (CardVault "-CC" duplicates: identical collector+finish+art) are deduped via an in-run planned-key set — the DB existence check can't catch them because plans insert after the loop.
- **Face-level lss ids stored**: `lss_print_id` = face UUID, `lss_print_code` = face code (`FR_IAR106-MV_BACK`) — matches cardvault-ingest's back-face convention; EN rows from import-new-set use print-level ids (disjoint, no conflict).
- **`linkForeignFaces()` runs at the end of every import** — mirrors EN DFC face linkage onto foreign rows (`_BACK` codes authoritative, EN-mirror inference for code-less rows, ambiguous rows left alone). Idempotent; also heals legacy rows.
- `importCard` is exported behind an entry guard with an injectable uploader — integration tests live in `import-i18n-hardening.test.ts`.

## Outstanding data debt (2026-07)

- ~254 identical-twin foreign groups (same card, indistinguishable attrs, e.g. APS013 + APS013-CC) remain in the DB pending dedupe — usage validated: no group has both twins referenced. 24 more groups unresolved. Plan artifacts: reconcile-plan.json from the 2026-07-18 session.
- These twin rows are most of the ~600 image-id collision fallbacks (they keep printing_id-keyed images).
