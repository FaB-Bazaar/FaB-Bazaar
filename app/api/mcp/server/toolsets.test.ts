/**
 * Unit tests for MCP toolset filtering (?toolset=lite).
 *
 * The lite toolset trims tools/list for context-constrained clients (local
 * models via LM Studio etc.): the full 37-tool catalog costs ~22k tokens of
 * schema per chat, more than a 16k local context. Lite advertises the 12
 * collector tools (~9k tokens). Filtering applies to tools/list ONLY —
 * tools/call still executes any tool (context-size feature, not access
 * control; real authorization is OAuth scopes + per-tool role checks).
 */

import { describe, it, expect } from 'vitest';
import { LITE_TOOLSET, filterToolsForToolset, resolveToolset } from './toolsets';

const tool = (name: string) => ({ name, description: 'd', inputSchema: {} });

const CATALOG = [
  'read_mandatory_constants_first',
  'search_printings',
  'list_binders',
  'get_binder',
  'add_to_binder',
  'remove_from_binder',
  'get_wants',
  'add_to_wants',
  'remove_from_wants',
  'who_has',
  'list_decks',
  'get_deck',
  'create_deck',
  'add_cards_to_deck',
  'save_deck_matchup',
  'add_article_section',
  'create_curated_list',
  'manage_card_restriction',
].map(tool);

describe('resolveToolset', () => {
  it('resolves lite from a request URL query param', () => {
    expect(resolveToolset('https://fabbazaar.app/api/mcp/server?toolset=lite')).toBe('lite');
  });

  it('defaults to full with no param', () => {
    expect(resolveToolset('https://fabbazaar.app/api/mcp/server')).toBe('full');
  });

  it('defaults to full for unknown values (forgiving, never breaks a client)', () => {
    expect(resolveToolset('https://fabbazaar.app/api/mcp/server?toolset=mini')).toBe('full');
    expect(resolveToolset('https://fabbazaar.app/api/mcp/server?toolset=')).toBe('full');
  });
});

describe('filterToolsForToolset', () => {
  it('full returns the exact same array (Claude path untouched)', () => {
    const result = filterToolsForToolset(CATALOG, 'full');
    expect(result).toBe(CATALOG); // identity, not a copy — zero behavioral diff
  });

  it('lite returns exactly the 12 collector tools, order preserved', () => {
    const result = filterToolsForToolset(CATALOG, 'lite');
    expect(result.map(t => t.name)).toEqual([
      'read_mandatory_constants_first',
      'search_printings',
      'list_binders',
      'get_binder',
      'add_to_binder',
      'remove_from_binder',
      'get_wants',
      'add_to_wants',
      'remove_from_wants',
      'who_has',
      'list_decks',
      'get_deck',
    ]);
  });

  it('lite excludes write-heavy and admin tools', () => {
    const names = filterToolsForToolset(CATALOG, 'lite').map(t => t.name);
    for (const excluded of ['create_deck', 'add_cards_to_deck', 'save_deck_matchup', 'add_article_section', 'create_curated_list', 'manage_card_restriction']) {
      expect(names).not.toContain(excluded);
    }
  });

  it('every lite tool name exists in the full catalog (no dead entries)', () => {
    const catalogNames = new Set(CATALOG.map(t => t.name));
    for (const name of LITE_TOOLSET) {
      expect(catalogNames.has(name), `${name} missing from catalog`).toBe(true);
    }
  });
});
