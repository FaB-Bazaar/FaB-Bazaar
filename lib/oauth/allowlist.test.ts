import { describe, it, expect } from 'vitest';
import { accessKindOfScope, isApproved, normalizeAllowedHost, redirectHost, type AllowlistEntry } from './allowlist';

const entries: AllowlistEntry[] = [
  { kind: 'redirect_host', value: 'claude.ai', access: 'full' },
  { kind: 'redirect_host', value: 'localhost', access: 'full' },
  { kind: 'redirect_host', value: '127.0.0.1', access: 'full' },
  { kind: 'client_id', value: 'mcp_cintari', access: 'partner' },
  { kind: 'redirect_host', value: 'both.example', access: 'all' },
];

const app = (clientId: string, ...redirectUris: string[]) => ({ clientId, redirectUris });

describe('isApproved', () => {
  it('approves an AI host for full access, not for partner access', () => {
    expect(isApproved(app('mcp_x', 'https://claude.ai/api/mcp/auth_callback'), 'full', entries)).toBe(true);
    expect(isApproved(app('mcp_x', 'https://claude.ai/api/mcp/auth_callback'), 'partner', entries)).toBe(false);
  });

  it('approves loopback on any port (a code sent there stays on the player\'s machine)', () => {
    expect(isApproved(app('mcp_x', 'http://localhost:58057/callback'), 'full', entries)).toBe(true);
    expect(isApproved(app('mcp_x', 'http://127.0.0.1:19876/cb'), 'full', entries)).toBe(true);
  });

  it('matches the host exactly — no subdomains, no look-alikes', () => {
    for (const uri of ['https://x.claude.ai/cb', 'https://claude.ai.evil.com/cb', 'https://evilclaude.ai/cb', 'https://evil.com/claude.ai']) {
      expect(isApproved(app('mcp_x', uri), 'full', entries)).toBe(false);
    }
  });

  it('needs EVERY return address allowed, so an app cannot hide a bad one beside a good one', () => {
    expect(isApproved(app('mcp_x', 'https://claude.ai/cb', 'https://evil.com/cb'), 'full', entries)).toBe(false);
  });

  it('approves one specific app by client id, whatever its return address', () => {
    expect(isApproved(app('mcp_cintari', 'https://cintari.example/cb'), 'partner', entries)).toBe(true);
    expect(isApproved(app('mcp_cintari', 'https://cintari.example/cb'), 'full', entries)).toBe(false);
    expect(isApproved(app('mcp_other', 'https://cintari.example/cb'), 'partner', entries)).toBe(false);
  });

  it("an 'all' entry approves both kinds", () => {
    expect(isApproved(app('mcp_x', 'https://both.example/cb'), 'full', entries)).toBe(true);
    expect(isApproved(app('mcp_x', 'https://both.example/cb'), 'partner', entries)).toBe(true);
  });

  it('refuses an app with no return address and anything unparseable', () => {
    expect(isApproved(app('mcp_x'), 'full', entries)).toBe(false);
    expect(isApproved(app('mcp_x', 'not a url'), 'full', entries)).toBe(false);
  });

  it('refuses everything when the list is empty', () => {
    expect(isApproved(app('mcp_x', 'https://claude.ai/cb'), 'full', [])).toBe(false);
  });
});

describe('redirectHost', () => {
  it('is the lowercase host name without port', () => {
    expect(redirectHost('https://Claude.AI:443/x')).toBe('claude.ai');
    expect(redirectHost('http://localhost:3000/cb')).toBe('localhost');
    expect(redirectHost('nope')).toBeNull();
  });
});

describe('normalizeAllowedHost', () => {
  it('takes a host typed in the admin page, with or without scheme, path or port', () => {
    expect(normalizeAllowedHost('chatgpt.com')).toBe('chatgpt.com');
    expect(normalizeAllowedHost(' https://ChatGPT.com/connector/cb ')).toBe('chatgpt.com');
    expect(normalizeAllowedHost('callback.mistral.ai:443')).toBe('callback.mistral.ai');
  });

  it('rejects what is not a host', () => {
    for (const bad of ['', '  ', 'not a host', 'http://', '*.claude.ai', 'claude']) {
      expect(normalizeAllowedHost(bad)).toBeNull();
    }
  });

  it('keeps loopback names', () => {
    expect(normalizeAllowedHost('localhost')).toBe('localhost');
    expect(normalizeAllowedHost('127.0.0.1')).toBe('127.0.0.1');
  });

  it('refuses every other IP address — no real assistant returns to a bare IP', () => {
    for (const ip of ['203.0.113.5', '192.168.1.10', '10.0.0.1', '1.2.3', '0.0.0.0', '127.0.0.2']) {
      expect(normalizeAllowedHost(ip)).toBeNull();
    }
  });
});

describe('accessKindOfScope', () => {
  it('partner scopes only → partner; anything else (or nothing) → full', () => {
    expect(accessKindOfScope('decks:read decks:write')).toBe('partner');
    expect(accessKindOfScope('read write claudeai')).toBe('full');
    expect(accessKindOfScope('decks:read read')).toBe('full');
    expect(accessKindOfScope(undefined)).toBe('full');
  });
});
