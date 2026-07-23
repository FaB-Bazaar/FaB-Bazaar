import type { DeckCategory } from '@/lib/services/contracts/IDeckService';

export type QuickAddTarget = { category: DeckCategory; pitch?: 1 | 2 | 3 };

export type QuickAddAction =
  | { kind: 'switchTab'; tab: 'search' }
  | { kind: 'openDialog'; target: QuickAddTarget }
  | { kind: 'blocked' };

export function resolveQuickAddAction(
  isMobile: boolean,
  target: QuickAddTarget,
  canEdit: boolean = true,
): QuickAddAction {
  // Read-only viewers must never be routed anywhere: the mobile 'search' tab is
  // canEdit-gated, so switching to it renders nothing (blank page).
  if (!canEdit) return { kind: 'blocked' };
  if (isMobile) return { kind: 'switchTab', tab: 'search' };
  return { kind: 'openDialog', target };
}
