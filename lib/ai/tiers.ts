// Hosted-chat limits policy: how many chat turns per day, on which model.
// Volzar is standard for all signed-in users (access gate:
// lib/ai/volzar-access), so cost control lives entirely here:
//   • one uniform per-user daily budget (everyone runs the cheapest model,
//     ~$0.002/turn at current gpt-oss-120b prices),
//   • a site-wide daily backstop that bounds worst-case spend even under
//     mass abuse or a signup flood,
//   • plus the per-user 30-requests/hour burst limit in the route.
// Enforcement lives in the volzar route; usage facts live in llm_usage_daily
// (migration 0073). Superadmins are exempt from both daily caps (operator
// accounts: model bake-offs, and the person diagnosing a tripped backstop
// must not be locked out by it).

export interface LlmLimits {
  /** Chat turns per user per UTC day, across all models. Resets midnight UTC. */
  dailyMessages: number;
  /** Daily budget for manual volzar_access grants (see dailyLimitFor). */
  boostedDailyMessages: number;
  /** Chat turns per UTC day across ALL users — runaway-cost insurance. */
  globalDailyMessages: number;
}

export const LLM_LIMITS: LlmLimits = {
  dailyMessages: 50,
  boostedDailyMessages: 200,
  globalDailyMessages: 2000,
};

/**
 * Per-user daily budget. Uniform for everyone — supporters included, by
 * design — EXCEPT manual `users.volzar_access` grants (the /admin/user-access
 * toggle): that's the "contact mistercakes on Discord" escalation lever the
 * quota-exceeded message points at.
 */
export function dailyLimitFor(flags: { volzarAccess?: boolean | null } | null | undefined): number {
  return flags?.volzarAccess ? LLM_LIMITS.boostedDailyMessages : LLM_LIMITS.dailyMessages;
}

/**
 * Site-wide daily cap, overridable via VOLZAR_GLOBAL_DAILY_LIMIT for incident
 * response (throttle without a deploy). Garbage values fall back to policy.
 */
export function globalDailyLimit(): number {
  const raw = Number(process.env.VOLZAR_GLOBAL_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? raw : LLM_LIMITS.globalDailyMessages;
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
