import { describe, it, expect } from 'vitest';
import { planLegalityBackfill, type DbCardRow, type FeedLegality } from './legality-plan';

const allFalse = {
  cc_legal: false, silver_age_legal: false, blitz_legal: false,
  commoner_legal: false, ll_legal: false,
};

function dbRow(over: Partial<DbCardRow> = {}): DbCardRow {
  return {
    cardUniqueId: 'card-1',
    name: 'below the belt',
    pitch: 1,
    fabCubeCardId: 'feed-1',
    flags: { ...allFalse },
    ...over,
  };
}

function feedCard(over: Partial<FeedLegality> = {}): FeedLegality {
  return {
    unique_id: 'feed-1',
    name: 'Below the Belt',
    ...allFalse,
    ...over,
  };
}

describe('planLegalityBackfill', () => {
  it('grants flags the feed marks legal', () => {
    const plan = planLegalityBackfill(
      [dbRow()],
      [feedCard({ cc_legal: true, silver_age_legal: true, blitz_legal: true })],
    );

    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].cardUniqueId).toBe('card-1');
    expect(plan.updates[0].flags).toEqual({
      cc_legal: true, silver_age_legal: true, blitz_legal: true,
      commoner_legal: false, ll_legal: false,
    });
    expect(plan.updates[0].grants).toEqual(['cc_legal', 'silver_age_legal', 'blitz_legal']);
    expect(plan.updates[0].revocations).toEqual([]);
    expect(plan.revocationCount).toBe(0);
  });

  it('reports a revocation separately when the feed is stricter than the DB', () => {
    const plan = planLegalityBackfill(
      [dbRow({ flags: { ...allFalse, cc_legal: true, commoner_legal: true } })],
      [feedCard({ cc_legal: true })],
    );

    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].grants).toEqual([]);
    expect(plan.updates[0].revocations).toEqual(['commoner_legal']);
    expect(plan.revocationCount).toBe(1);
  });

  it('leaves already-correct cards out of the plan', () => {
    const plan = planLegalityBackfill(
      [dbRow({ flags: { ...allFalse, cc_legal: true } })],
      [feedCard({ cc_legal: true })],
    );

    expect(plan.updates).toEqual([]);
    expect(plan.unchanged).toBe(1);
  });

  it('never guesses: an unanchored card is reported, not matched by name', () => {
    const plan = planLegalityBackfill(
      [dbRow({ fabCubeCardId: null })],
      [feedCard({ cc_legal: true })],
    );

    expect(plan.updates).toEqual([]);
    expect(plan.unmatched).toHaveLength(1);
    expect(plan.unmatched[0].reason).toBe('no-anchor');
  });

  it('reports an anchored card the feed no longer carries', () => {
    const plan = planLegalityBackfill([dbRow({ fabCubeCardId: 'feed-gone' })], [feedCard()]);

    expect(plan.updates).toEqual([]);
    expect(plan.unmatched).toHaveLength(1);
    expect(plan.unmatched[0].reason).toBe('not-in-feed');
  });
});
