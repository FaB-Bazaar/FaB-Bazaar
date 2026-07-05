/**
 * Unit tests for hosted-chat tier policy: daily message budgets and per-tier
 * model access. Pure functions — no DB, no HTTP.
 */

import { describe, it, expect } from 'vitest';
import { LLM_TIERS, resolveLlmTier, tierAllowsModel } from './tiers';

describe('resolveLlmTier', () => {
  it('puts superadmins on the paid tier', () => {
    expect(resolveLlmTier({ isSuperAdmin: true })).toBe('paid');
    expect(resolveLlmTier({ isSuperAdmin: true, metafySupporterTier: 'free' })).toBe('paid');
  });

  it('puts paid Metafy supporters on the paid tier', () => {
    expect(resolveLlmTier({ isSuperAdmin: false, metafySupporterTier: 'paid' })).toBe('paid');
  });

  it('defaults everyone else to free', () => {
    expect(resolveLlmTier({ isSuperAdmin: false })).toBe('free');
    expect(resolveLlmTier({ isSuperAdmin: false, metafySupporterTier: 'free' })).toBe('free');
    expect(resolveLlmTier({ isSuperAdmin: false, metafySupporterTier: null })).toBe('free');
  });
});

describe('LLM_TIERS', () => {
  it('defines a positive daily message budget for every tier, free below paid', () => {
    expect(LLM_TIERS.free.dailyMessages).toBeGreaterThan(0);
    expect(LLM_TIERS.paid.dailyMessages).toBeGreaterThan(LLM_TIERS.free.dailyMessages);
  });
});

describe('tierAllowsModel', () => {
  it('free tier allows mock and :free-suffixed models only', () => {
    expect(tierAllowsModel('free', 'mock')).toBe(true);
    expect(tierAllowsModel('free', 'openai/gpt-oss-120b:free')).toBe(true);
    expect(tierAllowsModel('free', 'openai/gpt-5-nano')).toBe(false);
    expect(tierAllowsModel('free', 'anthropic/claude-haiku-4.5')).toBe(false);
  });

  it('paid tier allows any allowlisted model', () => {
    expect(tierAllowsModel('paid', 'mock')).toBe(true);
    expect(tierAllowsModel('paid', 'openai/gpt-5-nano')).toBe(true);
    expect(tierAllowsModel('paid', 'anthropic/claude-haiku-4.5')).toBe(true);
  });
});
