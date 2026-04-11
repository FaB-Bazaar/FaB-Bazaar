"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import useEmblaCarousel from 'embla-carousel-react'
import AutoScroll from 'embla-carousel-auto-scroll'
import WhoHasDropdown from "@/components/shared/WhoHasDropdown"
import { getVariantStyles, getFoilingName } from "@/lib/fab-formatters"
import { TcgAffiliateLink } from "@/components/tracking/TcgAffiliateLink"
import FoilCardImage from "@/components/shared/FoilCardImage"

// Smaller FeaturedCard Component for Carousels
export function FeaturedCardSmall({ card }: { card: any }) {
  const [imageError, setImageError] = useState(false);

  // Build artStyles array to handle multiple variants (e.g. EA + AA)
  const artStyles: string[] = [];
  if (card.art_variations?.includes('FA')) {
    artStyles.push('full-art');
  }
  if (card.art_variations?.includes('AA') || card.art_variations?.includes('AB')) {
    artStyles.push('alternate-art');
  }
  if (card.art_variations?.includes('AB')) {
    artStyles.push('alternate-border');
  }
  if (card.is_extended_art) {
    artStyles.push('extended-art');
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl shadow-black/25 dark:shadow-xl dark:shadow-black/50 border border-gray-200 dark:border-gray-700 hover:shadow-2xl hover:shadow-black/30 transition-shadow duration-200 h-full flex flex-col">
      {/* Card Image — links to printing detail page */}
      <Link
        href={card.printing_id ? `/printing/${card.printing_id}` : '#'}
        className="relative block aspect-[63/88] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-t-lg overflow-hidden"
        tabIndex={card.printing_id ? 0 : -1}
      >
        {!imageError && card.image_url ? (
          <FoilCardImage
            foiling={card.foiling}
            artStyle={artStyles}
            foilInset={card.foil_inset_bottom != null ? {
              top: card.foil_inset_top,
              right: card.foil_inset_right,
              bottom: card.foil_inset_bottom,
              left: card.foil_inset_left,
              round: card.foil_inset_round,
            } : null}
            src={card.image_url}
            alt={card.name}
            className="w-full h-full"
            imgClassName="w-full h-full object-contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center px-2">
              <div className="w-8 h-8 mx-auto mb-1 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <p className="text-xs">{card.name}</p>
            </div>
          </div>
        )}

        {/* Foiling Badge */}
        {card.foiling && card.foiling !== 's' && (
          <div className="absolute top-1 left-1" style={{ zIndex: 10 }}>
            <div className={`text-xs px-1.5 py-0.5 rounded font-medium text-center ${getVariantStyles(card.rarity, card.foiling)}`}>
              {getFoilingName(card.foiling, card.is_extended_art)}
            </div>
          </div>
        )}
      </Link>

      {/* Card Info */}
      <div className="p-2 flex-1 flex flex-col">
        <div className="flex-1"></div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              {card.collector_number || card.collectorNumber || (card.set ? card.set.toUpperCase() : 'N/A')}
            </span>
          </div>

          {card.tcg_low && (
            <div className="flex items-center justify-between gap-2 h-7">
              <TcgAffiliateLink
                tcgplayerUrl={card.tcgplayer_url || `https://www.tcgplayer.com/search/flesh-and-blood-tcg/product?productLineName=flesh-and-blood-tcg&q=${encodeURIComponent(card.name)}`}
                feature="SetPageCarousel"
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors"
                title="View TCG Low price on TCGPlayer"
              >
                <span className="font-medium">TCG Low</span>
                <span className="font-bold text-green-500">${card.tcg_low.toFixed(2)}</span>
                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              </TcgAffiliateLink>
              <TcgAffiliateLink
                tcgplayerUrl={card.tcgplayer_url || `https://www.tcgplayer.com/search/flesh-and-blood-tcg/product?productLineName=flesh-and-blood-tcg&q=${encodeURIComponent(card.name)}`}
                feature="SetPageCarousel"
                className="flex items-center h-full px-2 bg-blue-600 hover:bg-blue-700 transition-colors rounded shrink-0"
                title="Buy on TCGPlayer"
              >
                <img
                  src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                  alt="TCGPlayer"
                  className="h-3 w-auto"
                />
              </TcgAffiliateLink>
            </div>
          )}

          <div className="flex items-center gap-1">
            {card.printing_id && (
              <WhoHasDropdown
                printingId={card.printing_id}
                cardName={card.name}
                searchMode="printing"
                buttonText="Who Has"
                className="flex items-center justify-center gap-0.5 h-7 px-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded flex-1 whitespace-nowrap"
              />
            )}
            {card.card_unique_id && (
              <WhoHasDropdown
                cardUniqueId={card.card_unique_id}
                cardName={card.name}
                searchMode="unique"
                buttonText="Any Version"
                className="flex items-center justify-center gap-0.5 h-7 px-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-700 rounded flex-1 whitespace-nowrap"
              />
            )}
          </div>

          {card.caption && (
            <p className="text-xs italic text-gray-600 dark:text-gray-400 line-clamp-2">
              {card.caption}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Featured Cards Carousel Component
export function FeaturedCardsCarousel({ cards, cardWidth = 240 }: { cards: any[], cardWidth?: number }) {
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);

  const shouldLoop = cards.length > 5;
  const shouldAutoScroll = cards.length > 5;

  const [autoScrollPlugin] = useState(() => AutoScroll({
    speed: shouldAutoScroll ? 0.5 : 0,
    stopOnInteraction: true,
    stopOnMouseEnter: false,
    playOnInit: false
  }));

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: shouldLoop,
      dragFree: true,
      containScroll: 'trimSnaps',
      align: 'start'
    },
    shouldAutoScroll ? [autoScrollPlugin] : []
  );

  useEffect(() => {
    const imageUrls = cards.map(card => card.image_url).filter(url => url);
    if (imageUrls.length === 0) {
      setImagesLoaded(true);
      return;
    }

    let loaded = 0;
    const promises = imageUrls.map((url) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => { loaded++; setLoadedCount(loaded); resolve(); };
        img.onerror = () => { loaded++; setLoadedCount(loaded); resolve(); };
        img.src = url;
      });
    });

    Promise.all(promises).then(() => {
      setImagesLoaded(true);
      setTimeout(() => { autoScrollPlugin.play(); }, 100);
    });
  }, [cards, autoScrollPlugin]);

  useEffect(() => {
    if (!emblaApi) return;
    let resumeTimer: NodeJS.Timeout;
    let dropdownOpen = false;

    const onPointerUp = () => {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        if (!dropdownOpen) autoScrollPlugin.play();
      }, 2000);
    };

    const onPointerDown = () => {
      autoScrollPlugin.stop();
      clearTimeout(resumeTimer);
    };

    const handleDropdownChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      dropdownOpen = customEvent.detail.isOpen;
      if (dropdownOpen) {
        autoScrollPlugin.stop();
        clearTimeout(resumeTimer);
      } else {
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => { autoScrollPlugin.play(); }, 2000);
      }
    };

    emblaApi.on('pointerUp', onPointerUp);
    emblaApi.on('pointerDown', onPointerDown);
    window.addEventListener('whoHasDropdownChange', handleDropdownChange);

    return () => {
      clearTimeout(resumeTimer);
      emblaApi.off('pointerUp', onPointerUp);
      emblaApi.off('pointerDown', onPointerDown);
      window.removeEventListener('whoHasDropdownChange', handleDropdownChange);
    };
  }, [emblaApi, autoScrollPlugin]);

  if (!imagesLoaded) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin"></div>
          <span className="text-sm">Loading featured cards... ({loadedCount}/{cards.length})</span>
        </div>
      </div>
    );
  }

  return (
    <div className="not-prose overflow-hidden" ref={emblaRef}>
      <div className="flex">
        {cards.map((card, index) => (
          <div key={`${card.printing_id || card.name}-${index}`} className="flex-shrink-0 mr-6" style={{ width: `${cardWidth}px` }}>
            <FeaturedCardSmall card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}
