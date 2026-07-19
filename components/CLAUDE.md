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
- Two renderers consume it: `shared/FoilCardImage` (CSS, styling in `app/foil-cards.css`) for grids/carousels, and `deck/HoloCard3D` (WebGL, presenter spotlight — single instance only; browsers cap WebGL contexts at ~8-16). Visual styling is intentionally per-renderer: retuning `foil-cards.css` means retuning the HoloCard3D shader to match.
- Card image CDN (imagedelivery.net) sends `access-control-allow-origin: *` — safe as WebGL textures with `crossOrigin: 'anonymous'`.

## HUD / Overlay Patterns

- **Dormant pill** — `bg-black/40 border border-blue-400/60 backdrop-blur-md` + blue glow shadow, fixed bottom-center
- **Chip overlays** — `bg-gray-950 border border-gray-600 rounded-2xl`, bottom-anchored above pill (`bottom: 76px`)
- **Heatmap backgrounds** — Use inline `rgba(r,g,b, opacity)` style (10%–42% range). Do not use Tailwind opacity modifiers for this — they can't be computed dynamically.
- **Exit animation** — `chordExiting` state + 160ms delay before clearing mode, paired with `chord-chip-exit` CSS class
- **Color groups** — 4 muted groups max (combat/gear/support/special or equivalent). Tints at 20% base, not saturated.
