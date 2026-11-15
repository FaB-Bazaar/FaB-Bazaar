// lib/profile/account-nav.ts
//
// Links for the account-area side nav (/profile, /profile/edit,
// /profile/socials, /profile/connected-accounts) plus the user's public profile.

import { profileHref } from '@/lib/utils/display-username';

export interface AccountNavItem {
  label: string;
  href: string;
  active: boolean;
}

export function accountNavItems(username: string, pathname: string): AccountNavItem[] {
  const items = [
    { label: 'Account', href: '/profile' },
    { label: 'Edit profile', href: '/profile/edit' },
    { label: 'Socials', href: '/profile/socials' },
    { label: 'Connected accounts', href: '/profile/connected-accounts' },
  ];
  if (username) items.push({ label: 'Public profile', href: profileHref(username) });

  return items.map((item) => ({ ...item, active: item.href === pathname }));
}
