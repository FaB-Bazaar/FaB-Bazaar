/**
 * tradeInterestFeedback() — the toast copy shown after an explicit
 * "Notify on Discord" click (binder trade sidebar, mobile sheet, store
 * Trade Opportunities tile). One helper so all three surfaces say the
 * same thing for "pinged" vs "suppressed by the 15-minute dedupe".
 */

import { describe, it, expect } from 'vitest';
import { tradeInterestFeedback } from './trade-interest-feedback';
import { TRADE_REQUESTS_CHANNEL_NAME } from './links';

describe('tradeInterestFeedback', () => {
  it('describes a fired ping with the recipient, card count and channel', () => {
    const t = tradeInterestFeedback({ notified: true, recipientUsername: 'mattave', cardCount: 3 });
    expect(t.title).toBe('Pinged on Discord');
    expect(t.description).toContain('mattave');
    expect(t.description).toContain('3 cards');
    expect(t.description).toContain(`#${TRADE_REQUESTS_CHANNEL_NAME}`);
    expect(t.variant).toBeUndefined();
  });

  it('singularises one card', () => {
    const t = tradeInterestFeedback({ notified: true, recipientUsername: 'mattave', cardCount: 1 });
    expect(t.description).toContain('1 card ');
    expect(t.description).not.toContain('1 cards');
  });

  it('explains a deduped ping without treating it as an error', () => {
    const t = tradeInterestFeedback({ notified: false, recipientUsername: 'mattave', cardCount: 2 });
    expect(t.title).toBe('Already pinged recently');
    expect(t.description).toContain('mattave');
    expect(t.description).toContain('15 minutes');
    expect(t.variant).toBeUndefined();
  });

  it('strips internal OAuth-provisional prefixes from the recipient name', () => {
    const t = tradeInterestFeedback({ notified: true, recipientUsername: 'dc_johnnygazer', cardCount: 1 });
    expect(t.description).toContain('johnnygazer');
    expect(t.description).not.toContain('dc_');
  });
});
