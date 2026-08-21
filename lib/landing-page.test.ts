// lib/landing-page.test.ts
import { describe, it, expect } from 'vitest';
import { resolveLandingPath, LANDING_PAGE_OPTIONS } from './landing-page';

describe('resolveLandingPath', () => {
  it('maps "collection" to /collection', () => {
    expect(resolveLandingPath('collection')).toBe('/collection');
  });

  it('maps "decks" to /decks', () => {
    expect(resolveLandingPath('decks')).toBe('/decks');
  });

  it('maps "volzar" to /volzar', () => {
    expect(resolveLandingPath('volzar')).toBe('/volzar');
  });

  it('maps "opt" to /opt', () => {
    expect(resolveLandingPath('opt')).toBe('/opt');
  });

  it('maps "daily" to /daily', () => {
    expect(resolveLandingPath('daily')).toBe('/daily');
  });

  it('defaults to /daily when unset', () => {
    expect(resolveLandingPath(null)).toBe('/daily');
    expect(resolveLandingPath(undefined)).toBe('/daily');
    expect(resolveLandingPath('')).toBe('/daily');
  });

  it('defaults to /daily for unknown values', () => {
    expect(resolveLandingPath('garbage')).toBe('/daily');
    expect(resolveLandingPath('/etc/passwd')).toBe('/daily');
  });

  it('explicit preferences survive the default flip (opt → daily, 2026-08)', () => {
    expect(resolveLandingPath('volzar')).toBe('/volzar');
    expect(resolveLandingPath('opt')).toBe('/opt');
  });

  it('exposes the options list for UI and validation, volzar first', () => {
    expect(LANDING_PAGE_OPTIONS.map((o) => o.value)).toEqual(['volzar', 'collection', 'decks', 'opt', 'daily']);
  });
});
