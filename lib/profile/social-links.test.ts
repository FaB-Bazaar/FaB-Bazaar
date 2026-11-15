import { describe, it, expect } from 'vitest';
import { SOCIAL_PLATFORMS, SOCIAL_FIELDS, normalizeSocialHandle, normalizeWebsiteUrl, sanitizeSocialLinks, socialLinkList } from './social-links';

describe('SOCIAL_PLATFORMS', () => {
  it('lists the platforms in display order, Nanza first', () => {
    expect(SOCIAL_PLATFORMS.map((p) => p.label)).toEqual(['Nanza', 'YouTube', 'Instagram', 'Bluesky', 'Facebook', 'X']);
  });
});

describe('normalizeSocialHandle', () => {
  it('accepts a bare handle', () => {
    expect(normalizeSocialHandle('instagram', 'fabbazaar')).toEqual({ ok: true, handle: 'fabbazaar' });
  });

  it('strips a leading @ and surrounding spaces', () => {
    expect(normalizeSocialHandle('x', '  @fabbazaar ')).toEqual({ ok: true, handle: 'fabbazaar' });
  });

  it('pulls the handle out of a pasted profile link', () => {
    expect(normalizeSocialHandle('nanza', 'https://nanza.app/danielwang')).toEqual({ ok: true, handle: 'danielwang' });
    expect(normalizeSocialHandle('youtube', 'https://www.youtube.com/@fabbazaar/videos')).toEqual({ ok: true, handle: 'fabbazaar' });
    expect(normalizeSocialHandle('bluesky', 'https://bsky.app/profile/fabtcg.com')).toEqual({ ok: true, handle: 'fabtcg.com' });
    expect(normalizeSocialHandle('x', 'twitter.com/fabtcg?lang=en')).toEqual({ ok: true, handle: 'fabtcg' });
    expect(normalizeSocialHandle('facebook', 'https://www.facebook.com/fabtcg/')).toEqual({ ok: true, handle: 'fabtcg' });
  });

  it('treats an empty value as "not set"', () => {
    expect(normalizeSocialHandle('x', '   ')).toEqual({ ok: true, handle: '' });
  });

  it('rejects a link to a different site', () => {
    expect(normalizeSocialHandle('instagram', 'https://evil.example/fabbazaar').ok).toBe(false);
  });

  it('rejects characters that could break out of the profile URL', () => {
    expect(normalizeSocialHandle('nanza', 'a/b').ok).toBe(false);
    expect(normalizeSocialHandle('x', 'javascript:alert(1)').ok).toBe(false);
    expect(normalizeSocialHandle('instagram', 'me?x=<script>').ok).toBe(false);
  });

  it('rejects a Nanza handle that is one of the site\'s own pages', () => {
    expect(normalizeSocialHandle('nanza', 'about').ok).toBe(false);
  });
});

describe('sanitizeSocialLinks', () => {
  it('normalizes every platform and drops the ones left empty', () => {
    const result = sanitizeSocialLinks({ nanza: '@danielwang', youtube: '', x: 'https://x.com/fabtcg' });
    expect(result).toEqual({ ok: true, value: { nanza: 'danielwang', x: 'fabtcg' } });
  });

  it('ignores platforms it does not know', () => {
    expect(sanitizeSocialLinks({ myspace: 'tom', x: 'fabtcg' })).toEqual({ ok: true, value: { x: 'fabtcg' } });
  });

  it('names the platform with the bad value', () => {
    const result = sanitizeSocialLinks({ instagram: 'not a handle!' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('Instagram');
  });

  it('rejects anything that is not an object of strings', () => {
    expect(sanitizeSocialLinks('x').ok).toBe(false);
    expect(sanitizeSocialLinks(null).ok).toBe(false);
    expect(sanitizeSocialLinks({ x: 5 }).ok).toBe(false);
  });
});

describe('socialLinkList', () => {
  it('builds profile URLs in display order, skipping unset platforms', () => {
    const list = socialLinkList({ x: 'fabtcg', nanza: 'danielwang', bluesky: 'fabtcg.com', youtube: 'fab' });
    expect(list.map((l) => [l.label, l.url])).toEqual([
      ['Nanza', 'https://nanza.app/danielwang'],
      ['YouTube', 'https://www.youtube.com/@fab'],
      ['Bluesky', 'https://bsky.app/profile/fabtcg.com'],
      ['X', 'https://x.com/fabtcg'],
    ]);
  });

  it('completes a short Bluesky handle with .bsky.social', () => {
    expect(socialLinkList({ bluesky: 'someone' })[0].url).toBe('https://bsky.app/profile/someone.bsky.social');
  });

  it('never builds a link from a stored value that fails validation', () => {
    expect(socialLinkList({ x: 'javascript:alert(1)', instagram: 'ok_name' }).map((l) => l.key)).toEqual(['instagram']);
  });

  it('is empty for missing or malformed stored data', () => {
    expect(socialLinkList(null)).toEqual([]);
    expect(socialLinkList('nope')).toEqual([]);
  });
});

describe('website link', () => {
  it('is the last field on the form, after the social platforms', () => {
    expect(SOCIAL_FIELDS.map((f) => f.label)).toEqual(['Nanza', 'YouTube', 'Instagram', 'Bluesky', 'Facebook', 'X', 'Website']);
  });

  it('keeps a full https link as typed', () => {
    expect(normalizeWebsiteUrl('https://darkdepthsgames.com/shop?ref=fab')).toEqual({
      ok: true,
      url: 'https://darkdepthsgames.com/shop?ref=fab',
    });
  });

  it('adds https:// to a bare domain', () => {
    expect(normalizeWebsiteUrl('  mystore.com ')).toEqual({ ok: true, url: 'https://mystore.com/' });
  });

  it('treats an empty value as "not set"', () => {
    expect(normalizeWebsiteUrl('')).toEqual({ ok: true, url: '' });
  });

  it('rejects anything that is not a normal web address', () => {
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,<script>1</script>',
      'ftp://files.example.com',
      'https://user:pass@example.com',
      'http://localhost:3000',
      'https://192.168.1.1/admin',
      'not a url',
      'https://example.com/' + 'a'.repeat(300),
    ]) {
      expect(normalizeWebsiteUrl(bad).ok, bad).toBe(false);
    }
  });

  it('is saved alongside the handles', () => {
    expect(sanitizeSocialLinks({ x: 'fabtcg', website: 'mystore.com' })).toEqual({
      ok: true,
      value: { x: 'fabtcg', website: 'https://mystore.com/' },
    });
  });

  it('names the field when the address is bad', () => {
    const result = sanitizeSocialLinks({ website: 'javascript:alert(1)' });
    expect(!result.ok && result.error).toContain('Website');
  });

  it('is listed last on the profile, labelled with its domain', () => {
    const list = socialLinkList({ website: 'https://www.mystore.com/shop', nanza: 'danielwang' });
    expect(list.map((l) => [l.key, l.label, l.url])).toEqual([
      ['nanza', 'Nanza', 'https://nanza.app/danielwang'],
      ['website', 'mystore.com', 'https://www.mystore.com/shop'],
    ]);
  });

  it('never renders a stored address that fails validation', () => {
    expect(socialLinkList({ website: 'javascript:alert(1)' })).toEqual([]);
  });
});
