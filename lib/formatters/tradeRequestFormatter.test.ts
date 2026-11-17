import { describe, it, expect } from 'vitest';
import { formatTradeRequestForDiscord, type TradeRequestCard } from './tradeRequestFormatter';

const card = (printingDetails: TradeRequestCard['printingDetails'], extra: Partial<TradeRequestCard> = {}): TradeRequestCard => ({
  name: 'Authority of Ataya', quantity: 1, maxQuantity: 1, priority: 'medium', printingDetails, ...extra,
});
const format = (cards: TradeRequestCard[]) =>
  formatTradeRequestForDiscord({ recipientUsername: 'x', message: '', tradeType: 'in-person', cards });

describe('formatTradeRequestForDiscord', () => {
  it('names the exact printing by collector number instead of the set code', () => {
    expect(format([card({ set_id: 'sup', collector_number: 'SUP000', rarity: 'F', foiling: 'R', tcg_low: 268.12 })]))
      .toBe('1x Authority of Ataya - $268.12 - SUP000 (Fabled, RF)');
  });

  it('uppercases a lowercase collector number', () => {
    expect(format([card({ set_id: 'iar', collector_number: 'iar228', rarity: 'M', foiling: 'S', tcg_low: 54 })]))
      .toBe('1x Authority of Ataya - $54.00 - IAR228 (Majestic, NF)');
  });

  it('falls back to the uppercased set code when there is no collector number', () => {
    expect(format([card({ set_id: 'anq', rarity: 'M', foiling: 'S', tcg_low: 12.02 })]))
      .toBe('1x Authority of Ataya - $12.02 - ANQ (Majestic, NF)');
  });
});
