// Link-preview metadata for /opt. Pure so it can be unit-tested; the page's
// generateMetadata just feeds it the URL search params.
//
// Only a URL that selects EXACTLY ONE real set gets a set-specific card
// (title / description / set logo). Everything else — no sets, several sets,
// a `grp:` group token, an unknown code — returns null so the page keeps the
// inherited site metadata from app/layout.tsx.
import type { Metadata } from 'next';
import { SET_MAP, normalizeSetCode, isSetGroupToken } from '@/lib/fab-constants/sets';
import { SET_IMAGES, getSetImageOrFallback } from '@/lib/set-images';

const SITE_URL = 'https://fabbazaar.app';
const SITE_ICON = `${SITE_URL}/icon-512x512.png`;

type SearchParamValue = string | string[] | undefined;

export function buildOptMetadata(searchParams: Record<string, SearchParamValue>): Metadata | null {
  const raw = searchParams.sets;
  const tokens = (Array.isArray(raw) ? raw : [raw ?? ''])
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean);
  if (tokens.length !== 1 || isSetGroupToken(tokens[0])) return null;

  const code = normalizeSetCode(tokens[0]);
  const name = (SET_MAP as Record<string, string>)[code];
  if (!name) return null;

  const title = `${name} (${code.toUpperCase()})`;
  const description = `Browse every ${name} card on FaB Bazaar — check prices, add cards to your collection or wants list, and build decks.`;
  const url = `${SITE_URL}/opt?sets=${code}`;
  const hasLogo = Boolean(SET_IMAGES[code]);
  const image = hasLogo ? getSetImageOrFallback(code, name) : SITE_ICON;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: 'FaB Bazaar',
      images: [{ url: image, alt: `${name} set logo` }],
    },
    twitter: {
      // Set logos are wide banners — a large card shows them; the square
      // site icon reads better as a summary thumbnail.
      card: hasLogo ? 'summary_large_image' : 'summary',
      title,
      description,
      images: [image],
    },
  };
}
