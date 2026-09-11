// lib/scan/pair-url.test.ts — the URL the desktop turns into a QR must be reachable from a PHONE.
import { describe, it, expect } from 'vitest';
import { pairBaseUrl } from './pair-url';

describe('pairBaseUrl', () => {
  it('uses the request origin as-is on a real host', () => {
    expect(pairBaseUrl('https://fabbazaar.app', { lanIp: '10.0.0.92', production: true })).toBe('https://fabbazaar.app');
    expect(pairBaseUrl('http://10.0.0.92:3000', { lanIp: '10.0.0.92', production: false })).toBe('http://10.0.0.92:3000');
  });
  it('swaps localhost / 127.0.0.1 for the LAN ip in development (a phone cannot reach "localhost")', () => {
    expect(pairBaseUrl('http://localhost:3000', { lanIp: '10.0.0.92', production: false })).toBe('http://10.0.0.92:3000');
    expect(pairBaseUrl('http://127.0.0.1:3000', { lanIp: '10.0.0.92', production: false })).toBe('http://10.0.0.92:3000');
  });
  it('leaves localhost alone when no LAN ip is known', () => {
    expect(pairBaseUrl('http://localhost:3000', { lanIp: null, production: false })).toBe('http://localhost:3000');
  });
  it('an explicit override wins everywhere', () => {
    expect(pairBaseUrl('http://localhost:3000', { lanIp: '10.0.0.92', production: false, override: 'https://dev.example.test' })).toBe('https://dev.example.test');
    expect(pairBaseUrl('https://fabbazaar.app', { lanIp: null, production: true, override: 'https://staging.example.test/' })).toBe('https://staging.example.test');
  });

  it('behind a reverse proxy, uses the forwarded host + proto (the address the user actually typed)', () => {
    expect(pairBaseUrl('http://0.0.0.0:3000', { lanIp: null, production: true, forwardedHost: 'fabbazaar.app', forwardedProto: 'https' })).toBe('https://fabbazaar.app');
    expect(pairBaseUrl('http://localhost:3000', { lanIp: '10.0.0.92', production: false, forwardedHost: '10.0.0.92:3000', forwardedProto: 'http' })).toBe('http://10.0.0.92:3000');
  });
  it('in production, replaces an internal bind address (0.0.0.0 / localhost) with the configured public app URL', () => {
    expect(pairBaseUrl('https://0.0.0.0:3000', { lanIp: null, production: true, appUrl: 'https://fabbazaar.app' })).toBe('https://fabbazaar.app');
    expect(pairBaseUrl('http://localhost:3000', { lanIp: null, production: true, appUrl: 'https://fabbazaar.app/' })).toBe('https://fabbazaar.app');
  });
  it('precedence: override > forwarded headers > app url > lan swap > origin', () => {
    expect(pairBaseUrl('http://0.0.0.0:3000', { lanIp: '10.0.0.92', production: true, override: 'https://tunnel.test', forwardedHost: 'fabbazaar.app', forwardedProto: 'https', appUrl: 'https://app.test' })).toBe('https://tunnel.test');
    expect(pairBaseUrl('http://0.0.0.0:3000', { lanIp: '10.0.0.92', production: true, forwardedHost: 'fabbazaar.app', forwardedProto: 'https', appUrl: 'https://app.test' })).toBe('https://fabbazaar.app');
    expect(pairBaseUrl('http://0.0.0.0:3000', { lanIp: '10.0.0.92', production: false, appUrl: 'https://app.test' })).toBe('http://10.0.0.92:3000');
  });
  it('never emits an unusable internal address when nothing better is known', () => {
    expect(pairBaseUrl('http://0.0.0.0:3000', { lanIp: null, production: true })).toBe('http://0.0.0.0:3000'); // documented worst case, nothing to swap to
  });

  it('uses the plain Host header when the proxy forwards no X-Forwarded-Host (Caddy passes Host through)', () => {
    expect(pairBaseUrl('http://0.0.0.0:3000', { lanIp: null, production: true, hostHeader: 'fabbazaar.app' })).toBe('https://fabbazaar.app');
    expect(pairBaseUrl('http://0.0.0.0:3000', { lanIp: null, production: true, hostHeader: 'fabbazaar.app', forwardedProto: 'https' })).toBe('https://fabbazaar.app');
    expect(pairBaseUrl('http://localhost:3000', { lanIp: '10.0.0.92', production: false, hostHeader: '10.0.0.92:3000' })).toBe('http://10.0.0.92:3000');
  });
  it('ignores a Host header or app URL that is itself an internal address', () => {
    expect(pairBaseUrl('http://0.0.0.0:3000', { lanIp: null, production: true, hostHeader: '0.0.0.0:3000', appUrl: 'http://localhost:3000' })).toBe('http://0.0.0.0:3000');
    expect(pairBaseUrl('http://0.0.0.0:3000', { lanIp: null, production: true, hostHeader: 'localhost:3000', appUrl: 'https://fabbazaar.app' })).toBe('https://fabbazaar.app');
  });
});
