"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, Search, MapPin, BookOpen, MessageCircle, Trophy } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { FeaturedCardsCarousel } from "@/components/shared/FeaturedCardsCarousel"

interface PublicArticle {
  publicId: string;
  title: string;
  subtitle?: string;
  image?: string;
  contentType: string;
}

// `image` arrives as a fully-resolved url (app/page.tsx resolves bare article
// image ids through lib/images/article-image). Never rebuild a url from an id
// here — printing_id-keyed CDN images were deleted 2026-07 and 404.

const CONTENT_TYPE_LABELS: Record<string, string> = {
  hero: 'Hero Guide',
  strategy: 'Strategy',
  article: 'Article',
  guide: 'Guide',
  news: 'News',
  tournament: 'Tournament',
};


const FALLBACK_CARDS = [
  {
    printing_id: "sample1", card_unique_id: "command-and-conquer",
    name: "Command and Conquer", set: "WTR", foiling: "r", rarity: "m", is_extended_art: false,
    tcg_market: 107.53, tcgplayer_url: "https://www.tcgplayer.com/product/198609",
    image_url: "https://storage.googleapis.com/fabmaster/cardfaces/2020-WTR/WTR001.png", uniqueOwners: 12
  },
  {
    printing_id: "sample2", card_unique_id: "enlightened-strike",
    name: "Enlightened Strike", set: "WTR", foiling: "r", rarity: "m", is_extended_art: false,
    tcg_market: 42.45, tcgplayer_url: "https://www.tcgplayer.com/product/198788",
    image_url: "https://storage.googleapis.com/fabmaster/cardfaces/2020-WTR/WTR159.png", uniqueOwners: 8
  },
  {
    printing_id: "sample3", card_unique_id: "blacktek-whisperers",
    name: "Blacktek Whisperers", set: "DYN", foiling: "s", rarity: "m", is_extended_art: false,
    tcg_market: 30.73, tcgplayer_url: "https://www.tcgplayer.com/product/291234",
    image_url: "https://storage.googleapis.com/fabmaster/cardfaces/2022-DYN/EN/DYN117.png", uniqueOwners: 6
  },
  {
    printing_id: "sample4", card_unique_id: "warmongers-diplomacy",
    name: "Warmonger's Diplomacy", set: "DTD", foiling: "s", rarity: "m", is_extended_art: false,
    tcg_market: 65.81, tcgplayer_url: "https://www.tcgplayer.com/product/346789",
    image_url: "https://storage.googleapis.com/fabmaster/cardfaces/2024-DTD/EN/DTD103.png", uniqueOwners: 4
  }
];

interface HomePageClientProps {
  articles: PublicArticle[];
}

export default function HomePageClient({ articles }: HomePageClientProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [featuredCards, setFeaturedCards] = useState<any[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);

  useEffect(() => {
    if (window.innerWidth >= 768) searchInputRef.current?.focus();
  }, []);

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
    fetch('/api/featured-cards')
      .then((r) => r.json())
      .then((data) => {
        const cards = data.success && data.cards?.length > 0 ? data.cards : FALLBACK_CARDS;
        // Per-pageload shuffle so the carousel rotates even when the API
        // response is served from a shared CDN cache (s-maxage=3600).
        const shuffled = [...cards];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setFeaturedCards(shuffled);
      })
      .catch(() => setFeaturedCards(FALLBACK_CARDS))
      .finally(() => setCardsLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchInputRef.current?.value.trim();
    if (query) {
      // /opt hydrates `q` on mount and runs the search; its default view is the
      // image grid, so switch to the checklist on wider screens.
      const params = new URLSearchParams({ q: query });
      if (window.innerWidth >= 768) params.set('view', 'checklist');
      router.push(`/opt?${params.toString()}`);
    }
  };

  return (
    <main className="bg-gray-50 dark:bg-gray-950" style={{ minHeight: 'calc(100vh - 64px)' }}>

      <div className="flex flex-col px-4 sm:px-6 pt-4 pb-6" style={{ minHeight: 'calc(100vh - 64px)' }}>

        {/* Carousel */}
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-600 dark:text-gray-500 mb-1.5">Featured Cards</p>
          {cardsLoading ? (
            <div className="flex items-center gap-2 py-4 text-gray-400 dark:text-gray-500">
              <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : (
            <FeaturedCardsCarousel cards={featuredCards} cardWidth={220} />
          )}
        </div>

        {/* Search bar */}
        <div className="mb-4">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search cards by name or collector number..."
                className="w-full pl-10 pr-4 py-6 border-2 border-slate-400 dark:border-gray-600 rounded-lg text-lg bg-white/95 dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-2xl shadow-black/20 dark:shadow-none"
              />
            </div>
          </form>
        </div>

        {/* Articles row */}
        {articles.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-gray-600 dark:text-gray-500" />
                <span className="text-xs font-medium uppercase tracking-widest text-gray-600 dark:text-gray-500">Latest Articles</span>
              </div>
              <Link href="/guides?tab=heroes" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {articles.map((article) => (
                <Link
                  key={article.publicId}
                  href={`/articles/${article.publicId}`}
                  className="group flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <div className="w-12 h-12 rounded overflow-hidden shrink-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600">
                    {article.image && (
                      <img src={article.image} alt={article.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {CONTENT_TYPE_LABELS[article.contentType] ?? article.contentType}
                    </span>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {article.title}
                    </p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                </Link>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Have something to share?{' '}
              <Link href="/my-articles" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                Publish your own article on FaB Bazaar →
              </Link>
            </p>
          </div>
        )}

        {/* Decks to Beat CTA */}
        <div className="mb-3">
          <Link
            href="/decks/to-beat"
            className="group flex items-center justify-between gap-4 py-3 px-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Decks to Beat</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Top competitive decks curated each month — Classic Constructed &amp; Silver Age.</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 shrink-0 group-hover:underline">
              View this month <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        </div>

        {/* Discord + Store finder row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Discord CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 px-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Join the community on Discord</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Trade, discuss, and manage your collection without leaving Discord.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              <Link href="/discord" className="inline-flex items-center text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors px-3 py-2 rounded-md">
                Learn more
              </Link>
              <a
                href="https://discord.gg/Rx8eBhhQtk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors px-3 py-2 rounded-md"
              >
                Join Discord <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Store finder */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 px-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Find Your Local Game Store</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Browse stores and venues hosting Flesh and Blood events near you.</p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="sm:shrink-0 w-fit">
              <Link href="/stores" className="flex items-center gap-1">
                Find a Store <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </div>
        </div>

      </div>

    </main>
  );
}
