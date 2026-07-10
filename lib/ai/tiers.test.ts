/**
 * Unit tests for hosted-chat limits policy: the uniform per-user daily
 * message budget, the site-wide daily backstop, and model resolution.
 * Pure functions — no DB, no HTTP.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { LLM_LIMITS, globalDailyLimit, resolveChatModel } from './tiers';

describe('LLM_LIMITS', () => {
  it('gives every user the same 50-message daily budget', () => {
    expect(LLM_LIMITS.dailyMessages).toBe(50);
  });

  it('defines a site-wide daily backstop well above the per-user cap', () => {
    expect(LLM_LIMITS.globalDailyMessages).toBe(2000);
    expect(LLM_LIMITS.globalDailyMessages).toBeGreaterThan(LLM_LIMITS.dailyMessages);
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

describe('resolveChatModel', () => {
  const DEFAULT = 'openai/gpt-oss-120b';

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
