import type { TradeMatchMode } from './allocate-wants';

type GroupableCard = {
  binderId: string;
  binderName: string;
  binderViewable: boolean;
  tcgLow?: number | null;
  quantity: number;
};

export interface TradeBinderGroup<T> {
  binderId: string;
  binderName: string;
  binderViewable: boolean;
  /** Sum of tcg_low × quantity (unpriced = 0). */
  totalValue: number;
  cards: T[];
}

/** Group 1:1 trade matches by binder, most valuable binder first. */
export function groupTradeCardsByBinder<T extends GroupableCard>(cards: T[]): TradeBinderGroup<T>[] {
  const groups = new Map<string, TradeBinderGroup<T>>();
  for (const card of cards) {
    let group = groups.get(card.binderId);
    if (!group) {
      group = {
        binderId: card.binderId,
        binderName: card.binderName,
        binderViewable: card.binderViewable,
        totalValue: 0,
        cards: [],
      };
      groups.set(card.binderId, group);
    }
    group.cards.push(card);
    group.totalValue += (card.tcgLow ?? 0) * card.quantity;
  }
  return [...groups.values()].sort((a, b) => b.totalValue - a.totalValue);
}

/** Binder link that fills the viewer's trade request from their wants on arrival. */
export function tradeBinderHref(binderId: string, mode: TradeMatchMode): string {
  return `/binder/${binderId}?trade=wants${mode === 'loose' ? '&match=loose' : ''}`;
}
