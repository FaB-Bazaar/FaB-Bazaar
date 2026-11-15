import { describe, it, expect } from 'vitest';
import { accountNavItems } from './account-nav';

describe('accountNavItems', () => {
  it('lists the account pages in order, ending with the public profile', () => {
    const items = accountNavItems('someone', '/profile/edit');
    expect(items.map((i) => [i.label, i.href])).toEqual([
      ['Account', '/profile'],
      ['Edit profile', '/profile/edit'],
      ['Socials', '/profile/socials'],
      ['Connected accounts', '/profile/connected-accounts'],
      ['Public profile', '/profile/someone'],
    ]);
  });

  it('marks only the current page active', () => {
    const items = accountNavItems('someone', '/profile/edit');
    expect(items.filter((i) => i.active).map((i) => i.label)).toEqual(['Edit profile']);
  });

  it('does not mark Account active on a sub-page', () => {
    const items = accountNavItems('someone', '/profile/connected-accounts');
    expect(items.find((i) => i.label === 'Account')!.active).toBe(false);
  });

  it('URL-encodes the public profile link', () => {
    const items = accountNavItems('a b', '/profile');
    expect(items[4].href).toBe('/profile/a%20b');
  });

  it('leaves out the public profile link until the username is known', () => {
    expect(accountNavItems('', '/profile/edit').map((i) => i.label)).toEqual([
      'Account',
      'Edit profile',
      'Socials',
      'Connected accounts',
    ]);
  });
});
