// Deep links from the mobile ⚡ Instant tab (components/navbar/MobileTabBar)
// into /volzar: `?action=<id>` auto-runs that instant action on arrival
// (VolzarChat consumes it one-shot, like the Bridge B /opt handoff).
// A tiny shared module so the tab-bar hrefs and VolzarChat's parser can't
// drift — and so unknown strings are never auto-run.

export const INSTANT_LINK_ACTIONS = ['binders', 'wants', 'decks', 'results', 'to-beat', 'daily'] as const;
export type InstantLinkAction = (typeof INSTANT_LINK_ACTIONS)[number];

export function parseInstantActionParam(search: string): InstantLinkAction | null {
  const value = new URLSearchParams(search).get('action');
  return value && (INSTANT_LINK_ACTIONS as readonly string[]).includes(value)
    ? (value as InstantLinkAction)
    : null;
}

export function volzarInstantHref(action: InstantLinkAction): string {
  return `/volzar?action=${action}`;
}
