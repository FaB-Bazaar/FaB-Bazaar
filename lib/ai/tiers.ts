// Hosted-chat tier policy: who gets how many chat turns per day, on which
// models. This is the free/paid boundary design for the hosted AI tier —
// enforcement lives in the fabby-chat route; usage facts live in
// llm_usage_daily (migration 0073). Access is still gated behind the
// superadmin check, so today resolveLlmTier only ever returns 'paid'; when
// non-admin access opens, wire the free/paid split to the user's
// subscription here.

export type LlmTier = 'free' | 'paid';

export interface LlmTierLimits {
  /** Chat turns per UTC day, across all models. Resets at midnight UTC. */
  dailyMessages: number;
}

export const LLM_TIERS: Record<LlmTier, LlmTierLimits> = {
  free: { dailyMessages: 20 },
  paid: { dailyMessages: 200 },
};

export function resolveLlmTier(opts: { isSuperAdmin: boolean }): LlmTier {
  return opts.isSuperAdmin ? 'paid' : 'free';
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
