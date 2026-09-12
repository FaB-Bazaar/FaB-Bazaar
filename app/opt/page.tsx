// Server shell for /opt. The search UI itself is a client component
// (OptSearchPage); this wrapper exists so the route can emit link-preview
// metadata from the URL — a link to a single set (`/opt?sets=iar`) unfurls as
// that set instead of the generic site card. Search params are only available
// to pages (not layouts), hence the split.
import type { Metadata } from 'next';
import { buildOptMetadata } from '@/lib/search/opt-metadata';
import OptSearchPage from './OptSearchPage';

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<SearchParams> },
): Promise<Metadata> {
  return buildOptMetadata(await searchParams) ?? {};
}

export default function OptPage() {
  return <OptSearchPage />;
}
