// Toast copy for an explicit "Notify on Discord" click. Shared by the binder
// trade sidebar, the mobile trade sheet and the store Trade Opportunities
// tile so every surface reports "pinged" vs "deduped" the same way.

import { TRADE_REQUESTS_CHANNEL_NAME } from './links';
import { TRADE_INTEREST_DEDUPE_WINDOW_MS } from './trade-interest-dedupe';
import { displayUsername } from '@/lib/utils/display-username';

export interface TradeInterestFeedback {
  title: string;
  description: string;
  /** Undefined = default toast. A deduped ping is informational, never destructive. */
  variant?: 'destructive';
}

const DEDUPE_MINUTES = Math.round(TRADE_INTEREST_DEDUPE_WINDOW_MS / 60_000);

export function tradeInterestFeedback(input: {
  notified: boolean;
  recipientUsername: string;
  cardCount: number;
}): TradeInterestFeedback {
  const name = displayUsername(input.recipientUsername);
  const cards = `${input.cardCount} ${input.cardCount === 1 ? 'card' : 'cards'}`;

  if (input.notified) {
    return {
      title: 'Pinged on Discord',
      description: `${name} was tagged in #${TRADE_REQUESTS_CHANNEL_NAME} with your ${cards} — watch for their reply there.`,
    };
  }

  return {
    title: 'Already pinged recently',
    description: `You already pinged ${name} in the last ${DEDUPE_MINUTES} minutes. Give them a moment to reply before pinging again.`,
  };
}
