"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Camera, MessageCircle, TrendingUp, ArrowRight, Zap, Eye, Search, ChevronRight } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import WhoHasDropdown from "@/components/shared/WhoHasDropdown"
import { useDarkMode } from '@/contexts/DarkModeContext'
import { FeaturedCardsCarousel } from "@/components/shared/FeaturedCardsCarousel"
import { getVariantStyles, getFoilingName } from "@/lib/fab-formatters"
import { TcgAffiliateLink } from "@/components/tracking/TcgAffiliateLink"
import { MobileAnchorAd } from "@/components/ads/mobile-anchor-ad"
import { DesktopAnchorAd } from "@/components/ads/desktop-anchor-ad"



// Updated FeaturedCard Component (used in Card Showcase section)
function FeaturedCard({ card }: { card: any }) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg dark:hover:shadow-2xl transition-shadow duration-200">
      {/* Card Image */}
      <div className="relative aspect-[5/7] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600">
        {!imageError && card.image_url ? (
          <img
            src={card.image_url}
            alt={card.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <p className="text-xs">{card.name}</p>
            </div>
          </div>
        )}

        {/* Foiling Badge - Enhanced with gradient styling */}
        {card.foiling && card.foiling !== 's' && (
          <div className="absolute top-2 left-2">
            <div className={`text-xs px-2 py-1 rounded font-medium text-center ${getVariantStyles(card.rarity, card.foiling)}`}>
              {getFoilingName(card.foiling, card.is_extended_art)}
            </div>
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-4">
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-1">{card.name}</h3>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">{card.set}</span>
          </div>

          {/* TCGplayer Purchase Link - Enhanced with affiliate tracking */}
          {card.tcg_market && card.tcgplayer_url ? (
            <TcgAffiliateLink
              tcgplayerUrl={card.tcgplayer_url}
              feature="HomepageCarousel"
              className="flex items-center justify-center gap-1 text-xs text-white font-bold bg-green-600 hover:bg-green-700 transition-colors py-1.5 px-2 rounded w-full mt-2"
              title="Purchase on TCGPlayer"
            >
              <span>${card.tcg_market.toFixed(2)}</span>
              <img
                src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                alt="TCGPlayer"
                className="h-2.5 w-auto"
              />
            </TcgAffiliateLink>
          ) : card.tcg_market ? (
            <div className="text-center mt-2">
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                ${card.tcg_market.toFixed(2)}
              </span>
            </div>
          ) : null}
        </div>

        {/* Who Has This Section - Updated with dual buttons */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {card.uniqueOwners ? (
              <span>{card.uniqueOwners} trader{card.uniqueOwners !== 1 ? 's' : ''} have this</span>
            ) : (
              <span>Who has this card?</span>
            )}
          </div>

          {/* Dual WhoHas buttons matching WantsCard pattern */}
          <div className="flex items-center gap-1">
            {/* Search for SPECIFIC printing */}
            {card.printing_id && (
              <WhoHasDropdown
                printingId={card.printing_id}
                cardName={card.name}
                searchMode="printing"
                className="!p-2 hover:bg-blue-50 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 rounded"
              />
            )}

            {/* Search for ANY version */}
            {card.card_unique_id && (
              <WhoHasDropdown
                cardUniqueId={card.card_unique_id}
                cardName={card.name}
                searchMode="unique"
                className="!p-2 hover:bg-purple-50 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-700 hover:border-purple-300 dark:hover:border-purple-600 rounded"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Card Showcase Section
function CardShowcase({ featuredCards, loading, error }: { featuredCards: any[], loading: boolean, error: string | null }) {
  return (
    <section className="py-20 px-6 bg-gray-50 dark:bg-gray-900 relative z-10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            See Who Has the Cards You Need
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-4">
            Click any "Who Has" button to instantly see which traders have that card available. 
            Connect with them for trades!
          </p>
          {featuredCards.length > 0 && featuredCards[0].uniqueOwners && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Featuring the most popular high-value cards from our community
            </p>
          )}
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="aspect-[5/7] bg-gray-200 dark:bg-gray-600 animate-pulse rounded-t-xl"></div>
                <div className="p-6">
                  <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded animate-pulse mb-3"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">Unable to load featured cards</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">{error}</p>
          </div>
        ) : featuredCards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">No featured cards available at the moment</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Check back soon as more users add cards to their collections!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredCards.map((card, index) => (
              <FeaturedCard key={card.printing_id || index} card={card} />
            ))}
          </div>
        )}
        
        <div className="text-center mt-12">
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
            {featuredCards.length > 0 
              ? "These are just a few examples. Our database has thousands of cards!" 
              : "Our database has thousands of cards from active traders!"
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700">
              <Link href="/signup" className="inline-flex items-center">
                Start Collecting Free <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [featuredCards, setFeaturedCards] = useState<any[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState<string | null>(null);

  // Auto-focus search input on desktop
  useEffect(() => {
    // Only auto-focus on desktop (screens wider than 768px)
    if (window.innerWidth >= 768) {
      searchInputRef.current?.focus();
    }
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
  const fetchFeaturedCards = async () => {
    try {
      setCardsLoading(true);
      const response = await fetch('/api/featured-cards');
      const data = await response.json();
      
      if (response.ok && data.success && data.cards && data.cards.length > 0) {
        setFeaturedCards(data.cards);
        setCardsError(null);
      } else if (response.status === 503) {
        // Cache not yet initialized - show friendly message
        console.log('Featured cards cache initializing...');
        setCardsError('Featured cards are being prepared. Please check back in a moment!');
        setFeaturedCards([]);
      } else {
        // Other error - use fallback cards
        console.log('Using fallback cards:', data.error || 'No cards returned');
        setFeaturedCards([
          {
            printing_id: "sample1",
            card_unique_id: "command-and-conquer",
            name: "Command and Conquer",
            set: "WTR",
            foiling: "r",
            rarity: "m",
            is_extended_art: false,
            tcg_market: 107.53,
            tcgplayer_url: "https://www.tcgplayer.com/product/198609",
            image_url: "https://storage.googleapis.com/fabmaster/cardfaces/2020-WTR/WTR001.png",
            uniqueOwners: 12
          },
          {
            printing_id: "sample2",
            card_unique_id: "enlightened-strike",
            name: "Enlightened Strike",
            set: "WTR",
            foiling: "r",
            rarity: "m",
            is_extended_art: false,
            tcg_market: 42.45,
            tcgplayer_url: "https://www.tcgplayer.com/product/198788",
            image_url: "https://storage.googleapis.com/fabmaster/cardfaces/2020-WTR/WTR159.png",
            uniqueOwners: 8
          },
          {
            printing_id: "sample3",
            card_unique_id: "blacktek-whisperers",
            name: "Blacktek Whisperers",
            set: "DYN",
            foiling: "s",
            rarity: "m",
            is_extended_art: false,
            tcg_market: 30.73,
            tcgplayer_url: "https://www.tcgplayer.com/product/291234",
            image_url: "https://storage.googleapis.com/fabmaster/cardfaces/2022-DYN/EN/DYN117.png",
            uniqueOwners: 6
          },
          {
            printing_id: "sample4",
            card_unique_id: "warmongers-diplomacy",
            name: "Warmonger's Diplomacy",
            set: "DTD",
            foiling: "s",
            rarity: "m",
            is_extended_art: false,
            tcg_market: 65.81,
            tcgplayer_url: "https://www.tcgplayer.com/product/346789",
            image_url: "https://storage.googleapis.com/fabmaster/cardfaces/2024-DTD/EN/DTD103.png",
            uniqueOwners: 4
          }
        ]);
        setCardsError(null);
      }
    } catch (err) {
      console.error('Failed to fetch featured cards:', err);
      setCardsError('Unable to connect to server');
      setFeaturedCards([]);
    } finally {
      setCardsLoading(false);
    }
  };
  
  fetchFeaturedCards();
}, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchInputRef.current?.value.trim();
    if (query) {
      // Navigate to search results page with the query
      const params = new URLSearchParams({
        q: query,
        priceField: 'tcg_low',
        limit: '24',
        sortBy: 'name',
        sortOrder: 'asc',
        show: 'summary',
        view: 'checklist'
      });
      router.push(`/search/results?${params.toString()}`);
    }
  };

  return (
    <main className="min-h-screen relative overflow-hidden">
      
      {/* Full Page Background Image */}
      <div className="absolute inset-0 w-full h-full opacity-380 z-0">
        <img 
          src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/9db6013d-6684-4ee4-bfb7-330b1c23a300/public" 
          alt="FaB Bazaar Trading Scene" 
          className="w-full h-full object-cover"
        />
      </div>
      
      {/* Background overlay for better readability */}
      <div className="absolute inset-0 bg-white/40 dark:bg-gray-900/80 backdrop-blur-[2px] z-0"></div>
      
      
      {/* Card Showcase as Primary Hero - Above the Fold */}
      <section className="relative z-10 px-6" style={{ minHeight: 'calc(100vh - 64px)' }}>
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {/* Branding Header */}
          <div className="text-center pt-6 mb-6">
            <div className="relative rounded-2xl overflow-hidden max-h-36 sm:max-h-44">

            </div>
          </div>

          {/* Spacer to push carousel to bottom */}
          <div className="flex-1"></div>

          {/* Search and Action Buttons Section - Above Carousel */}
          <div className="mb-6">
            {/* Search Form - Full Width */}
            <form onSubmit={handleSearch} className="w-full mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search cards by name or collector number..."
                  className="w-full pl-10 pr-4 py-6 border-2 border-slate-400 dark:border-gray-600 rounded-lg text-lg bg-white/95 dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-2xl shadow-black/20 dark:shadow-none"
                />
              </div>
            </form>

          </div>

          {/* Featured Cards - Horizontal Auto-Scrolling Carousel - Anchored to bottom of viewport */}
          <div className="mb-4 pb-6">
            {cardsLoading ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin"></div>
                  <span className="text-sm">Loading featured cards...</span>
                </div>
              </div>
            ) : cardsError ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">Unable to load featured cards</p>
              </div>
            ) : featuredCards.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No featured cards available at the moment</p>
              </div>
            ) : (
              <div className="animate-fade-in">
                <FeaturedCardsCarousel cards={featuredCards} />
              </div>
            )}
          </div>

          {/* Sign Up CTA - Mobile Only - Below Carousel */}
          <div className="sm:hidden text-center mt-2 mb-8">
            <Button asChild size="lg" className="text-lg px-8 py-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold">
              <Link href="/signup">
                Sign up for Free <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </div>

        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-6 bg-white/40 dark:bg-gray-900/80 backdrop-blur-[2px] relative z-10">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          {/* Hide text and button on mobile */}
          <p className="hidden sm:block text-xl text-gray-700 dark:text-gray-300">Find the cards you need from players near you</p>
          <div className="hidden sm:block">
            <Button asChild size="lg" className="text-lg px-8 py-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold">
              <Link href="/signup">
                Sign up for Free <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Desktop Video-Capable Ad - Shows at bottom on desktop only */}
      <DesktopAnchorAd />

      {/* Mobile Anchor Ad */}
      <MobileAnchorAd />
    </main>
  )
}
