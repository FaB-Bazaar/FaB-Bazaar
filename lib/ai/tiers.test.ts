/**
 * Unit tests for hosted-chat limits policy: the uniform per-user daily
 * message budget, the site-wide daily backstop, and model resolution.
 * Pure functions — no DB, no HTTP.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { LLM_LIMITS, globalDailyLimit, dailyLimitFor, resolveChatModel, DEFAULT_CHAT_MODEL, SUPERADMIN_CHAT_MODEL, defaultChatModelFor } from './tiers';

describe('LLM_LIMITS', () => {
  it('gives every user the same 50-message daily budget', () => {
    expect(LLM_LIMITS.dailyMessages).toBe(50);
  });

  it('defines a site-wide daily backstop well above the per-user cap', () => {
    expect(LLM_LIMITS.globalDailyMessages).toBe(2000);
    expect(LLM_LIMITS.globalDailyMessages).toBeGreaterThan(LLM_LIMITS.dailyMessages);
  });
});

describe('dailyLimitFor', () => {
  it('boosts a manual volzar_access grant — the "contact mistercakes" lever', () => {
    expect(dailyLimitFor({ volzarAccess: true })).toBe(LLM_LIMITS.boostedDailyMessages);
    expect(LLM_LIMITS.boostedDailyMessages).toBeGreaterThan(LLM_LIMITS.dailyMessages);
  });

  it('everyone else gets the standard budget — supporters included (uniform by design)', () => {
    expect(dailyLimitFor({})).toBe(LLM_LIMITS.dailyMessages);
    expect(dailyLimitFor({ metafySupporterTier: 'paid' })).toBe(LLM_LIMITS.dailyMessages);
    expect(dailyLimitFor(undefined)).toBe(LLM_LIMITS.dailyMessages);
    expect(dailyLimitFor(null)).toBe(LLM_LIMITS.dailyMessages);
  });
});

describe('globalDailyLimit', () => {
  afterEach(() => {
    delete process.env.VOLZAR_GLOBAL_DAILY_LIMIT;
  });

  it('defaults to the policy constant', () => {
    expect(globalDailyLimit()).toBe(LLM_LIMITS.globalDailyMessages);
  });

  it('is env-overridable for incident response without a deploy', () => {
    process.env.VOLZAR_GLOBAL_DAILY_LIMIT = '100';
    expect(globalDailyLimit()).toBe(100);
  });

  it('ignores garbage env values', () => {
    process.env.VOLZAR_GLOBAL_DAILY_LIMIT = 'lots';
    expect(globalDailyLimit()).toBe(LLM_LIMITS.globalDailyMessages);
  });
});

describe('chat model defaults', () => {
  it('pins everyone to the cheapest paid model and superadmins to the stealth bake-off model', () => {
    expect(DEFAULT_CHAT_MODEL).toBe('openai/gpt-oss-120b');
    expect(SUPERADMIN_CHAT_MODEL).toBe('stealth/ox-alpha');
    expect(defaultChatModelFor(false)).toBe(DEFAULT_CHAT_MODEL);
    expect(defaultChatModelFor(true)).toBe(SUPERADMIN_CHAT_MODEL);
  });
});

describe('resolveChatModel', () => {
  const DEFAULT = 'openai/gpt-oss-120b';

  it('runs the superadmin default when a superadmin sends no model', () => {
    expect(resolveChatModel({ hasApiKey: true, isSuperAdmin: true, requested: undefined, defaultModel: DEFAULT }))
      .toBe(SUPERADMIN_CHAT_MODEL);
  });

  it('still pins a non-superadmin to the default when they send no model', () => {
    expect(resolveChatModel({ hasApiKey: true, isSuperAdmin: false, requested: undefined, defaultModel: DEFAULT }))
      .toBe(DEFAULT);
  });

  it('lets a superadmin run whatever they requested', () => {
    expect(resolveChatModel({ hasApiKey: true, isSuperAdmin: true, requested: 'anthropic/claude-haiku-4.5', defaultModel: DEFAULT }))
      .toBe('anthropic/claude-haiku-4.5');
  });

  it('pins a non-superadmin to the default model, ignoring their request', () => {
    expect(resolveChatModel({ hasApiKey: true, isSuperAdmin: false, requested: 'anthropic/claude-haiku-4.5', defaultModel: DEFAULT }))
      .toBe(DEFAULT);
  });

  it('runs mock for keyless deployments regardless of role or request', () => {
    expect(resolveChatModel({ hasApiKey: false, isSuperAdmin: true, requested: 'anthropic/claude-haiku-4.5', defaultModel: DEFAULT })).toBe('mock');
    expect(resolveChatModel({ hasApiKey: false, isSuperAdmin: false, requested: DEFAULT, defaultModel: DEFAULT })).toBe('mock');
  });
});
