// lib/scan/scan-access.test.ts — who may use the card scanner. Pure, client-safe.
import { describe, it, expect } from 'vitest';
import { canUseScanner, canUseScannerUnder, SCAN_ROLLOUT } from './scan-access';

describe('canUseScannerUnder', () => {
  it('denies signed-out visitors under every rollout', () => {
    expect(canUseScannerUnder('superadmin', null)).toBe(false);
    expect(canUseScannerUnder('everyone', null)).toBe(false);
    expect(canUseScannerUnder('everyone', undefined)).toBe(false);
  });
  it('superadmin rollout: only superadmins', () => {
    expect(canUseScannerUnder('superadmin', { isSuperAdmin: true })).toBe(true);
    expect(canUseScannerUnder('superadmin', { isSuperAdmin: false })).toBe(false);
    expect(canUseScannerUnder('superadmin', {})).toBe(false);
  });
  it('everyone rollout: any signed-in user', () => {
    expect(canUseScannerUnder('everyone', {})).toBe(true);
    expect(canUseScannerUnder('everyone', { isSuperAdmin: false })).toBe(true);
  });
});

describe('canUseScanner (current rollout)', () => {
  // Flip-time: change SCAN_ROLLOUT to 'everyone' and this expectation.
  it('is open to every signed-in user (signed out never)', () => {
    expect(SCAN_ROLLOUT).toBe('everyone');
    expect(canUseScanner({ isSuperAdmin: false })).toBe(true);
    expect(canUseScanner({ isSuperAdmin: true })).toBe(true);
    expect(canUseScanner(null)).toBe(false);
  });
});
