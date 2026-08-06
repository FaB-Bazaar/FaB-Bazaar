// Unit tests for the landing-page daily movers strip picker (pure logic).
import { describe, expect, test } from 'vitest';
import { formatMoverPct, formatMoverPrice, pickLandingMovers } from './daily-movers-strip';
import type {
  DailyMoverDTO,
  MoversInCollectionDTO,
  SignalType,
} from '@/lib/services/contracts/IDailyMoversService';

function mover(over: Partial<DailyMoverDTO> & { printingId: string; signalType: SignalType }): DailyMoverDTO {
  return {
    rankInSignal: 1,
    displayName: `Card ${over.printingId}`,
    set: 'sea',
    edition: 'N',
    foiling: 'S',
    rarity: 'M',
    imageUrl: null,
    tcgplayerUrl: null,
    pAtSignal: 10,
    refPrice: 8,
    dollarChange: 2,
    pctChange: 25,
    quantity: 1,
    binderId: 'binder-1',
    binderName: 'Main',
    decks: [],
    ...over,
  };
}

function dto(over: Partial<MoversInCollectionDTO>): MoversInCollectionDTO {
  return {
    asOfDate: '2026-08-05',
    totalCount: 0,
    gainers: [],
    decliners: [],
    breakouts: [],
    steadyRisers: [],
    ...over,
  };
}

describe('pickLandingMovers', () => {
  test('returns empty for null/undefined data', () => {
    expect(pickLandingMovers(null)).toEqual([]);
    expect(pickLandingMovers(undefined)).toEqual([]);
  });

  test('interleaves one mover per signal in priority order (gainers, breakouts, steady risers, decliners)', () => {
    const data = dto({
      totalCount: 8,
      gainers: [mover({ printingId: 'g1', signalType: 'top_gainer' }), mover({ printingId: 'g2', signalType: 'top_gainer' })],
      breakouts: [mover({ printingId: 'b1', signalType: 'breakout' })],
      steadyRisers: [mover({ printingId: 's1', signalType: 'steady_riser' })],
      decliners: [mover({ printingId: 'd1', signalType: 'top_decliner', pctChange: -12 })],
    });
    expect(pickLandingMovers(data, 4).map((m) => m.printingId)).toEqual(['g1', 'b1', 's1', 'd1']);
    // Second pass picks up remaining movers once each signal has contributed.
    expect(pickLandingMovers(data, 5).map((m) => m.printingId)).toEqual(['g1', 'b1', 's1', 'd1', 'g2']);
  });

  test('dedupes the same printing appearing in multiple signals or binders', () => {
    const data = dto({
      totalCount: 3,
      gainers: [
        mover({ printingId: 'p1', signalType: 'top_gainer', binderId: 'binder-1' }),
        mover({ printingId: 'p1', signalType: 'top_gainer', binderId: 'binder-2' }),
      ],
      breakouts: [mover({ printingId: 'p1', signalType: 'breakout' })],
    });
    const picked = pickLandingMovers(data, 4);
    expect(picked).toHaveLength(1);
    // First (highest-priority) occurrence wins.
    expect(picked[0].signalType).toBe('top_gainer');
  });

  test('caps at max and maps display fields', () => {
    const data = dto({
      totalCount: 6,
      gainers: [
        mover({ printingId: 'g1', signalType: 'top_gainer', displayName: 'Command and Conquer', pAtSignal: 42.5, pctChange: 12.3, imageUrl: 'https://img/x' }),
        mover({ printingId: 'g2', signalType: 'top_gainer' }),
        mover({ printingId: 'g3', signalType: 'top_gainer' }),
      ],
    });
    const picked = pickLandingMovers(data, 2);
    expect(picked).toHaveLength(2);
    expect(picked[0]).toEqual({
      printingId: 'g1',
      displayName: 'Command and Conquer',
      price: 42.5,
      pctChange: 12.3,
      signalType: 'top_gainer',
      imageUrl: 'https://img/x',
    });
  });
});

describe('formatMoverPrice', () => {
  test('scales decimal places with magnitude (same rules as /daily)', () => {
    expect(formatMoverPrice(123.4)).toBe('$123');
    expect(formatMoverPrice(42.34)).toBe('$42.3');
    expect(formatMoverPrice(3.456)).toBe('$3.46');
  });
  test('em-dashes missing prices', () => {
    expect(formatMoverPrice(null)).toBe('—');
    expect(formatMoverPrice(undefined)).toBe('—');
  });
});

describe('formatMoverPct', () => {
  test('signs positive changes, keeps negative sign, one decimal', () => {
    expect(formatMoverPct(12.34)).toBe('+12.3%');
    expect(formatMoverPct(-8.21)).toBe('-8.2%');
  });
  test('em-dashes missing values', () => {
    expect(formatMoverPct(null)).toBe('—');
  });
});
