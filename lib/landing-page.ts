// lib/landing-page.ts — logged-in landing page preference (users.landing_page).
// Consumed by app/page.tsx and /auth/post-login; edited on /profile/edit.

export const LANDING_PAGE_OPTIONS = [
  { value: 'volzar', label: 'Volzar (AI chat)', path: '/volzar' },
  { value: 'collection', label: 'My collection', path: '/collection' },
  { value: 'decks', label: 'My decks', path: '/decks' },
] as const;

export type LandingPage = (typeof LANDING_PAGE_OPTIONS)[number]['value'];

export function isLandingPage(value: unknown): value is LandingPage {
  return LANDING_PAGE_OPTIONS.some((o) => o.value === value);
}

// Unset or unrecognized values fall back to /volzar, the default logged-in home.
export function resolveLandingPath(value: string | null | undefined): string {
  const option = LANDING_PAGE_OPTIONS.find((o) => o.value === value);
  return option ? option.path : '/volzar';
}
