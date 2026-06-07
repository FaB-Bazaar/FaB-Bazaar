import { describe, it, expect } from 'vitest';
import { FABShorthandParser as McpParser } from './fab-shorthand-parser';
import { FABShorthandParser as SearchParser } from './search/fab-shorthand-parser';

// Both parsers share the same `format:` token handling and historically drifted
// out of sync. These tests pin the format aliases on BOTH so they can't diverge.
describe.each([
  ['mcp (lib/fab-shorthand-parser)', new McpParser()],
  ['search (lib/search/fab-shorthand-parser)', new SearchParser()],
])('FABShorthandParser format parsing — %s', (_label, parser) => {
  it('parses the existing formats', () => {
    expect(parser.parseQuery('format:cc').filters.format).toBe('cc');
    expect(parser.parseQuery('format:blitz').filters.format).toBe('blitz');
    expect(parser.parseQuery('format:commoner').filters.format).toBe('commoner');
    expect(parser.parseQuery('format:ll').filters.format).toBe('ll');
  });

  it('parses silver_age (previously dropped)', () => {
    expect(parser.parseQuery('format:silver_age').filters.format).toBe('silver_age');
  });

  it('normalizes the "sage" alias to silver_age', () => {
    expect(parser.parseQuery('format:sage').filters.format).toBe('silver_age');
  });
});

// `k:` is a documented alias for `keyword:` — pin it on BOTH parsers.
describe.each([
  ['mcp (lib/fab-shorthand-parser)', new McpParser()],
  ['search (lib/search/fab-shorthand-parser)', new SearchParser()],
])('FABShorthandParser keyword aliases — %s', (_label, parser) => {
  it('parses keyword:dominate', () => {
    expect(parser.parseQuery('keyword:dominate').filters.keywords).toContain('dominate');
  });

  it('parses the k: alias', () => {
    expect(parser.parseQuery('k:dominate').filters.keywords).toContain('dominate');
  });

  it('parses k: with a quoted multi-word keyword', () => {
    expect(parser.parseQuery('k:"go again"').filters.keywords).toContain('go again');
  });

  it('k: combines with other tokens (k:dominate t:attack)', () => {
    const f = parser.parseQuery('k:dominate t:attack').filters;
    expect(f.keywords).toContain('dominate');
    expect(f.types).toContain('attack');
  });
});
