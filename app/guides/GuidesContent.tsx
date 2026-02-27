'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowRight,
  Clock,
  Calendar,
  BookOpen,
  Swords,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  Trophy,
} from 'lucide-react';
import { HERO_INFO } from '@/lib/fab-constants';
import type { EnrichedArticle } from './page';
import { MobileAnchorAd } from "@/components/ads/mobile-anchor-ad";
import { DesktopAnchorAd } from "@/components/ads/desktop-anchor-ad";

// Extract unique classes from HERO_INFO
const HERO_CLASSES = [
  'assassin',
  'brute',
  'guardian',
  'illusionist',
  'mechanologist',
  'necromancer',
  'ninja',
  'ranger',
  'runeblade',
  'warrior',
  'wizard',
] as const;

// Get heroes by class from HERO_INFO
function getHeroesByClass(heroClass: string): string[] {
  return Object.entries(HERO_INFO)
    .filter(([_, info]) => info.classes.includes(heroClass as any))
    .map(([name]) => name)
    .sort();
}

// Format hero name for display (title case)
function formatHeroName(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Format class name for display
function formatClassName(className: string): string {
  return className.charAt(0).toUpperCase() + className.slice(1);
}

// Format date for display
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Get content type badge styling
function getContentTypeBadge(contentType: string): { label: string; className: string } {
  const types: Record<string, { label: string; className: string }> = {
    hero: {
      label: 'Hero Guide',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-blue-200 dark:border-blue-800'
    },
    article: {
      label: 'Article',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200 border-gray-200 dark:border-gray-700'
    },
    guide: {
      label: 'Guide',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border-green-200 dark:border-green-800'
    },
    news: {
      label: 'News',
      className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 border-orange-200 dark:border-orange-800'
    },
    tournament: {
      label: 'Tournament Report',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-200 dark:border-amber-800'
    },
  };
  return types[contentType] || {
    label: 'Article',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
  };
}

// Article Card Component
function ArticleCard({ article }: { article: EnrichedArticle }) {
  const badge = getContentTypeBadge(article.contentType);
  const href = article.contentType === 'hero' ? `/heroes/${article.publicId}` : `/articles/${article.publicId}`;
  const authorInitial = (article.author.username || article.author.discordUsername || 'A').charAt(0).toUpperCase();

  return (
    <Link href={href} className="block group">
      <Card className="h-full transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-1 group-hover:border-primary overflow-hidden">
        {/* Image with badge overlay */}
        <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
          {article.image ? (
            <img
              src={`https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${article.image}/public`}
              alt={article.title}
              className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {article.contentType === 'hero' ? (
                <BookOpen className="h-12 w-12 text-slate-300 dark:text-slate-600" />
              ) : (
                <Swords className="h-12 w-12 text-slate-300 dark:text-slate-600" />
              )}
            </div>
          )}
          <Badge className={`absolute top-3 left-3 ${badge.className} border`}>
            {badge.label}
          </Badge>
          {article.isUserArticle && (
            <Badge className="absolute top-3 right-3 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-[10px]">
              {article.promoted ? '⭐ Featured' : 'Community'}
            </Badge>
          )}
        </div>

        <CardHeader className="pb-2">
          <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-2">
            {article.title}
          </CardTitle>
          {article.subtitle && (
            <CardDescription className="line-clamp-2 mt-1">
              {article.subtitle}
            </CardDescription>
          )}
        </CardHeader>

        {/* Metadata footer */}
        <CardFooter className="pt-3 pb-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {authorInitial}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {article.author.username || article.author.discordUsername || 'Anonymous'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {article.createdAt && (
                <span>{formatDate(article.createdAt)}</span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {article.readTime}m
              </span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}

interface GuidesContentProps {
  articles: EnrichedArticle[];
}

export function GuidesContent({ articles }: GuidesContentProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedHero, setSelectedHero] = useState<string | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('all');

  // Get heroes for the selected class
  const heroesForClass = useMemo(() => {
    if (!selectedClass) return [];
    return getHeroesByClass(selectedClass);
  }, [selectedClass]);

  // Filter articles based on tab and hero selection
  const filteredArticles = useMemo(() => {
    let filtered = articles;

    // First filter by tab (check both contentType and categories)
    if (activeTab === 'heroes') {
      filtered = filtered.filter(a => a.contentType === 'hero');
    } else if (activeTab === 'tournaments') {
      // Show articles where contentType is 'tournament' OR categories includes 'tournament'
      filtered = filtered.filter(a =>
        a.contentType === 'tournament' || a.categories?.includes('tournament')
      );
    } else if (activeTab === 'strategy') {
      // Show articles where contentType is 'article' OR categories includes 'strategy'
      filtered = filtered.filter(a =>
        a.contentType === 'article' || a.categories?.includes('strategy')
      );
    }

    // Then apply hero class/hero filters
    if (activeTab === 'all' || activeTab === 'heroes' || activeTab === 'tournaments') {
      filtered = filtered.filter(article => {
        // Apply filters to hero guides and tournament reports with hero info
        const isHeroGuide = article.contentType === 'hero';
        const isTournamentWithHero = (article.contentType === 'tournament' || article.categories?.includes('tournament')) &&
                                     (article.heroSlug || article.heroClass);

        // Skip filtering for articles that aren't hero-related
        if (!isHeroGuide && !isTournamentWithHero) return true;

        if (selectedHero) {
          return article.heroSlug?.toLowerCase() === selectedHero.toLowerCase();
        }
        if (selectedClass) {
          return article.heroClass?.toLowerCase() === selectedClass.toLowerCase();
        }
        return true;
      });
    }

    return filtered;
  }, [articles, selectedClass, selectedHero, activeTab]);

  // Separate by content type (check both contentType and categories)
  const heroGuides = filteredArticles.filter(a => a.contentType === 'hero');
  const tournamentReports = filteredArticles.filter(a =>
    a.contentType === 'tournament' || a.categories?.includes('tournament')
  );
  const strategyArticles = filteredArticles.filter(a =>
    a.contentType === 'article' || a.categories?.includes('strategy')
  );

  // Get featured article: promoted user articles first, then admin articles
  const featuredArticle = articles.find(a => a.promoted) || articles.find(a => !a.isUserArticle) || null;
  const remainingHeroGuides = featuredArticle?.contentType === 'hero'
    ? heroGuides.filter(a => a._id !== featuredArticle._id)
    : heroGuides;

  // Featured article badge
  const featuredBadge = featuredArticle ? getContentTypeBadge(featuredArticle.contentType) : null;
  const featuredIdentifier = featuredArticle?.publicId || '';
  const featuredHref = featuredArticle
    ? (featuredArticle.contentType === 'hero' ? `/heroes/${featuredArticle.publicId}` : `/articles/${featuredArticle.publicId}`)
    : '';
  const featuredAuthorInitial = featuredArticle
    ? (featuredArticle.author.username || featuredArticle.author.discordUsername || 'A').charAt(0).toUpperCase()
    : 'A';

  const toggleClassExpanded = (className: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(className)) {
        next.delete(className);
      } else {
        next.add(className);
      }
      return next;
    });
  };

  const handleClassSelect = (className: string) => {
    if (selectedClass === className) {
      // Deselect
      setSelectedClass(null);
      setSelectedHero(null);
    } else {
      setSelectedClass(className);
      setSelectedHero(null);
      // Auto-expand the class
      setExpandedClasses(prev => new Set(prev).add(className));
    }
  };

  const handleHeroSelect = (heroName: string) => {
    if (selectedHero === heroName) {
      setSelectedHero(null);
    } else {
      setSelectedHero(heroName);
    }
  };

  const clearFilters = () => {
    setSelectedClass(null);
    setSelectedHero(null);
  };

  // Clear filters when switching to non-hero tabs
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'tournaments' || value === 'strategy') {
      clearFilters();
    }
  };

  const hasActiveFilters = selectedClass || selectedHero;
  const showSidebar = activeTab === 'all' || activeTab === 'heroes' || activeTab === 'tournaments';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <header className="mb-8 text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Guides & Articles
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            In-depth hero guides, strategy breakdowns, and community insights to level up your game.
          </p>
        </header>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full max-w-7xl mx-auto">
          <TabsList className="grid w-full grid-cols-4 mb-8 max-w-2xl mx-auto h-auto">
            <TabsTrigger value="all" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800">
              All
            </TabsTrigger>
            <TabsTrigger value="heroes" className="data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50">
              <BookOpen className="h-4 w-4 mr-1 hidden sm:inline" />
              <span className="hidden sm:inline">Hero Guides</span>
              <span className="sm:hidden">Heroes</span>
            </TabsTrigger>
            <TabsTrigger value="tournaments" className="data-[state=active]:bg-amber-100 dark:data-[state=active]:bg-amber-900/50">
              <Trophy className="h-4 w-4 mr-1 hidden sm:inline" />
              <span className="hidden sm:inline">Tournaments</span>
              <span className="sm:hidden">Events</span>
            </TabsTrigger>
            <TabsTrigger value="strategy" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/50">
              <Swords className="h-4 w-4 mr-1 hidden sm:inline" />
              <span className="hidden sm:inline">Strategy</span>
              <span className="sm:hidden">Strategy</span>
            </TabsTrigger>
          </TabsList>

        {articles.length === 0 ? (
          <div className="text-center py-16 max-w-4xl mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              <BookOpen className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-lg text-muted-foreground">
              No content has been published yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="flex gap-8 max-w-7xl mx-auto">
            {/* Collapsible Sidebar - Only show on 'all' and 'heroes' tabs */}
            {showSidebar && (
              <aside
                className={`${
                  sidebarOpen ? 'w-64' : 'w-12'
                } flex-shrink-0 transition-all duration-300 hidden lg:block`}
              >
              <div className="sticky top-24">
                {/* Sidebar Toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="mb-4 w-full justify-start"
                >
                  <Filter className="h-4 w-4" />
                  {sidebarOpen && <span className="ml-2">Filters</span>}
                </Button>

                {sidebarOpen && (
                  <div className="bg-white dark:bg-gray-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    {/* Clear Filters */}
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="w-full justify-between mb-4 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Clear filters
                        <X className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Class Filter */}
                    <div className="space-y-1">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-2">
                        {activeTab === 'tournaments' ? 'Filter by Hero' : 'Filter by Class'}
                      </h3>
                      {activeTab === 'tournaments' && (
                        <p className="text-xs text-muted-foreground mb-3">
                          Find tournament reports featuring specific heroes
                        </p>
                      )}

                      {HERO_CLASSES.map(className => {
                        const isSelected = selectedClass === className;
                        const isExpanded = expandedClasses.has(className);
                        const heroes = getHeroesByClass(className);

                        return (
                          <div key={className}>
                            <button
                              onClick={() => handleClassSelect(className)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                                isSelected
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span>{formatClassName(className)}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleClassExpanded(className);
                                }}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                              </button>
                            </button>

                            {/* Heroes within class */}
                            {isExpanded && (
                              <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                                {heroes.map(heroName => {
                                  const isHeroSelected = selectedHero === heroName;
                                  return (
                                    <button
                                      key={heroName}
                                      onClick={() => handleHeroSelect(heroName)}
                                      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                        isHeroSelected
                                          ? 'bg-primary/10 text-primary font-medium'
                                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                                      }`}
                                    >
                                      {formatHeroName(heroName)}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              </aside>
            )}

            {/* Main Content */}
            <main className={`flex-1 min-w-0 ${!showSidebar ? 'mx-auto max-w-6xl' : ''}`}>
              {/* Mobile Filter Toggle - Only show on 'all', 'heroes', and 'tournaments' tabs */}
              {showSidebar && (
                <div className="lg:hidden mb-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="w-full"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {hasActiveFilters
                    ? `Filters (${selectedClass || ''}${selectedHero ? `: ${formatHeroName(selectedHero)}` : ''})`
                    : activeTab === 'tournaments'
                    ? 'Filter by Hero'
                    : 'Filter by Class'}
                </Button>

                {/* Mobile filter panel */}
                {sidebarOpen && (
                  <div className="mt-4 bg-white dark:bg-gray-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    {activeTab === 'tournaments' && (
                      <p className="text-xs text-muted-foreground mb-3">
                        Find tournament reports featuring specific heroes
                      </p>
                    )}
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="w-full justify-between mb-4 text-sm"
                      >
                        Clear filters
                        <X className="h-4 w-4" />
                      </Button>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {HERO_CLASSES.map(className => (
                        <Badge
                          key={className}
                          variant={selectedClass === className ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => handleClassSelect(className)}
                        >
                          {formatClassName(className)}
                        </Badge>
                      ))}
                    </div>

                    {selectedClass && heroesForClass.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Heroes:</p>
                        <div className="flex flex-wrap gap-2">
                          {heroesForClass.map(heroName => (
                            <Badge
                              key={heroName}
                              variant={selectedHero === heroName ? 'default' : 'secondary'}
                              className="cursor-pointer text-xs"
                              onClick={() => handleHeroSelect(heroName)}
                            >
                              {formatHeroName(heroName)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </div>
              )}

              {/* Active filters display */}
              {showSidebar && hasActiveFilters && (
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  <span className="text-sm text-muted-foreground">Filtering:</span>
                  {selectedClass && (
                    <Badge variant="secondary" className="gap-1">
                      {formatClassName(selectedClass)}
                      {!selectedHero && (
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => {
                            setSelectedClass(null);
                            setSelectedHero(null);
                          }}
                        />
                      )}
                    </Badge>
                  )}
                  {selectedHero && (
                    <Badge variant="secondary" className="gap-1">
                      {formatHeroName(selectedHero)}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => setSelectedHero(null)}
                      />
                    </Badge>
                  )}
                </div>
              )}

              <div className="space-y-16">
                {/* Featured Article Hero (only show on 'all' tab when no filters active) */}
                {activeTab === 'all' && !hasActiveFilters && featuredArticle && (
                  <section>
                    <Link href={featuredHref} className="block group">
                      <div className="relative overflow-hidden rounded-2xl">
                        {/* Background */}
                        <div className="absolute inset-0">
                          {featuredArticle.image ? (
                            <img
                              src={`https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${featuredArticle.image}/public`}
                              alt={featuredArticle.title}
                              className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900" />
                          )}
                        </div>

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />

                        {/* Content */}
                        <div className="relative z-10 p-8 md:p-12 min-h-[500px] md:min-h-[550px] flex flex-col justify-end">
                          {featuredBadge && (
                            <Badge className={`w-fit ${featuredBadge.className} border mb-4`}>
                              {featuredBadge.label}
                            </Badge>
                          )}

                          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 group-hover:text-blue-200 transition-colors">
                            {featuredArticle.title}
                          </h2>

                          {featuredArticle.subtitle && (
                            <p className="text-lg md:text-xl text-gray-300 mb-6 line-clamp-2 max-w-3xl">
                              {featuredArticle.subtitle}
                            </p>
                          )}

                          {/* Metadata row */}
                          <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm text-gray-400 mb-6">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8 border-2 border-white/20">
                                <AvatarFallback className="bg-white/10 text-white text-sm font-medium">
                                  {featuredAuthorInitial}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-gray-200 font-medium">
                                {featuredArticle.author.username || featuredArticle.author.discordUsername || 'Anonymous'}
                              </span>
                            </div>

                            {featuredArticle.createdAt && (
                              <>
                                <span className="hidden md:inline text-gray-500">|</span>
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-4 w-4" />
                                  <span>{formatDate(featuredArticle.createdAt)}</span>
                                </div>
                              </>
                            )}

                            <span className="hidden md:inline text-gray-500">|</span>
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-4 w-4" />
                              <span>{featuredArticle.readTime} min read</span>
                            </div>
                          </div>

                          {/* CTA Button */}
                          <div>
                            <span className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-lg font-semibold group-hover:bg-gray-100 transition-colors">
                              Read {featuredArticle.contentType === 'hero' ? 'Guide' : 'Article'}
                              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </section>
                )}

                {/* Hero Guides Section */}
                {(activeTab === 'all' || activeTab === 'heroes') && (hasActiveFilters ? heroGuides : remainingHeroGuides).length > 0 && (
                  <section>
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                        <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200">
                          Hero Guides
                          {hasActiveFilters && (
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                              ({heroGuides.length} {heroGuides.length === 1 ? 'guide' : 'guides'})
                            </span>
                          )}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Master your favorite heroes with in-depth guides
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {(hasActiveFilters ? heroGuides : remainingHeroGuides).map((article) => (
                        <ArticleCard key={article._id} article={article} />
                      ))}
                    </div>
                  </section>
                )}

                {/* No results message for hero guides */}
                {(activeTab === 'all' || activeTab === 'heroes') && hasActiveFilters && heroGuides.length === 0 && (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                      <BookOpen className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-muted-foreground">
                      No hero guides found for {selectedHero ? formatHeroName(selectedHero) : formatClassName(selectedClass || '')}.
                    </p>
                    <Button
                      variant="link"
                      onClick={clearFilters}
                      className="mt-2"
                    >
                      Clear filters
                    </Button>
                  </div>
                )}

                {/* Empty state for heroes tab */}
                {activeTab === 'heroes' && !hasActiveFilters && heroGuides.length === 0 && (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                      <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Hero Guides Yet</h3>
                    <p className="text-muted-foreground">
                      Check back soon for in-depth hero guides!
                    </p>
                  </div>
                )}

                {/* Empty state for tournaments tab */}
                {activeTab === 'tournaments' && tournamentReports.length === 0 && !hasActiveFilters && (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
                      <Trophy className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Tournament Reports Yet</h3>
                    <p className="text-muted-foreground">
                      Check back soon for player experiences from competitive events!
                    </p>
                  </div>
                )}

                {/* No results message for filtered tournaments */}
                {activeTab === 'tournaments' && hasActiveFilters && tournamentReports.length === 0 && (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
                      <Trophy className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-muted-foreground">
                      No tournament reports found for {selectedHero ? formatHeroName(selectedHero) : formatClassName(selectedClass || '')}.
                    </p>
                    <Button
                      variant="link"
                      onClick={clearFilters}
                      className="mt-2"
                    >
                      Clear filters
                    </Button>
                  </div>
                )}

                {/* Empty state for strategy tab */}
                {activeTab === 'strategy' && strategyArticles.length === 0 && (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
                      <Swords className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Strategy Articles Yet</h3>
                    <p className="text-muted-foreground">
                      Check back soon for gameplay tips and competitive insights!
                    </p>
                  </div>
                )}

                {/* Tournament Reports Section */}
                {(activeTab === 'all' || activeTab === 'tournaments') && tournamentReports.length > 0 && (
                  <section>
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                        <Trophy className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200">
                          Tournament Reports
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Player experiences from competitive events
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {tournamentReports.map((article) => (
                        <ArticleCard key={article._id} article={article} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Strategy Articles Section */}
                {(activeTab === 'all' || activeTab === 'strategy') && strategyArticles.length > 0 && (
                  <section>
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                        <Swords className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200">
                          Strategy Articles
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Gameplay tips, meta analysis, and competitive insights
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {strategyArticles.map((article) => (
                        <ArticleCard key={article._id} article={article} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </main>
          </div>
        )}
        </Tabs>
      </div>

      {/* Desktop Video-Capable Ad - Shows at bottom on desktop only */}
      <DesktopAnchorAd className="overflow-hidden" />

      {/* Mobile Anchor Ad - Shows at bottom on mobile only */}
      <MobileAnchorAd />
    </div>
  );
}
