// lib/profile/profile-metadata.ts
//
// Page metadata for /profile/[username], so a shared profile link has a title,
// summary and avatar. The root layout's title template appends "| FaB Bazaar".

import type { Metadata } from 'next';
import { displayUsername } from '@/lib/utils/display-username';

export interface ProfileMetadataInput {
  username: string;
  discordAvatar?: string;
  publicBinders: number;
  wantsCount: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function buildProfileMetadata(username: string, profile: ProfileMetadataInput | null): Metadata {
  if (!profile) {
    return { title: 'Profile not found', robots: { index: false } };
  }

  const name = displayUsername(profile.username);
  const title = `${name}'s profile`;
  const description = `${plural(profile.publicBinders, 'public binder')} · ${plural(profile.wantsCount, 'want')} on FaB Bazaar`;

  return {
    title,
    description,
    openGraph: {
      title: `${name}'s profile`,
      description,
      url: `/profile/${encodeURIComponent(username)}`,
      images: profile.discordAvatar ? [{ url: profile.discordAvatar }] : undefined,
    },
    twitter: { card: 'summary', title: `${name}'s profile`, description },
  };
}
