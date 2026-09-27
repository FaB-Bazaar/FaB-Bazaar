# UI Standards

Project-wide front-end rules. Apply to all interactive components, overlays, and HUD elements.

## WCAG Compliance

- **SC 1.4.1 (Color)** — Never use color as the only differentiator. Always pair with a shape or text cue:
  - Active state → `✓` checkmark + `border-t-[3px]`
  - Zero/unavailable → dashed border
  - Range preview → `~` tilde + `border-t-[3px]`
- **SC 1.4.3 (Contrast)** — `text-gray-300` minimum on dark bg (~7:1). `text-gray-500` fails for small text (~3.9:1).
- **Focus rings** — Every interactive element: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`

## Common Mistakes

- **`opacity-40` (or `opacity-70`) on entire chips/containers** — kills contrast to ~1.5:1. Use per-element color classes instead (e.g. `text-gray-300` + dashed border).
- **`font-mono` for key badges** — I/l/1 look identical. Use `font-sans font-bold` for keyboard key labels.
- **`text-gray-500` for counts/badges** — ~3.9:1, fails WCAG AA for small text. Use `text-gray-300`.
- **`text-yellow-400/500` in light mode** — ~1.9:1/2.9:1 contrast, fails AA. Use `text-yellow-700 dark:text-yellow-400`.
- **`text-[8px]` for tile labels** — below any readable threshold. Minimum `text-xs` even for secondary labels (binder names, prices).

## Font Sizes

- Interactive labels: `text-base` (16px) minimum — content is streamed and viewed at a distance
- Metadata / secondary: `text-sm` (14px) acceptable
- Never `text-xs` (12px) for anything the user needs to act on

## Card Images

- Always render `image_url` (or `getCardImageUrl(card)` from `@/lib/utils`) — image ids derive from printing characteristics, NOT printing_ids; constructed `<CF>/<printingId>/public` URLs 404 (old images deleted 2026-07).

## Foil Rendering

- Foil **policy** lives in `lib/foil.ts` (foiling code → treatment, rainbow inset resolution, art-style derivation). Change it there, never inline — call sites use `artStylesFromPrinting()` + `foilInsetFromValues()`.
- Two renderers consume it: `shared/FoilCardImage` (CSS, styling in `app/foil-cards.css`) for grids/carousels, and `deck/HoloCard3D` (WebGL, presenter spotlight). The CSS renderer is the LOOK reference (user call, 2026-07: cold foil = subtle silver sheen, not a cyan wash) — retuning `foil-cards.css` means retuning the HoloCard3D shader to match.
- `HoloCard3D` keeps renderer/scene/shader in a module singleton that survives unmounts (also satisfies the ~8-16 WebGL context cap). Open = re-attach canvas; never dispose on close — per-open teardown/rebuild caused a visible stall. `warmHoloCard()` pre-builds it; the presenter page calls it on mount.
- `HoloCard3D` at rest must render the raw texture EXACTLY (shader strength = hover only; no idle wander, no entrance boost) — any resting glare makes the reveal over the fallback `<img>` read as a blink, and the img must fade out only AFTER the canvas fade completes or the cross-fade dips visibly.
- Card image CDN (imagedelivery.net) sends `access-control-allow-origin: *` — safe as WebGL textures with `crossOrigin: 'anonymous'`.
- `FoilCardImage`'s tilt/shine is an opt-in per-device preference, OFF by default (2026-09, after "too many animations" feedback): `lib/ui/foil-effects-pref.ts` + the avatar-menu "Card foil effects" switch. Off = a foil printing renders exactly like a non-foil card (no `data-rarity`, no foil layers, no loop).
- Its shimmer rAF loop must stop once the springs settle and restart on pointer move/leave — the old always-on loop wrote ~20 CSS vars per frame for every untouched foil card on screen. jsdom tests: `PointerEvent` drops `clientX`, so dispatch `new MouseEvent('pointermove', …)` or the springs go NaN and never settle.

## Navigation

- Nav items are hand-maintained in THREE places: desktop bar + mobile menu (both `navbar.tsx`) and the <640px tab-bar sheets (`navbar/MobileTabBar.tsx`). Change a label or link in all three — separate copies are how labels drifted.
- Canonical labels (2026-09): top-level plain nouns **Collection / Decks / Stores**; items **Binders**, **My Decks**, **Profile**, **Bulk Import**. `/stores` is the user's FOLLOWED stores ("My Stores"); the directory is `/stores/browse` ("Browse Stores") — desktop used to label `/stores` "Browse Stores".
- Nav e2e: at mobile width "Collection"/"Decks" buttons exist in both the menu and the tab bar → use `.first()`; run nav specs with `--workers=1` (parallel runs time out on the dev server). Known-red and unrelated: `navbar-mobile-tabbar`, `mobile-nav-slim` tab-order test (stale selectors), `playmats` (fixtures missing locally).

## HUD / Overlay Patterns

- **Dormant pill** — `bg-black/40 border border-blue-400/60 backdrop-blur-md`, fixed bottom-center
- **Chip overlays** — `bg-gray-950 border border-gray-600 rounded-2xl`, bottom-anchored above pill (`bottom: 76px`)
- **Heatmap backgrounds** — Use inline `rgba(r,g,b, opacity)` style (10%–42% range). Do not use Tailwind opacity modifiers for this — they can't be computed dynamically.
- **Exit animation** — `chordExiting` state + 160ms delay before clearing mode, paired with `chord-chip-exit` CSS class
- **Color groups** — 4 muted groups max (combat/gear/support/special or equivalent). Tints at 20% base, not saturated.
- **No glow effects** (2026-09 — users find them tacky): no coloured/blurred halo shadows, pulsing glows or `blur-3xl` background blobs. Show state with a border or ring. `lib/ui/no-glow.test.ts` scans `app/` + `components/` and fails on them; tight black text outlines over card art (`drop-shadow-[0_0_2px_…]`) are allowed.
- **Card-details lightbox (`components/cards/CardDetailsLightbox.tsx`) pins the TCGplayer link outside the scroll body** — the panel is `flex-col` with a `min-h-0 flex-1 overflow-y-auto` body and the purchase link as a `shrink-0` footer, so it is visible however many printings a card has (it used to be the last scroll-area child and vanished on 4+ printing rows). Anything appended to the panel goes INSIDE the body div, above the footer. Double-faced cards render two faces beside the 400px panel inside the 92vw dialog, so their face height is additionally capped by `calc((92vw-424px)/2*88/63)` — a wider panel or a bigger gap must update that constant or the panel gets squeezed again (pinned in `e2e/regression/card-lightbox-pinned-purchase-link.spec.ts`).
