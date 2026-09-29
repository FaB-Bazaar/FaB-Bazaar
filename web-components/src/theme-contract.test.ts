/**
 * Every article web component follows the SITE theme toggle, never the OS.
 * `prefers-color-scheme` made a card render dark on a light page whenever the
 * reader's OS was in dark mode (and light on a dark page the other way round).
 * The contract (utils/theme.ts): style dark mode with :host([dark]) and mirror
 * the page's .dark class onto the host with watchTheme/unwatchTheme.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const dir = join(process.cwd(), 'web-components/src');
const components = readdirSync(dir).filter(f => /^fab-.*\.ts$/.test(f) && !f.endsWith('.test.ts'));

describe('web component theme contract', () => {
  it('finds the components', () => {
    expect(components.length).toBeGreaterThan(10);
  });

  it.each(components)('%s never keys dark mode on the OS setting', (file) => {
    expect(readFileSync(join(dir, file), 'utf8')).not.toContain('prefers-color-scheme');
  });

  it.each(components)('%s mirrors the site theme when it has dark styles', (file) => {
    const src = readFileSync(join(dir, file), 'utf8');
    if (!src.includes(':host([dark])')) return; // no dark styles at all (callout, creator spotlight)
    expect(src).toContain('watchTheme(this)');
    expect(src).toContain('unwatchTheme(this)');
  });
});
