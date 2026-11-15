import { describe, it, expect } from 'vitest';
import { buildProfileMetadata } from './profile-metadata';

describe('buildProfileMetadata', () => {
  it('describes the profile for link previews', () => {
    const meta = buildProfileMetadata('someone', {
      username: 'someone',
      discordAvatar: 'https://cdn.discordapp.com/avatars/1/a.png',
      publicBinders: 20,
      wantsCount: 1,
    });
    expect(meta.title).toBe("someone's profile");
    expect(meta.description).toBe('20 public binders · 1 want on FaB Bazaar');
    expect((meta.openGraph as any).images).toEqual([{ url: 'https://cdn.discordapp.com/avatars/1/a.png' }]);
    expect((meta.openGraph as any).url).toBe('/profile/someone');
  });

  it('never shows the internal dc_ / gh_ username prefix', () => {
    const meta = buildProfileMetadata('dc_someone', { username: 'dc_someone', publicBinders: 1, wantsCount: 0 });
    expect(meta.title).toBe("someone's profile");
    expect(meta.description).toBe('1 public binder · 0 wants on FaB Bazaar');
  });

  it('keeps unknown usernames out of search indexes', () => {
    const meta = buildProfileMetadata('ghost', null);
    expect(meta.title).toBe('Profile not found');
    expect(meta.robots).toEqual({ index: false });
  });
});
