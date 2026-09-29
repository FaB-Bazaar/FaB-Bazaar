// Mirrors displayUsername() in lib/utils/display-username.ts (the bundle's
// tsconfig keeps web-components/src self-contained): strip the internal
// dc_/gh_ prefix of OAuth-provisional usernames for display.
const displayUsername = (u: string) => (u.startsWith('dc_') || u.startsWith('gh_') ? u.slice(3) : u);

/**
 * "Who has" for the spotlight card: the same for-trade lookup the React
 * WhoHasDropdown makes (`/api/whohas`), flattened to one row per owner binder.
 */

export type WhoHasTarget = { printingId: string } | { cardUniqueId: string };

export interface WhoHasRow {
  /** Rendered username (internal dc_/gh_ prefix stripped). */
  name: string;
  binderName: string;
  count: number;
  href: string;
}

export function whoHasUrl(target: WhoHasTarget, base = ''): string {
  const param = 'printingId' in target
    ? `printingIds=${encodeURIComponent(target.printingId)}`
    : `cardUniqueIds=${encodeURIComponent(target.cardUniqueId)}`;
  return `${base}/api/whohas?${param}&forTradeOnly=true&limit=20`;
}

type Binder = { binder_id?: string; binder_name?: string; total_cards_found?: number };
type Owner = { username?: string; binders?: Binder[] };

export function whoHasRows(response: unknown): WhoHasRow[] {
  const r = response as { success?: boolean; owners?: Owner[] } | null;
  if (!r?.success || !Array.isArray(r.owners)) return [];
  return r.owners.flatMap(owner =>
    (owner.binders ?? [])
      .filter(b => b.binder_id)
      .map(b => ({
        name: displayUsername(owner.username ?? ''),
        binderName: b.binder_name ?? '',
        count: b.total_cards_found ?? 0,
        href: `/binder/${encodeURIComponent(b.binder_id!)}`,
      })),
  );
}
