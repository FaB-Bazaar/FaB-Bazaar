import { describe, it, expect, afterEach, vi } from 'vitest';
import robots from './robots';

afterEach(() => vi.unstubAllEnvs());

describe('robots.txt policy', () => {
  it('production blocks AI crawlers (training AND retrieval) but keeps search engines', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];

    const blockedAgents = rules
      .filter(rule => rule.disallow === '/')
      .flatMap(rule => (Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent]));
    for (const ua of ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended', 'PerplexityBot', 'Bytespider', 'meta-externalagent']) {
      expect(blockedAgents, `${ua} must be fully disallowed`).toContain(ua);
    }

    // Traditional search engines ride the * rule: allowed except private paths.
    const star = rules.find(rule => rule.userAgent === '*');
    expect(star?.allow).toBe('/');
    expect(star?.disallow).toEqual(expect.arrayContaining(['/admin/', '/api/', '/auth/', '/debug/']));
    expect(r.sitemap).toBe('https://fabbazaar.app/sitemap.xml');
  });

  it('development allows everything (local scanning / Playwright against dev server)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    expect(rules).toHaveLength(1);
    expect(rules[0].userAgent).toBe('*');
    expect(rules[0].allow).toBe('/');
    expect(rules[0].disallow).toBeUndefined();
  });
});
