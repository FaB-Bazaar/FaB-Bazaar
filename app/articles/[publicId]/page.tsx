import { MDXRemote } from 'next-mdx-remote/rsc';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

// --- SERVICE LAYER IMPORT ---
import { printingsService } from '@/lib/services';
import { getCachedArticleByPublicId, getCachedArticlePublicIds } from '@/lib/article-cache';

// --- SECURITY: HTML SANITIZATION ---
import { createSafeInnerHTML } from '@/lib/sanitize-html';

// --- COMPONENT IMPORTS ---
import HeroCard from '@/components/heroes/HeroCard';
import InlineCard from '@/components/heroes/InlineCard';
import CardGrid from '@/components/heroes/CardGrid'; 
import CardCarousel from '@/components/heroes/CardCarousel'; 
import CardRow from '@/components/heroes/CardRow'; 
import Callout from '@/components/heroes/Callout';
import OpportunityCard from '@/components/heroes/OpportunityCard';
import SpotlightCard from '@/components/heroes/SpotlightCard';
import ResourceLinks from '@/components/heroes/ResourceLinks';
import FeaturedVideo from '@/components/heroes/FeaturedVideo';
import CreatorSpotlight, { SpotlightHeader, SpotlightLinks, SpotlightLink } from '@/components/heroes/CreatorSpotlight';
import WhoHasDropdown from '@/components/shared/WhoHasDropdown';
import ClientHeroCard from '@/components/heroes/ClientHeroCard';
import InteractiveCardWrapper from '@/components/heroes/InteractiveCardWrapper';

// Add the affiliate disclosure component
import { AffiliateDisclosure } from '@/components/tracking/AffiliateDisclosure';

// Add the FeaturedCardsCarousel component
import { FeaturedCardsCarousel } from '@/components/shared/FeaturedCardsCarousel';

// Add ad components
import { ShareButton } from "@/components/shared/ShareButton";

const components = {
  HeroCard, InlineCard, CardGrid, CardCarousel, CardRow, Callout,
  ResourceLinks, FeaturedVideo, CreatorSpotlight, SpotlightHeader,
  SpotlightLinks, SpotlightLink, ClientHeroCard, InteractiveCardWrapper,
};

// ISR: Cache pages for 1 hour to reduce serverless instance count
export const revalidate = 3600;

// Helper function to fetch carousel card data using service layer
async function fetchCarouselCards(cards: { printingId: string; caption?: string }[]) {
  if (!cards || cards.length === 0) return [];

  const printingIds = cards.map(c => c.printingId).filter(Boolean);
  if (printingIds.length === 0) return [];

  // Use service layer directly instead of HTTP fetch (avoids SSR issues)
  const result = await printingsService.getPrintingsByIds(printingIds);

  if (!result.success || !result.data?.printings || result.data.printings.length === 0) {
    console.error('[CardCarousel] Failed to fetch cards:', result.error);
    return [];
  }

  // Map service data to carousel format, preserving captions from original cards
  return result.data.printings.map((printing) => {
    const originalCard = cards.find(c => c.printingId === printing.printing_id);
    return {
      printing_id: printing.printing_id,
      card_unique_id: printing.card_unique_id,
      name: printing.name,
      set: printing.set,
      collector_number: printing.collector_number,
      edition: printing.edition,
      foiling: printing.foiling,
      rarity: printing.rarity,
      is_extended_art: (printing as any).is_extended_art,
      tcgplayer_url: printing.tcgplayer_url,
      tcg_low: printing.tcg_low,
      tcg_market: printing.tcg_market,
      image_url: printing.image_url,
      caption: originalCard?.caption,
    };
  });
}

export async function generateMetadata({ params }: { params: { publicId: string } }): Promise<Metadata> {
  const { publicId } = await params;

  // Use cached service layer - need to filter published articles with contentType 'article'
  const result = await getCachedArticleByPublicId(publicId);

  if (!result.success || !result.data || result.data.status !== 'published' || result.data.contentType === 'hero') {
    return { title: 'Not Found' };
  }

  const article = result.data;
  const { title, subtitle, image } = article;
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/articles/${publicId}`;

  const ogImageUrl = image
    ? `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${image}/public`
    : `${process.env.NEXT_PUBLIC_APP_URL}/api/og?title=${encodeURIComponent(title || '')}`;

  return {
    title: title,
    description: subtitle,
    openGraph: {
      title: title,
      description: subtitle,
      url: url,
      images: [{ url: ogImageUrl, alt: title }],
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: title,
      description: subtitle,
      images: [ogImageUrl],
    },
  };
}

export default async function ArticlePage({ params }: { params: { publicId: string } }) {
  const { publicId } = await params;

  // Use cached service layer to fetch article
  const result = await getCachedArticleByPublicId(publicId);

  if (!result.success || !result.data || result.data.status !== 'published' || result.data.contentType === 'hero') {
    notFound();
  }

  const articleDoc = result.data;

  // Pre-fetch all carousel data
  const carouselDataMap = new Map();
  for (let i = 0; i < (articleDoc.sections || []).length; i++) {
    const section = articleDoc.sections[i];
    if (section.type === 'card-carousel') {
      const carouselCards = await fetchCarouselCards(section.cards || []);
      carouselDataMap.set(i, carouselCards);
    }
  }

  return (
    <>
      {/* Add the affiliate disclosure at the top */}
      <AffiliateDisclosure />

      <div className="container mx-auto px-4 py-8">
        <article className="prose prose-custom lg:prose-xl max-w-none dark:prose-invert">
          <h1>{articleDoc.title}</h1>
          {articleDoc.subtitle && (
            <p className="lead text-lg text-slate-600 dark:text-slate-400">{articleDoc.subtitle}</p>
          )}
          <div className="not-prose flex items-center gap-2 mb-4">
            <ShareButton url={`https://fabbazaar.app/articles/${publicId}`} />
          </div>
          <hr />

          {/* Section renderer with all section types */}
          {(articleDoc.sections || []).map((section: any, index: number) => {
            switch (section.type) {
              case 'text':
                return <MDXRemote key={index} source={section.content} components={components} />;

              case 'card-carousel':
                const carouselCards = carouselDataMap.get(index) || [];
                return carouselCards.length > 0 ? (
                  <FeaturedCardsCarousel key={index} cards={carouselCards} />
                ) : null;

              case 'callout':
                return (
                  <div
                    key={index}
                    className="not-prose"
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-callout', {
                      title: section.title,
                      text: section.text,
                      'link-href': section.linkHref,
                      'link-text': section.linkText,
                    })}
                  />
                );

              case 'opportunity-card':
                const priceChangeJson = section.priceChange
                  ? JSON.stringify(section.priceChange)
                  : '';
                return (
                  <div
                    key={index}
                    className="not-prose"
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-opportunity-card', {
                      'printing-id': section.printingId,
                      reason: section.reason,
                      confidence: section.confidence,
                      'price-change': priceChangeJson,
                      note: section.note,
                    })}
                  />
                );

              case 'video':
                return (
                  <div
                    key={index}
                    className="not-prose"
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-video', {
                      'video-id': section.videoId,
                      title: section.title,
                      description: section.description,
                      'creator-name': section.creatorName,
                      'creator-url': section.creatorUrl,
                    })}
                  />
                );

              case 'creator-spotlight':
                return (
                  <CreatorSpotlight key={index} imageUrl={section.imageUrl}>
                    <SpotlightHeader name={section.name}>{section.description}</SpotlightHeader>
                    <SpotlightLinks>
                      {(section.links || []).map((link: any) =>
                        <SpotlightLink key={link.url} href={link.url} icon={link.icon}>{link.label}</SpotlightLink>
                      )}
                    </SpotlightLinks>
                  </CreatorSpotlight>
                );

              case 'spotlight-card':
                return (
                  <div
                    key={index}
                    className="not-prose"
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-spotlight-card', {
                      'printing-id': section.printingId,
                      title: section.title,
                      commentary: section.commentary,
                    })}
                  />
                );

              case 'intro':
                return (
                  <div
                    key={index}
                    className="not-prose"
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-intro', {
                      text: section.text,
                      tags: section.tags,
                    })}
                  />
                );

              case 'byline':
                return (
                  <div
                    key={index}
                    className="not-prose"
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-byline', {
                      role: section.role,
                      name: section.name,
                      link: section.link,
                    })}
                  />
                );

              case 'section-header':
                return (
                  <div
                    key={index}
                    className="not-prose"
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-section-header', {
                      title: section.title,
                      subtitle: section.subtitle,
                      level: section.level || '2',
                    })}
                  />
                );

              case 'key-takeaways':
                return (
                  <div
                    key={index}
                    className="not-prose"
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-key-takeaways', {
                      title: section.title || 'Key Takeaways',
                      items: section.items,
                    })}
                  />
                );

              case 'match-report':
                const sideboardCardsJson = section.sideboardCards?.length > 0
                  ? JSON.stringify(section.sideboardCards)
                  : '';
                const matchReportHtml = createSafeInnerHTML('fab-match-report', {
                  round: section.round,
                  opponent: section.opponent,
                  hero: section.hero,
                  'hero-printing-id': section.heroPrintingId,
                  result: section.result,
                  record: section.record,
                  summary: section.summary,
                  sideboard: section.sideboard,
                  'sideboard-cards': sideboardCardsJson,
                });
                return (
                  <div
                    key={index}
                    className="not-prose"
                    dangerouslySetInnerHTML={matchReportHtml}
                  />
                );

              case 'decklist-block':
                return (
                  <div
                    key={index}
                    className="not-prose"
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-decklist-block', {
                      'deck-id': section.deckId,
                      'article-public-id': articleDoc.publicId,
                      title: section.title || '',
                      sections: section.sections,
                      'export-url': section.exportUrl,
                      notes: section.notes,
                    })}
                  />
                );

              case 'buylist-block':
                return (
                  <div
                    key={index}
                    className="not-prose"
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-buylist-block', {
                      tiers: JSON.stringify(section.tiers || []),
                      title: section.title || '',
                      note: section.note,
                    })}
                  />
                );

              default:
                return <div key={index} className="text-red-500 font-semibold my-4 p-4 bg-red-900/20 rounded-md">Error: Unsupported section type "{section.type}"</div>;
            }
          })}
        </article>
      </div>

      {/* Desktop Video-Capable Ad - Shows at bottom on desktop only */}

      {/* Mobile Anchor Ad - Shows at bottom on mobile only */}
    </>
  );
}

export async function generateStaticParams() {
  const publicIds = await getCachedArticlePublicIds();
  return publicIds.map(publicId => ({ publicId }));
}