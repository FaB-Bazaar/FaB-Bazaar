// app/wants/[userId]/page.tsx
"use client";

import React, { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Star,
  UserCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { fetchMetadata } from "@/lib/metadata-service";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { FOILING_MAP, RARITY_MAP, SET_MAP } from "@/lib/fab-constants";
import {
  getSetName,
  getRarityInfo,
  getFoilingInfo,
  getEditionInfo,
} from "@/lib/card-metadata";
import { SharedWantsCard } from '@/components/wants';
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { useCookieConsent } from '@/contexts/CookieConsentContext'

import { MobileAnchorAd } from "@/components/ads/mobile-anchor-ad"
import { DesktopAnchorAd } from "@/components/ads/desktop-anchor-ad"


const useWindowWidth = () => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    function handleResize() { setWidth(window.innerWidth); }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return width;
};

const AffiliateDisclosure = () => {
  const { consentOptions } = useCookieConsent()
  
  return (
    <div className="container mx-auto px-4 mt-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <img 
            src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
            alt="TCGPlayer"
            className="h-5 w-auto mt-0.5 flex-shrink-0"
          />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {consentOptions.advertising ? (
              <>
                TCGPlayer links on this page include affiliate tracking to help support this site. 
                You can adjust this in your <button 
                  onClick={() => document.dispatchEvent(new Event('openCookiePreferences'))}
                  className="underline hover:text-blue-900 dark:hover:text-blue-100"
                >
                  cookie preferences
                </button>.
              </>
            ) : (
              <>
                Help support this site by enabling affiliate tracking in your <button 
                  onClick={() => document.dispatchEvent(new Event('openCookiePreferences'))}
                  className="underline hover:text-blue-900 dark:hover:text-blue-100"
                >
                  cookie preferences
                </button>. This allows us to earn a small commission from TCGPlayer purchases at no extra cost to you.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}


const FilterChip = ({ label, isActive, onClick, onRemove }: any) => (
  <div
    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
      isActive
        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700"
        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
    }`}
  >
    <button onClick={onClick} className="hover:underline">
      {label}
    </button>
    {isActive && (
      <button
        onClick={onRemove}
        className="hover:text-red-600 dark:hover:text-red-400"
      >
        <X className="w-3 h-3" />
      </button>
    )}
  </div>
);

export default function SharedWantsListPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const [wantsList, setWantsList] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [activeFilters, setActiveFilters] = useState<any>({
    priority: null,
    rarity: null,
    foiling: null,
    set: null,
  });
  const [sortBy, setSortBy] = useState("price-high");
  const { toast } = useToast();
  const [metadata, setMetadata] = useState<any>(null);
  const [userName, setUserName] = useState<string>("");
  const [profileUsername, setProfileUsername] = useState<string>("");
  const { data: session } = useSession();
  const isOwnWantsList = session?.user?.id === userId;
  const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const windowWidth = useWindowWidth();

  // ========================================================================
  //     *** FIX #1: HEADER STATE DEFAULTS TO COLLAPSED (false) ***
  // ========================================================================
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);

  // --- Logic for fetching data, filtering, sorting, etc. (no changes) ---
  useEffect(() => {
    const fetchWantsList = async () => {
      try {
        setLoading(true);
        setError(null);
        const metadataResult = await fetchMetadata();
        setMetadata(metadataResult);
        let displayName = "User";
        let username = "";
        try {
          if (isOwnWantsList && session?.user?.name) {
            displayName = session.user.name;
            username = session.user.username || "";
          } else {
            const userResponse = await fetch(
              `/api/users/find?userId=${userId}`
            );
            if (userResponse.ok) {
              const userData = await userResponse.json();
              if (userData.success && userData.user) {
                username = userData.user.username || "";
                displayName =
                  userData.user.username ||
                  userData.user.name ||
                  userData.user.discordUsername ||
                  "User";
              }
            } else if (userResponse.status !== 401) {
              console.error("Failed to fetch user info:", userResponse.status);
            }
          }
        } catch (err) {
          console.log("Could not fetch user details");
        }
        const response = await fetch(`/api/wants/user/${userId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch wants list");
        }
        const data = await response.json();
        if (data.wantsList && displayName === "User") {
          displayName =
            data.wantsList.discordUsername ||
            data.wantsList.name?.replace("'s Wants List", "") ||
            "User";
        }
        // If we still don't have a username, try to extract from wantsList
        if (!username && data.wantsList?.username) {
          username = data.wantsList.username;
        }
        setUserName(displayName);
        setProfileUsername(username);
        setWantsList(data.wantsList);
      } catch (err: any) {
        console.error("Error fetching wants list:", err);
        setError(err.message || "Failed to load this wants list.");
      } finally {
        setLoading(false);
      }
    };
    fetchWantsList();
  }, [userId, isOwnWantsList, session]);
  const filteredCards = React.useMemo(() => {
    if (!wantsList?.cards) return [];
    return wantsList.cards.filter((card: any) => {
      const matchesSearch =
        !searchQuery ||
        card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (card.notes &&
          card.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPriority =
        !activeFilters.priority || card.priority === activeFilters.priority;
      const matchesRarity =
        !activeFilters.rarity ||
        card.printingDetails?.rarity === activeFilters.rarity ||
        card.rarity === activeFilters.rarity;
      const matchesFoiling =
        !activeFilters.foiling ||
        card.printingDetails?.foiling === activeFilters.foiling ||
        card.foiling === activeFilters.foiling;
      const matchesSet =
        !activeFilters.set ||
        card.printingDetails?.set === activeFilters.set ||
        card.set === activeFilters.set;
      return (
        matchesSearch &&
        matchesPriority &&
        matchesRarity &&
        matchesFoiling &&
        matchesSet
      );
    });
  }, [wantsList?.cards, searchQuery, activeFilters]);
  const sortedCards = React.useMemo(() => {
    if (!filteredCards) return [];
    return [...filteredCards].sort((a, b) => {
      if (sortBy === "price-high") {
        return (
          (b.printingDetails?.tcg_low || 0) - (a.printingDetails?.tcg_low || 0)
        );
      }
      if (sortBy === "price-low") {
        return (
          (a.printingDetails?.tcg_low || 0) - (b.printingDetails?.tcg_low || 0)
        );
      }
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "priority") {
        const order: any = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      }
      return 0;
    });
  }, [filteredCards, sortBy]);
  const getSetName = (code: string) =>
    SET_MAP[code?.toLowerCase() as keyof typeof SET_MAP] ||
    code?.toUpperCase() ||
    code;
  const getFoilingDisplayName = (code: string) => {
    if (!code || code === "S" || code === "N") return "Non-Foil";
    return FOILING_MAP[code?.toLowerCase() as keyof typeof FOILING_MAP] || code;
  };
  const getRarityDisplayName = (code: string) => {
    if (!code) return "";
    return RARITY_MAP[code?.toLowerCase() as keyof typeof RARITY_MAP] || code;
  };
  const handleCardSelect = (card: any) => {
    const existingIndex = selectedCards.findIndex((c) => c.id === card.id);
    if (existingIndex >= 0) {
      const updatedCards = [...selectedCards];
      const currentQty = updatedCards[existingIndex].quantity;
      const maxQty = card.quantity || 1;
      if (currentQty < maxQty) {
        updatedCards[existingIndex].quantity += 1;
        setSelectedCards(updatedCards);
      } else {
        toast({
          title: "Maximum quantity reached",
          description: `Only ${maxQty} available`,
        });
      }
    } else {
      setSelectedCards([
        ...selectedCards,
        { ...card, quantity: 1, maxQuantity: card.quantity || 1 },
      ]);
      if (selectedCards.length === 0) {
        setSidebarOpen(true);
      }
    }
  };
  const handleQuantityChange = (index: number, change: number) => {
    const updatedCards = [...selectedCards];
    const newQuantity = updatedCards[index].quantity + change;
    const maxQuantity = updatedCards[index].maxQuantity || 1;
    if (newQuantity > 0 && newQuantity <= maxQuantity) {
      updatedCards[index].quantity = newQuantity;
      setSelectedCards(updatedCards);
    } else if (newQuantity <= 0) {
      updatedCards.splice(index, 1);
      setSelectedCards(updatedCards);
      if (updatedCards.length === 0) {
        setSidebarOpen(false);
      }
    }
  };
  const handleRemoveCard = (index: number) => {
    const updatedCards = [...selectedCards];
    updatedCards.splice(index, 1);
    setSelectedCards(updatedCards);
    if (updatedCards.length === 0) {
      setSidebarOpen(false);
    }
  };
  const handleClearAll = () => {
    setSelectedCards([]);
    setSidebarOpen(false);
  };
  const getFormattedList = () =>
    selectedCards
      .map(
        (card) =>
          `${card.quantity}x ${card.printingDetails?.display_name || card.name}${
            card.printingDetails?.set || card.set
              ? ` (${getSetName(card.printingDetails?.set || card.set)}`
              : ""
          }${
            card.printingDetails?.rarity || card.rarity
              ? `, ${getRarityDisplayName(
                  card.printingDetails?.rarity || card.rarity
                )}`
              : ""
          }${
            card.printingDetails?.foiling || card.foiling
              ? `, ${getFoilingDisplayName(
                  card.printingDetails?.foiling || card.foiling
                )}`
              : ""
          })`
      )
      .join("\n");
  const handleCopyList = async () => {
    try {
      await navigator.clipboard.writeText(getFormattedList());
      setCopied(true);
      toast({ title: "List copied!" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };
  const isCardSelected = (cardId: string) =>
    selectedCards.some((card) => card.id === cardId);
  const getSelectedQuantity = (cardId: string) => {
    const card = selectedCards.find((card) => card.id === cardId);
    return card ? card.quantity : 0;
  };
  const setFilter = (type: string, value: string) => {
    setActiveFilters((prev: any) => ({
      ...prev,
      [type]: prev[type] === value ? null : value,
    }));
  };
  const clearFilter = (type: string) => {
    setActiveFilters((prev: any) => ({ ...prev, [type]: null }));
  };
  const clearAllFilters = () => {
    setActiveFilters({
      priority: null,
      rarity: null,
      foiling: null,
      set: null,
    });
    setSearchQuery("");
  };
  const activeFilterCount =
    Object.values(activeFilters).filter(Boolean).length + (searchQuery ? 1 : 0);
  const highPriorityCount =
    wantsList?.cards?.filter((card: any) => card.priority === "high").length ||
    0;
  const uniqueRarities =
    [
      ...new Set(
        wantsList?.cards
          ?.map((card: any) => card.printingDetails?.rarity || card.rarity)
          .filter(Boolean)
      ),
    ] || [];
  const uniqueFoilings =
    [
      ...new Set(
        wantsList?.cards
          ?.map((card: any) => card.printingDetails?.foiling || card.foiling)
          .filter(Boolean)
      ),
    ] || [];
  const uniqueSets =
    [
      ...new Set(
        wantsList?.cards
          ?.map((card: any) => card.printingDetails?.set || card.set)
          .filter(Boolean)
      ),
    ] || [];
  const getWantsListTitle = () => {
    if (isOwnWantsList) return "My Wants List";
    return `${userName}'s Wants List`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b shadow-sm dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-2">
            {profileUsername ? (
              <Link
                href={`/profile/${profileUsername}`}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 rounded-lg border border-blue-200 dark:border-blue-700 transition-all duration-200 group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                <UserCircle className="h-4 w-4" />
                <span>
                  <span className="font-medium">{userName}</span>
                  <span className="text-blue-600 dark:text-blue-400 ml-1">'s Profile</span>
                </span>
              </Link>
            ) : (
              <Link
                href="/"
                className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
              </Link>
            )}
            <DarkModeToggle />
          </div>

          <div className="flex items-center justify-between py-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {getWantsListTitle()}
            </h1>
            {/* ======================================================================== */}
            {/*     *** FIX #2: COLLAPSE BUTTON IS NOW VISIBLE ON ALL SCREENS ***      */}
            {/* The `sm:hidden` class has been removed.                            */}
            {/* ======================================================================== */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
              aria-label={
                isHeaderExpanded ? "Collapse header" : "Expand header"
              }
            >
              {isHeaderExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </Button>
          </div>

          <div
            className={cn(
              "transition-[max-height] duration-300 ease-in-out overflow-hidden",
              isHeaderExpanded ? "max-h-[500px]" : "max-h-0"
            )}
          >
            <div className="pt-2 pb-4">
              {!isOwnWantsList && (
                <p className="text-gray-500 dark:text-gray-400">
                  Click on cards you're interested in
                </p>
              )}
              <div className="relative my-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                <Input
                  placeholder="Search cards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-2">
                <button
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  className="flex items-center justify-center sm:justify-start gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-900 dark:text-gray-100"
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                  {filtersExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="default">Sort: Default</option>
                  <option value="priority">Sort: Priority</option>
                  <option value="price-high">Sort: Price (High to Low)</option>
                  <option value="price-low">Sort: Price (Low to High)</option>
                  <option value="name">Sort: Name</option>
                </select>
              </div>
              {filtersExpanded && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Priority:
                      </span>
                      <div className="flex gap-2 flex-wrap">
                        {["high", "medium", "low"].map((priority) => (
                          <FilterChip
                            key={priority}
                            label={`${
                              priority.charAt(0).toUpperCase() +
                              priority.slice(1)
                            } (${
                              wantsList?.cards?.filter(
                                (c: any) => c.priority === priority
                              ).length || 0
                            })`}
                            isActive={activeFilters.priority === priority}
                            onClick={() => setFilter("priority", priority)}
                            onRemove={() => clearFilter("priority")}
                          />
                        ))}
                      </div>
                    </div>
                    {uniqueRarities.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Rarity:
                        </span>
                        <div className="flex gap-2 flex-wrap">
                          {uniqueRarities.map((rarity) => (
                            <FilterChip
                              key={rarity}
                              label={`${getRarityDisplayName(rarity)} (${
                                wantsList?.cards?.filter(
                                  (c: any) =>
                                    (c.printingDetails?.rarity || c.rarity) ===
                                    rarity
                                ).length || 0
                              })`}
                              isActive={activeFilters.rarity === rarity}
                              onClick={() => setFilter("rarity", rarity)}
                              onRemove={() => clearFilter("rarity")}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {uniqueFoilings.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Foiling:
                        </span>
                        <div className="flex gap-2 flex-wrap">
                          {uniqueFoilings.map((foiling) => (
                            <FilterChip
                              key={foiling}
                              label={`${getFoilingDisplayName(foiling)} (${
                                wantsList?.cards?.filter(
                                  (c: any) =>
                                    (c.printingDetails?.foiling ||
                                      c.foiling) === foiling
                                ).length || 0
                              })`}
                              isActive={activeFilters.foiling === foiling}
                              onClick={() => setFilter("foiling", foiling)}
                              onRemove={() => clearFilter("foiling")}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {uniqueSets.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Set:
                        </span>
                        <div className="flex gap-2 flex-wrap">
                          {uniqueSets.map((set) => (
                            <FilterChip
                              key={set}
                              label={`${getSetName(set)} (${
                                wantsList?.cards?.filter(
                                  (c: any) =>
                                    (c.printingDetails?.set || c.set) === set
                                ).length || 0
                              })`}
                              isActive={activeFilters.set === set}
                              onClick={() => setFilter("set", set)}
                              onRemove={() => clearFilter("set")}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearAllFilters}
                        className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-4 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Showing {sortedCards.length} of{" "}
                  {wantsList?.cards?.length || 0} cards
                </span>
                <div className="flex gap-2 flex-wrap">
                  {selectedCards.length > 0 && !sidebarOpen && (
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                      onClick={() => setSidebarOpen(true)}
                    >
                      <ShoppingCart className="w-4 h-4 mr-1" /> View Selected (
                      {selectedCards.reduce(
                        (total, card) => total + card.quantity,
                        0
                      )}
                      )
                    </Button>
                  )}
                  {highPriorityCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilter("priority", "high")}
                      className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Star className="w-4 h-4 mr-1" /> High Priority (
                      {highPriorityCount})
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
       <AffiliateDisclosure />

      {error && (
        <div className="container mx-auto px-4 py-6">
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error as string}</AlertDescription>
          </Alert>
        </div>
      )}
      {loading ? (
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            Loading wants list...
          </p>
        </div>
      ) : wantsList?.cards?.length === 0 ? (
        <div className="container mx-auto px-4 py-12">
          <div className="text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
            <BookOpen className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">
              This wants list is empty
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              There are no cards in this wants list
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="container mx-auto px-2 py-6">

            {sortedCards.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">
                  No cards found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Try adjusting your search or filters
                </p>
                <Button
                  onClick={clearAllFilters}
                  variant="outline"
                  className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-1.5 transition-all duration-300"
                  style={{
                    paddingRight:
                      sidebarOpen && windowWidth >= 640 ? "320px" : "0px",
                  }}
                >
                {sortedCards.map((card) => {
                  const isSelected = isCardSelected(card.id);
                  const selectedQty = getSelectedQuantity(card.id);
                  const maxQty = card.quantity || 1;
                  return (
                    <SharedWantsCard
                      key={card.id}
                      card={card}
                      isSelected={isSelected}
                      selectedQty={selectedQty}
                      maxQty={maxQty}
                      onCardSelect={handleCardSelect}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
      <div
        ref={sidebarRef}
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-80 bg-white dark:bg-gray-800 shadow-lg z-50 transition-transform duration-300 transform",
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{ maxWidth: "100vw" }}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Selected Cards
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {selectedCards.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No cards selected</p>
                <p className="text-sm mt-2">Click on cards to add them</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedCards.map((card, index) => (
                  <div
                    key={card.id}
                    className="border border-gray-200 dark:border-gray-600 rounded-md p-2 bg-gray-50 dark:bg-gray-700"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {card.printingDetails?.display_name || card.name}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(card.printingDetails?.set || card.set) && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                            >
                              {getSetName(
                                card.printingDetails?.set || card.set
                              )}
                            </Badge>
                          )}
                          {(card.printingDetails?.rarity || card.rarity) && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                            >
                              {getRarityDisplayName(
                                card.printingDetails?.rarity || card.rarity
                              )}
                            </Badge>
                          )}
                          {(card.printingDetails?.foiling || card.foiling) && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                            >
                              {getFoilingDisplayName(
                                card.printingDetails?.foiling || card.foiling
                              )}
                            </Badge>
                          )}
                          {!card.printingId && (
                            <Badge
                              variant="secondary"
                              className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700 text-xs"
                            >
                              Any Version
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 dark:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCard(index);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center mt-2">
                      <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-md">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuantityChange(index, -1);
                          }}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm text-gray-900 dark:text-gray-100">
                          {card.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          disabled={card.quantity >= (card.maxQuantity || 1)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuantityChange(index, 1);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        {card.quantity}/{card.maxQuantity || 1} available
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between mb-2 text-gray-900 dark:text-gray-100">
              <span>Total Cards:</span>
              <span>
                {selectedCards.reduce(
                  (total, card) => total + card.quantity,
                  0
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleClearAll}
                disabled={selectedCards.length === 0}
                className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Clear All
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                onClick={handleCopyList}
                disabled={selectedCards.length === 0}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy List
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {selectedCards.length > 0 && !sidebarOpen && (
        <button
          className="fixed bottom-4 right-4 bg-red-600 text-white p-3 rounded-full shadow-lg hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors z-40"
          onClick={() => setSidebarOpen(true)}
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -top-2 -right-2 bg-white text-red-600 dark:bg-gray-800 dark:text-red-400 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
            {selectedCards.reduce((total, card) => total + card.quantity, 0)}
          </span>
        </button>
      )}

      {/* Desktop Video-Capable Ad - Shows at bottom on desktop only */}
      <DesktopAnchorAd />

      {/* Mobile Anchor Ad - Shows at bottom on mobile only */}
      <MobileAnchorAd />
    </div>
  );
}