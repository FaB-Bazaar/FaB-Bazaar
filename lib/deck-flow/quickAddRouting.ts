import type { DeckCategory } from '@/lib/services/contracts/IDeckService';

export type QuickAddTarget = { category: DeckCategory; pitch?: 1 | 2 | 3 };

export type QuickAddAction =
  | { kind: 'switchTab'; tab: 'search' }
  | { kind: 'openDialog'; target: QuickAddTarget };

export function resolveQuickAddAction(
  isMobile: boolean,
  target: QuickAddTarget,
): QuickAddAction {
  if (isMobile) return { kind: 'switchTab', tab: 'search' };
  return { kind: 'openDialog', target };
}
