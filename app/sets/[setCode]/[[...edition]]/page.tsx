"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { FeaturedCardsCarousel } from "@/components/shared/FeaturedCardsCarousel"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSetMetadata, hasFirstEdition } from '@/lib/fab-constants'
import { getSetImageUrl } from "@/lib/set-images"
import { languageFlag } from "@/lib/utils/printing-language"
import { useAuth } from "@/contexts/AuthContext"
import AddSetToBinderDialog from "@/components/sets/AddSetToBinderDialog"

// Get the edition code based on set and edition parameter
function getEditionCode(setCode: string, editionParam?: string): string {
  // Special case: EVR only has first edition
  if (setCode === 'evr') {
    return 'f'; // Always return first edition for EVR
  }

  // If no edition specified, return default
  if (!editionParam) {
    // Default to unlimited for sets with first edition, normal for others
    return hasFirstEdition(setCode) ? 'u' : 'n';
  }

  // If '1st' is specified
  if (editionParam === '1st') {
    // WTR uses 'a' for alpha, others use 'f' for first
    return setCode === 'wtr' ? 'a' : 'f';
  }

  // Otherwise return the edition as-is (allows for future flexibility)
  return editionParam;
}

// Get human-readable edition name
function getEditionName(setCode: string, editionCode: string): string {
  // Special case: EVR should show "First Edition" but not in the header
  // since it's the only edition available
  if (setCode === 'evr') return '';

  if (editionCode === 'a') return 'Alpha Edition';
  if (editionCode === 'f') return 'First Edition';
  if (editionCode === 'u') return 'Unlimited Edition';
  if (editionCode === 'n') return '';
  return editionCode.toUpperCase();
}

export default function SetPage() {
  // Get params synchronously via useParams hook (idiomatic for client components)
  const params = useParams<{ setCode: string; edition?: string[] }>();
  const { user } = useAuth();
  const setCode = ((params.setCode as string) ?? '').toLowerCase();
  const editionParam = Array.isArray(params.edition) ? params.edition[0] : undefined;

  // Derive values with useMemo (not useState) to avoid flicker
  const editionCode = useMemo(
    () => (setCode ? getEditionCode(setCode, editionParam) : ''),
    [setCode, editionParam]
  );

  const editionName = useMemo(
    () => (setCode && editionCode ? getEditionName(setCode, editionCode) : ''),
    [setCode, editionCode]
  );

  const setInfo = useMemo(() => {
    if (!setCode) return undefined;
    const metadata = getSetMetadata(setCode);
    if (metadata) {
      return {
        name: metadata.name,
        released: metadata.releaseDate,
        defaultRarity: metadata.defaultRarity,
      };
    }
    return {
      name: setCode.toUpperCase(),
      released: '',
      defaultRarity: undefined,
    };
  }, [setCode]);

  // State for dynamic values
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<string>('');
  const [selectedFoiling, setSelectedFoiling] = useState<string>('');
  const [imageError, setImageError] = useState(false);
  // TCGplayer packs present in this set (e.g. GEM's seasonal packs). Empty for
  // ordinary sets, which hides the pack filter. selectedPack is a group id.
  const [packs, setPacks] = useState<{ groupId: number; name: string; count: number }[]>([]);
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  // Printing languages present in this set. The flag filter renders only when
  // there's more than one; each page defaults to English.
  const [languages, setLanguages] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  // Initialize rarity/foiling defaults when setCode/setInfo changes
  useEffect(() => {
    if (!setCode) return;

    // Reset image error when setCode changes
    setImageError(false);

    // Set default rarity - use set-specific default or fall back to Legendary
    // Legendary loads faster and provides better UX than "All Cards"
    setSelectedRarity(setInfo?.defaultRarity || 'L');

    // Default to Non Foil for FAB (Promos) set since there's no "All" button
    if (setCode === 'fab') {
      setSelectedFoiling('s');
    } else {
      setSelectedFoiling('');
    }
    setSelectedPack(null);
    setSelectedLanguage('en');
  }, [setCode, setInfo?.defaultRarity]);

  // Load the printing languages present in this set (for the conditional flag filter)
  useEffect(() => {
    if (!setCode) { setLanguages([]); return; }
    let cancelled = false;
    fetch(`/api/sets/${setCode}/languages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.success) return;
        setLanguages(d.data);
        // Defensive: if a set somehow has no English printings, fall back to
        // its first available language so the default view isn't empty
        if (d.data.length > 0 && !d.data.includes('en')) {
          setSelectedLanguage(d.data[0]);
        }
      })
      .catch(() => { /* non-fatal: just no language filter */ });
    return () => { cancelled = true; };
  }, [setCode]);

  // Load the TCGplayer packs present in this set (for the conditional pack filter)
  useEffect(() => {
    if (!setCode) { setPacks([]); return; }
    let cancelled = false;
    fetch(`/api/sets/${setCode}/packs`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.success) setPacks(d.data); })
      .catch(() => { /* non-fatal: just no pack filter */ });
    return () => { cancelled = true; };
  }, [setCode]);

  // Fetch cards with cancellation support
  useEffect(() => {
    // Don't fetch until setCode is available
    if (!setCode || !editionCode) return;

    const abortController = new AbortController();
    let isCancelled = false;

    const fetchTopCards = async () => {
      try {
        setLoading(true);
        setError(null);

        // Build query parameters
        const queryParams: Record<string, string> = {
          sets: setCode.toUpperCase(),
          editions: editionCode,
          sortBy: 'collector_number',
          sortOrder: 'asc'
        };

        // For gem and fab (promos) sets, use foiling filter; otherwise use rarity filter
        if (setCode === 'gem' || setCode === 'fab') {
          if (selectedFoiling) {
            queryParams.foilings = selectedFoiling;
          }
        } else {
          if (selectedRarity) {
            queryParams.rarities = selectedRarity;
          }
        }

        // Pack (TCGplayer group) filter — e.g. a single GEM seasonal pack
        if (selectedPack != null) {
          queryParams.tcgGroup = String(selectedPack);
        }

        // One language at a time; defaults to English on every page
        queryParams.languages = selectedLanguage;

        // Get all cards in the set (no limit)
        queryParams.limit = '1000';

        const response = await fetch(
          `/api/search/core?${new URLSearchParams(queryParams)}`,
          { signal: abortController.signal }
        );

        // Check if cancelled before processing response
        if (isCancelled) return;

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        // Check if cancelled before updating state
        if (isCancelled) return;

        if (data.success && data.data.printings) {
          // Map to match the expected card format
          const mappedCards = data.data.printings.map((printing: any) => ({
            printing_id: printing.printing_id,
            card_unique_id: printing.card_unique_id,
            name: printing.display_name || printing.name,
            set: printing.set,
            collector_number: printing.collector_number,
            edition: printing.edition,
            foiling: printing.foiling,
            rarity: printing.rarity,
            is_extended_art: printing.is_extended_art,
            art_variations: printing.art_variations ?? [],
            foil_inset_top: printing.foil_inset_top ?? null,
            foil_inset_right: printing.foil_inset_right ?? null,
            foil_inset_bottom: printing.foil_inset_bottom ?? null,
            foil_inset_left: printing.foil_inset_left ?? null,
            foil_inset_round: printing.foil_inset_round ?? null,
            tcgplayer_url: printing.tcgplayer_url,
            tcg_low: printing.tcg_low,
            tcg_market: printing.tcg_low || printing.tcg_market,
            image_url: printing.image_url,
          }));

          setCards(mappedCards);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') return;

        // Only update state if not cancelled
        if (!isCancelled) {
          console.error('Failed to fetch top cards for set:', setCode, 'edition:', editionCode, err);
          setError(err instanceof Error ? err.message : 'Failed to load cards');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchTopCards();

    // Cleanup: cancel request on unmount or dependency change
    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [setCode, editionCode, selectedRarity, selectedFoiling, selectedPack, selectedLanguage]);

  return (
    <main className="min-h-screen bg-gray-200 dark:bg-page">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 pt-2 pb-2">
        {/* Back Button */}
        <div className="mb-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </Button>
        </div>

        {/* Set Image - Centered (only show if no error) */}
        {setCode && !imageError && (
          <div className="mb-2 flex justify-center">
            <img
              src={getSetImageUrl(setCode)}
              alt={setInfo?.name || setCode.toUpperCase()}
              className="max-w-md w-full h-auto rounded-lg shadow-lg"
              onError={() => setImageError(true)}
            />
          </div>
        )}

        <div className="text-center mb-3">
          {/* Show set name if no image or image failed to load */}
          {imageError && (
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {setInfo ? setInfo.name : setCode.toUpperCase()}
            </h1>
          )}
          {editionName && (
            <p className="text-lg text-gray-700 dark:text-gray-300 font-medium">
              {editionName}
            </p>
          )}
          {/* Don't show release date for GEM (evergreen set) */}
          {setInfo && setCode !== 'gem' && setInfo.released && (
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Released: {new Date(setInfo.released).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC'
              })}
            </p>
          )}

          {/* Edition Toggle for applicable sets (exclude EVR as it only has first edition) */}
          {hasFirstEdition(setCode) && setCode !== 'evr' && (
            <div className="flex gap-2 justify-center mt-4">
              <Button
                asChild
                variant={!editionParam ? "default" : "outline"}
                size="sm"
              >
                <Link href={`/sets/${setCode}`}>
                  Unlimited
                </Link>
              </Button>
              <Button
                asChild
                variant={editionParam === '1st' ? "default" : "outline"}
                size="sm"
              >
                <Link href={`/sets/${setCode}/1st`}>
                  {setCode === 'wtr' ? 'Alpha' : 'First Edition'}
                </Link>
              </Button>
            </div>
          )}

          {/* Filter - Foiling for GEM and FAB sets, Rarity for others */}
          <div className="mt-4 flex flex-col items-center gap-2">
            {/* Pack filter — only for sets split across TCGplayer groups (e.g. GEM) */}
            {packs.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant={selectedPack === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPack(null)}
                  aria-pressed={selectedPack === null}
                >
                  All Packs
                </Button>
                {packs.map((p) => (
                  <Button
                    key={p.groupId}
                    variant={selectedPack === p.groupId ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPack(p.groupId)}
                    aria-pressed={selectedPack === p.groupId}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 justify-center">
              {setCode === 'gem' ? (
                // Foiling filter for GEM set (no Gold Foil)
                <>
                  <Button
                    variant={selectedFoiling === '' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFoiling('')}
                  >
                    All
                  </Button>
                  <Button
                    variant={selectedFoiling === 's' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFoiling('s')}
                  >
                    Non Foil
                  </Button>
                  <Button
                    variant={selectedFoiling === 'r' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFoiling('r')}
                  >
                    Rainbow Foil
                  </Button>
                  <Button
                    variant={selectedFoiling === 'c' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFoiling('c')}
                  >
                    Cold Foil
                  </Button>
                </>
              ) : setCode === 'fab' ? (
                // Foiling filter for FAB (Promos) set (has Gold Foil, no "All")
                <>
                  <Button
                    variant={selectedFoiling === 's' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFoiling('s')}
                  >
                    Non Foil
                  </Button>
                  <Button
                    variant={selectedFoiling === 'r' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFoiling('r')}
                  >
                    Rainbow Foil
                  </Button>
                  <Button
                    variant={selectedFoiling === 'c' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFoiling('c')}
                  >
                    Cold Foil
                  </Button>
                  <Button
                    variant={selectedFoiling === 'g' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFoiling('g')}
                  >
                    Gold Foil
                  </Button>
                </>
              ) : (
                // Rarity filter for other sets
                <>
                  <Button
                    variant={selectedRarity === '' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedRarity('')}
                  >
                    All
                  </Button>
                  <Button
                    variant={selectedRarity === 'L' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedRarity('L')}
                  >
                    Legendary
                  </Button>
                  <Button
                    variant={selectedRarity === 'M' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedRarity('M')}
                  >
                    Majestic
                  </Button>
                  <Button
                    variant={selectedRarity === 'R' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedRarity('R')}
                  >
                    Rare
                  </Button>
                  <Button
                    variant={selectedRarity === 'F' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedRarity('F')}
                  >
                    Fabled
                  </Button>
                  {/* Super Rare only appears in WTR, ARC, and SUP */}
                  {(setCode === 'wtr' || setCode === 'arc' || setCode === 'sup') && (
                    <Button
                      variant={selectedRarity === 'S' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedRarity('S')}
                    >
                      Super Rare
                    </Button>
                  )}
                </>
              )}
            </div>
            {/* Language filter — only for sets printed in more than one language */}
            {languages.length > 1 && (
              <div className="flex flex-wrap gap-2 justify-center" role="group" aria-label="Printing language">
                {languages.map((lang) => (
                  <Button
                    key={lang}
                    variant={selectedLanguage === lang ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedLanguage(lang)}
                    aria-pressed={selectedLanguage === lang}
                    title={`Show ${lang.toUpperCase()} printings`}
                  >
                    <span aria-hidden="true" className="mr-1">{languageFlag(lang)}</span>
                    {lang.toUpperCase()}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cards Carousel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 text-gray-500 dark:text-gray-400">
                <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin"></div>
                <span>Loading top cards...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 dark:text-red-400 text-lg mb-2">
                Failed to load cards
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{error}</p>
            </div>
          ) : cards.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                No cards found for this set and edition
              </p>
            </div>
          ) : (
            <div className="animate-fade-in">
              <FeaturedCardsCarousel cards={cards} />
            </div>
          )}
        </div>

        {/* Additional Info */}
        {cards.length > 0 && (
          <div className="mt-8 text-center">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="outline">
                <Link href="/search/results?show=summary&view=checklist">
                  Search All Cards
                </Link>
              </Button>
              {user ? (
                <AddSetToBinderDialog
                  setCode={setCode}
                  editionCode={editionCode}
                  setName={setInfo?.name || setCode.toUpperCase()}
                />
              ) : (
                <Button asChild>
                  <Link href="/signup">
                    Start Trading
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
