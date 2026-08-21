// lib/landing-page.ts — logged-in landing page preference (users.landing_page).
// Consumed by app/page.tsx and /auth/post-login; edited on /profile/edit and
// the /profile Settings tab.

export const LANDING_PAGE_OPTIONS = [
  { value: 'volzar', label: 'Volzar (AI chat)', path: '/volzar' },
  { value: 'collection', label: 'My collection', path: '/collection' },
  { value: 'decks', label: 'My decks', path: '/decks' },
  { value: 'opt', label: 'Card search (/opt)', path: '/opt' },
  { value: 'daily', label: 'Daily movers', path: '/daily' },
] as const;

export type LandingPage = (typeof LANDING_PAGE_OPTIONS)[number]['value'];

// The default logged-in home for users with no saved preference. The forms
// hide this value from their explicit option lists (it's the "" default row).
// History: volzar → opt (2026-08) → daily (2026-08-21). An explicit saved
// preference is never affected by a default flip — only NULL/unknown values
// resolve here.
export const DEFAULT_LANDING_PAGE: LandingPage = 'daily';

// Label for the forms' "" (automatic/default) row — derived so it can't
// drift from DEFAULT_LANDING_PAGE.
export const DEFAULT_LANDING_PAGE_LABEL = `Default — ${
  LANDING_PAGE_OPTIONS.find((o) => o.value === DEFAULT_LANDING_PAGE)!.label
}`;

export function isLandingPage(value: unknown): value is LandingPage {
  return LANDING_PAGE_OPTIONS.some((o) => o.value === value);
}

// Unset or unrecognized values fall back to the default logged-in home.
export function resolveLandingPath(value: string | null | undefined): string {
  const option = LANDING_PAGE_OPTIONS.find((o) => o.value === value);
  return (option ?? LANDING_PAGE_OPTIONS.find((o) => o.value === DEFAULT_LANDING_PAGE)!).path;
}
