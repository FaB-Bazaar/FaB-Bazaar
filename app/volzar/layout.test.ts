import { describe, it, expect } from 'vitest';
import { metadata } from './layout';

describe('volzar layout metadata', () => {
  it('brands the page as Volzar with an AI-chat description', () => {
    expect(String(metadata.title)).toContain('Volzar');
    expect(metadata.description).toMatch(/AI/i);
  });

  it('provides Volzar-specific Open Graph tags for link embeds', () => {
    const og = metadata.openGraph as any;
    expect(og?.title).toContain('Volzar');
    expect(og?.url).toContain('/volzar');
    expect(og?.images?.[0]?.url).toContain('volzar-icon.png');
  });
});
