import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { curatedListService, curatorHeroAssignmentService } from '@/lib/services';
import { getHeroInfo, toHeroDisplayName } from '@/lib/fab-constants/heroes';
import { slugToFormat, slugToHeroName, formatToSlug } from '@/lib/utils/kit-slugs';
import KitPoolView from '@/components/kits/KitPoolView';

interface PageProps {
  params: Promise<{ format: string; hero: string }>;
}

export default async function KitHeroPage({ params }: PageProps) {
  const { format: formatSlug, hero: heroSlug } = await params;
  const format = slugToFormat(formatSlug);
  const heroName = slugToHeroName(heroSlug);
  if (!format || !heroName) notFound();

  const heroInfo = getHeroInfo(heroName);
  const displayName = toHeroDisplayName(heroName, heroInfo?.shortName);

  const [listsResult, curatorsResult] = await Promise.all([
    curatedListService.getPublishedListsForHero(heroName),
    curatorHeroAssignmentService.getAssignmentsForHero(heroName),
  ]);

  const lists = listsResult.success
    ? listsResult.data.filter(l => (l.format ?? '').toLowerCase() === format.toLowerCase())
    : [];

  const curators = curatorsResult.success
    ? curatorsResult.data.filter(a => a.metafyProductUrl)
    : [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href={`/kits?format=${formatToSlug(format) ?? ''}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        All kits
      </Link>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{displayName}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {format}
          {heroInfo?.classes?.length
            ? ` · ${heroInfo.classes.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}`
            : ''}
          {heroInfo?.talents?.length
            ? ` · ${heroInfo.talents.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}`
            : ''}
        </p>

        {curators.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            {curators.map(c => (
              <a
                key={c.metafyProductUrl!}
                href={c.metafyProductUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors w-fit"
              >
                <img src="/metafy-white.svg" alt="Metafy" className="hidden dark:block h-3.5 w-auto shrink-0" />
                <img src="/metafy-black.svg" alt="Metafy" className="block dark:hidden h-3.5 w-auto shrink-0 opacity-70" />
                <span>{c.metafyLinkLabel || `${c.displayUsername}'s Metafy guide`}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ))}
          </div>
        )}
      </header>

      {lists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-lg">
          <p className="text-lg">No starter kits published yet</p>
          <p className="text-sm mt-1">Check back soon or browse other heroes.</p>
        </div>
      ) : (
        <KitPoolView lists={lists} />
      )}
    </div>
  );
}
