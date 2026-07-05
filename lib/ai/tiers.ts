// Hosted-chat tier policy: who gets how many chat turns per day, on which
// models. This is the free/paid boundary design for the hosted AI tier —
// enforcement lives in the fabby-chat route; usage facts live in
// llm_usage_daily (migration 0073). Access itself is gated by canUseFabbyChat
// (lib/ai/fabby-chat-access): superadmins + paid Metafy supporters. This maps
// whoever passed that gate to an LLM tier — both currently resolve to 'paid'.

import type { SupporterTier } from '@/lib/metafy/supporter-tier';

export type LlmTier = 'free' | 'paid';

export interface LlmTierLimits {
  /** Chat turns per UTC day, across all models. Resets at midnight UTC. */
  dailyMessages: number;
}

export const LLM_TIERS: Record<LlmTier, LlmTierLimits> = {
  free: { dailyMessages: 20 },
  paid: { dailyMessages: 200 },
};

export function resolveLlmTier(opts: {
  isSuperAdmin: boolean;
  metafySupporterTier?: SupporterTier | null;
  fabbyChatAccess?: boolean | null;
}): LlmTier {
  // Anyone who can use the chat gets the paid LLM tier — including manual grants,
  // else a comped user would 403 on the paid-only default model.
  return opts.isSuperAdmin || opts.metafySupporterTier === 'paid' || !!opts.fabbyChatAccess
    ? 'paid'
    : 'free';
}

/**
 * Free tier rides only zero-cost models (mock + OpenRouter ':free' variants);
 * paid tier gets everything on the route's allowlist. Applied after the
 * allowlist check — this narrows, never widens.
 */
export function tierAllowsModel(tier: LlmTier, model: string): boolean {
  if (tier === 'paid') return true;
  return model === 'mock' || model.endsWith(':free');
}

/**
 * Which model a chat turn actually runs. Only superadmins choose (model bake-
 * offs); everyone else is pinned to the default (cheapest) model regardless of
 * what the client requested — the UI hides the picker, this is the enforcement.
 * Keyless deployments always run 'mock'.
 */
export function resolveChatModel(opts: {
  hasApiKey: boolean;
  isSuperAdmin: boolean;
  requested: string;
  defaultModel: string;
}): string {
  if (!opts.hasApiKey) return 'mock';
  return opts.isSuperAdmin ? opts.requested : opts.defaultModel;
}
