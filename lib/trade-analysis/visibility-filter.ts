import { Binder } from './types';

/**
 * Filters binders based on visibility settings
 * Uses modern visibility.level system (legacy isPublic field is kept synced but not checked)
 */
export function filterBindersByVisibility(binders: Binder[]): Binder[] {
  return binders.filter(binder => {
    // Check if explicitly disabled for matching
    if (binder.visibility?.allowInMatching === false) {
      return false;
    }

    // Check if set to private
    if (binder.visibility?.level === 'private') {
      return false;
    }

    // Default: include in matching (old binders without visibility are assumed public)
    return true;
  });
}

/**
 * Checks if a specific binder should be visible for trade matching
 * Uses modern visibility.level system (legacy isPublic field is kept synced but not checked)
 */
export function isBinderVisibleForTrading(binder: Binder): boolean {
  // Check if explicitly disabled for matching
  if (binder.visibility?.allowInMatching === false) {
    return false;
  }

  // Check if set to private
  if (binder.visibility?.level === 'private') {
    return false;
  }

  // 'public', 'unlisted', and 'friends' are visible for trading
  // Old binders without visibility are assumed public
  return true;
}
