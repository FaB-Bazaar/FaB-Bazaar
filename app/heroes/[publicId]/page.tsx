import { MDXRemote } from 'next-mdx-remote/rsc';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

// --- SERVICE IMPORTS ---
import { articleService } from '@/lib/services';

// --- SECURITY: HTML SANITIZATION ---
import { createSafeInnerHTML } from '@/lib/sanitize-html';

// --- COMPONENT IMPORTS (These remain the same) ---
import HeroCard from '@/components/heroes/HeroCard';
import InlineCard from '@/components/heroes/InlineCard';
import CardGrid from '@/components/heroes/CardGrid';
import CardCarousel from '@/components/heroes/CardCarousel';
import CardRow from '@/components/heroes/CardRow';
import Callout from '@/components/heroes/Callout';
import ResourceLinks from '@/components/heroes/ResourceLinks';
import FeaturedVideo from '@/components/heroes/FeaturedVideo';
import CreatorSpotlight, { SpotlightHeader, SpotlightLinks, SpotlightLink } from '@/components/heroes/CreatorSpotlight';
import WhoHasDropdown from '@/components/shared/WhoHasDropdown';
import OpportunityCard from '@/components/heroes/OpportunityCard';
import SpotlightCard from '@/components/heroes/SpotlightCard';

import ClientHeroCard from '@/components/heroes/ClientHeroCard';
import InteractiveCardWrapper from '@/components/heroes/InteractiveCardWrapper';

// Add the affiliate disclosure component
import { AffiliateDisclosure } from '@/components/tracking/AffiliateDisclosure';

// Add the FeaturedCardsCarousel component
import { FeaturedCardsCarousel } from '@/components/shared/FeaturedCardsCarousel';

// Add ad components
import { MobileAnchorAd } from "@/components/ads/mobile-anchor-ad";
import { DesktopAnchorAd } from "@/components/ads/desktop-anchor-ad";
import { ShareButton } from "@/components/shared/ShareButton";

// Add it to your components object:
const components = {
  HeroCard, InlineCard, CardGrid, CardCarousel, CardRow, Callout,
  ResourceLinks, FeaturedVideo, CreatorSpotlight, SpotlightHeader,
  SpotlightLinks, SpotlightLink, ClientHeroCard, InteractiveCardWrapper,
};

// ISR: Cache pages for 1 hour to reduce serverless instance count
export const revalidate = 3600;

// Helper function to fetch carousel card data
async function fetchCarouselCards(cards: any[]) {
  const printingIds = cards.map((c) => c.printingId).filter(Boolean);
  if (printingIds.length === 0) return [];

  const { printingsService } = await import('@/lib/services');
  const result = await printingsService.searchPrintings({ printingIds }, {});
  if (!result.success) return [];

  const printingMap = new Map(
    result.data.printings.map((p: any) => [p.printing_id, p])
  );

  return cards
    .map((card) => {
      const printing = printingMap.get(card.printingId);
      if (!printing) return null;
      return {
        printing_id: printing.printing_id,
        card_unique_id: printing.card_unique_id,
        name: card.name || printing.display_name || printing.name,
        set: printing.set,
        collector_number: printing.printing_card_id || printing.collector_number,
        edition: printing.edition,
        foiling: printing.foiling,
        rarity: printing.rarity,
        is_extended_art: printing.is_extended_art,
        tcgplayer_url: printing.tcgplayer_url,
        tcg_low: printing.tcg_low,
        tcg_market: printing.tcg_low || printing.tcg_market,
        image_url: printing.image_url,
        caption: card.caption,
      };
    })
    .filter(Boolean);
}

// ============================================================================
// generateMetadata Function (Now uses article service)
// ============================================================================
export async function generateMetadata({ params }: { params: { publicId: string } }): Promise<Metadata> {
  const { publicId } = await params;

  const result = await articleService.getArticleByPublicId(publicId);

  if (!result.success || !result.data || result.data.status !== 'published' || result.data.contentType !== 'hero') {
    return { title: 'Not Found' };
  }

  const article = result.data;
  const { title, subtitle, image } = article;
  const url = `https://fabbazaar.app/heroes/${publicId}`;

  const ogImageUrl = image
    ? `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${image}/public`
    : `https://fabbazaar.app/api/og?title=${encodeURIComponent(title || '')}`;

  return {
    title: title,
    description: subtitle,
    openGraph: {
      title: title,
      description: subtitle,
      url: url,
      siteName: 'FaB Bazaar',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
      locale: 'en_US',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: subtitle,
      images: [ogImageUrl],
    },
  };
}

// ============================================================================
// Main Page Component (Now uses article service)
// ============================================================================
export default async function HeroArticlePage({ params }: { params: { publicId: string } }) {
  const { publicId } = await params;

  const result = await articleService.getArticleByPublicId(publicId);

  if (!result.success || !result.data || result.data.status !== 'published' || result.data.contentType !== 'hero') {
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
            <ShareButton url={`https://fabbazaar.app/heroes/${publicId}`} />
          </div>
          <hr />

          {/* --- THE NEW RENDER LOGIC for structured content --- */}
          {(articleDoc.sections || []).map((section: any, index: number) => {
            switch (section.type) {
              case 'text':
                // For 'text' blocks, we use MDXRemote to process Markdown and inline components
                return <MDXRemote key={index} source={section.content} components={components} />;

              case 'card-carousel':
                const carouselCards = carouselDataMap.get(index) || [];
                return carouselCards.length > 0 ? (
                  <FeaturedCardsCarousel key={index} cards={carouselCards} />
                ) : null;
              case 'video':
                return (
                  <div
                    key={index}
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

              case 'callout':
                return (
                  <div
                    key={index}
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-callout', {
                      title: section.title,
                      text: section.text,
                      'link-href': section.linkHref,
                      'link-text': section.linkText,
                    })}
                  />
                );

              case 'opportunity-card':
                const heroPriceChangeJson = section.priceChange
                  ? JSON.stringify(section.priceChange)
                  : '';
                return (
                  <div
                    key={index}
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-opportunity-card', {
                      'printing-id': section.printingId,
                      reason: section.reason || 'underpriced',
                      confidence: section.confidence || 'medium',
                      'price-change': heroPriceChangeJson,
                      note: section.note,
                    })}
                  />
                );

              case 'spotlight-card':
                return (
                  <div
                    key={index}
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
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-key-takeaways', {
                      title: section.title || 'Key Takeaways',
                      items: section.items,
                    })}
                  />
                );

              case 'match-report':
                const heroSideboardCardsJson = section.sideboardCards?.length > 0
                  ? JSON.stringify(section.sideboardCards)
                  : '';
                return (
                  <div
                    key={index}
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-match-report', {
                      round: section.round,
                      opponent: section.opponent,
                      hero: section.hero,
                      'hero-printing-id': section.heroPrintingId,
                      result: section.result,
                      record: section.record,
                      summary: section.summary,
                      sideboard: section.sideboard,
                      'sideboard-cards': heroSideboardCardsJson,
                    })}
                  />
                );

              case 'decklist-block':
                return (
                  <div
                    key={index}
                    dangerouslySetInnerHTML={createSafeInnerHTML('fab-decklist-block', {
                      'deck-id': section.deckId,
                      'hero-public-id': articleDoc.publicId,
                      title: section.title || '',
                      sections: section.sections,
                      'export-url': section.exportUrl,
                      notes: section.notes,
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
      <DesktopAnchorAd className="overflow-hidden" />

      {/* Mobile Anchor Ad - Shows at bottom on mobile only */}
      <MobileAnchorAd />
    </>
  );
}

// ============================================================================
// generateStaticParams Function (Now uses article service)
// ============================================================================
export async function generateStaticParams() {
  const result = await articleService.listArticles(
    { status: 'published', contentType: 'hero' },
    { sort: { createdAt: -1 } }
  );

  if (!result.success) {
    return [];
  }

  return result.data.articles.map(article => ({
    publicId: article.publicId,
  }));
}
