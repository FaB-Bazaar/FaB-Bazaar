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
});
