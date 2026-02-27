"use client";

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, ArrowUp, ArrowDown, Loader2, Search } from 'lucide-react';
import { HERO_INFO } from '@/lib/fab-constants';
import CardSearchDialog from '@/components/dialogs/cards/card-search-dialog';
import InlineCardThumbnail from '@/components/heroes/InlineCardThumbnail';

// Hero classes for grouping
const HERO_CLASSES = [
  'Guardian', 'Warrior', 'Brute', 'Ninja', 'Runeblade',
  'Wizard', 'Mechanologist', 'Ranger', 'Assassin',
  'Illusionist', 'Necromancer'
];

// Helper to capitalize hero names for display
function capitalizeHeroName(name: string): string {
  return name.split(' ').map(word => {
    // Handle special cases like "I/O" or contractions
    if (word.includes('/') || word.includes("'")) return word;
    // Handle roman numerals, special characters
    if (word.match(/^[ivxlcdm]+$/i)) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

interface SideboardCard {
  printingId: string;
  action: 'in' | 'out';
}

interface HeroCardOption {
  printing_id: string;
  display_name: string;
  image_url: string;
  set_name?: string;
}

interface MatchReportSectionEditorProps {
  section: {
    round?: string;
    opponent?: string;
    hero?: string;
    heroPrintingId?: string;
    result?: string; // "W", "L", or "D"
    record?: string;
    summary?: string;
    sideboard?: string;
    sideboardCards?: SideboardCard[];
  };
  onChange: (updates: Partial<typeof section>) => void;
}

export function MatchReportSectionEditor({ section, onChange }: MatchReportSectionEditorProps) {
  const [showCardSearch, setShowCardSearch] = useState(false);
  const [showSummaryCardSearch, setShowSummaryCardSearch] = useState(false);
  const [cardAction, setCardAction] = useState<'in' | 'out'>('in');
  const sideboardRef = useRef<HTMLTextAreaElement>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);

  // Hero card selection state
  const [heroCardOptions, setHeroCardOptions] = useState<HeroCardOption[]>([]);
  const [loadingHeroCards, setLoadingHeroCards] = useState(false);

  // Track the last fetched hero to prevent duplicate fetches
  const lastFetchedHeroRef = useRef<string | null>(null);

  // Fetch hero cards when hero name changes
  useEffect(() => {
    const heroName = section.hero || '';

    // Skip if we've already fetched for this hero
    if (heroName === lastFetchedHeroRef.current) {
      console.log('[MatchReportSectionEditor] Skipping fetch - already fetched for:', heroName);
      return;
    }

    console.log('[MatchReportSectionEditor] useEffect triggered, hero:', heroName);

    async function fetchHeroCards() {
      if (!heroName) {
        setHeroCardOptions([]);
        lastFetchedHeroRef.current = '';
        return;
      }

      // Mark as fetching for this hero
      lastFetchedHeroRef.current = heroName;
      setLoadingHeroCards(true);

      try {
        console.log('[MatchReportSectionEditor] Fetching hero cards for:', heroName);
        // Search for hero cards by name
        const response = await fetch(
          `/api/printings/search?name=${encodeURIComponent(heroName)}&types=hero&show=all&limit=10`
        );
        if (response.ok) {
          const json = await response.json();
          const printings = json?.data?.printings || [];
          console.log('[MatchReportSectionEditor] Got', printings.length, 'hero cards');
          setHeroCardOptions(printings);

          // Auto-select first card if no heroPrintingId is set
          if (!section.heroPrintingId && printings.length > 0) {
            console.log('[MatchReportSectionEditor] Auto-selecting first hero card:', printings[0].printing_id);
            onChange({ heroPrintingId: printings[0].printing_id });
          }
        }
      } catch (error) {
        console.error('[MatchReportSectionEditor] Failed to fetch hero cards:', error);
      } finally {
        setLoadingHeroCards(false);
      }
    }

    fetchHeroCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.hero]); // Only trigger on hero change, not heroPrintingId

  // Handle hero selection - also clear heroPrintingId to trigger new search
  const handleHeroChange = (value: string) => {
    onChange({ hero: value, heroPrintingId: undefined });
  };

  // Handle card selection for summary - insert InlineCard at cursor
  const handleSummaryCardSelect = (data: any) => {
    const printingId = data.printing?.printing_id || data.card?.printing_id;
    const cardName = data.printing?.display_name || data.card?.display_name || data.card?.name || 'Card';
    if (!printingId) return;

    const textarea = summaryRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const textToInsert = `<InlineCard printingId="${printingId}">${cardName}</InlineCard>`;
      const currentValue = section.summary || '';
      const newText = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);

      onChange({ summary: newText });

      // Restore cursor position after the inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
      }, 0);
    }
    setShowSummaryCardSearch(false);
  };

  // Handle card selection - add to sideboardCards array
  const handleInsertCard = (data: any) => {
    const printingId = data.printing?.printing_id || data.card?.printing_id;
    if (!printingId) return;

    const currentCards = section.sideboardCards || [];
    // Check if card already exists with same action
    const exists = currentCards.some(
      c => c.printingId === printingId && c.action === cardAction
    );
    if (!exists) {
      onChange({
        sideboardCards: [...currentCards, { printingId, action: cardAction }]
      });
    }
    setShowCardSearch(false);
  };

  // Remove a card from sideboardCards
  const handleRemoveCard = (printingId: string, action: 'in' | 'out') => {
    const currentCards = section.sideboardCards || [];
    onChange({
      sideboardCards: currentCards.filter(
        c => !(c.printingId === printingId && c.action === action)
      )
    });
  };

  // Get cards by action
  const cardsIn = (section.sideboardCards || []).filter(c => c.action === 'in');
  const cardsOut = (section.sideboardCards || []).filter(c => c.action === 'out');

  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="matchRound" className="font-semibold">Round</Label>
          <Input
            id="matchRound"
            value={section.round || ''}
            onChange={(e) => onChange({ round: e.target.value })}
            placeholder="e.g., Round 1, Top 8, Finals"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="matchResult" className="font-semibold">Result</Label>
          <Select
            value={section.result || ''}
            onValueChange={(value) => onChange({ result: value })}
          >
            <SelectTrigger id="matchResult" className="mt-1">
              <SelectValue placeholder="Select result" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="W">Win</SelectItem>
              <SelectItem value="L">Loss</SelectItem>
              <SelectItem value="D">Draw</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="matchOpponent" className="font-semibold">
            Opponent Name <span className="text-muted-foreground text-sm">(optional)</span>
          </Label>
          <Input
            id="matchOpponent"
            value={section.opponent || ''}
            onChange={(e) => onChange({ opponent: e.target.value })}
            placeholder="e.g., John Smith"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="matchHero" className="font-semibold">Opponent's Hero</Label>
          <Select
            value={section.hero || ''}
            onValueChange={handleHeroChange}
          >
            <SelectTrigger id="matchHero" className="mt-1">
              <SelectValue placeholder="Select hero" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {HERO_CLASSES.map(heroClass => {
                const heroesInClass = Object.entries(HERO_INFO)
                  .filter(([_, info]) => info.classes.includes(heroClass.toLowerCase()))
                  .map(([heroName, _]) => heroName);

                if (heroesInClass.length === 0) return null;

                return (
                  <SelectGroup key={heroClass}>
                    <SelectLabel className="font-bold text-primary">{heroClass}</SelectLabel>
                    {heroesInClass.map(heroName => (
                      <SelectItem key={heroName} value={capitalizeHeroName(heroName)}>
                        {capitalizeHeroName(heroName)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Hero Card Picker */}
      {section.hero && (
        <div>
          <Label className="font-semibold">Hero Card</Label>
          {loadingHeroCards ? (
            <div className="flex items-center gap-2 mt-1 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading hero cards...</span>
            </div>
          ) : heroCardOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {heroCardOptions.map((card) => (
                <button
                  key={card.printing_id}
                  type="button"
                  onClick={() => onChange({ heroPrintingId: card.printing_id })}
                  className={`relative rounded-md overflow-hidden transition-all ${
                    section.heroPrintingId === card.printing_id
                      ? 'ring-2 ring-primary ring-offset-2 scale-105'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  title={`${card.display_name}${card.set_name ? ` (${card.set_name})` : ''}`}
                >
                  <img
                    src={card.image_url}
                    alt={card.display_name}
                    className="w-16 h-[89px] object-cover"
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">No hero cards found</p>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="matchRecord" className="font-semibold">
          Tournament Record <span className="text-muted-foreground text-sm">(optional)</span>
        </Label>
        <Input
          id="matchRecord"
          value={section.record || ''}
          onChange={(e) => onChange({ record: e.target.value })}
          placeholder="e.g., 5-1, 3-2-1"
          className="mt-1"
        />
      </div>

      <div>
        <div className="flex justify-between items-center">
          <Label htmlFor="matchSummary" className="font-semibold">Match Summary</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowSummaryCardSearch(true)}
          >
            <Search className="h-3 w-3 mr-1" />
            Insert Card
          </Button>
        </div>
        <Textarea
          ref={summaryRef}
          id="matchSummary"
          value={section.summary || ''}
          onChange={(e) => onChange({ summary: e.target.value })}
          placeholder="Describe key moments, strategy, and how the match played out. Use Insert Card to reference specific cards."
          className="mt-1 font-mono text-sm"
          rows={4}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <Label className="font-semibold">
            Sideboard Cards <span className="text-muted-foreground text-sm">(optional)</span>
          </Label>
          <div className="flex gap-2">
            <Select value={cardAction} onValueChange={(v) => setCardAction(v as 'in' | 'out')}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">
                  <span className="flex items-center gap-1">
                    <ArrowUp className="h-3 w-3 text-green-600" />
                    In
                  </span>
                </SelectItem>
                <SelectItem value="out">
                  <span className="flex items-center gap-1">
                    <ArrowDown className="h-3 w-3 text-red-600" />
                    Out
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCardSearch(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Card
            </Button>
          </div>
        </div>

        {/* Cards In Section */}
        {cardsIn.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 text-sm text-green-600 font-medium mb-1">
              <ArrowUp className="h-3 w-3" />
              In
            </div>
            <div className="flex flex-wrap gap-2">
              {cardsIn.map((card) => (
                <div
                  key={`in-${card.printingId}`}
                  className="relative group inline-flex items-center bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md p-1"
                >
                  <InlineCardThumbnail printingId={card.printingId} size="sm" />
                  <button
                    type="button"
                    onClick={() => handleRemoveCard(card.printingId, 'in')}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove card"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cards Out Section */}
        {cardsOut.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 text-sm text-red-600 font-medium mb-1">
              <ArrowDown className="h-3 w-3" />
              Out
            </div>
            <div className="flex flex-wrap gap-2">
              {cardsOut.map((card) => (
                <div
                  key={`out-${card.printingId}`}
                  className="relative group inline-flex items-center bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-1"
                >
                  <InlineCardThumbnail printingId={card.printingId} size="sm" />
                  <button
                    type="button"
                    onClick={() => handleRemoveCard(card.printingId, 'out')}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove card"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Notes */}
        <Label htmlFor="matchSideboard" className="text-sm text-muted-foreground">
          Additional sideboard notes
        </Label>
        <Textarea
          ref={sideboardRef}
          id="matchSideboard"
          value={section.sideboard || ''}
          onChange={(e) => onChange({ sideboard: e.target.value })}
          placeholder="Additional notes about sideboard decisions..."
          className="mt-1"
          rows={2}
        />
      </div>

      {/* Card Search Dialog for sideboard cards */}
      <CardSearchDialog
        open={showCardSearch}
        onOpenChange={setShowCardSearch}
        onSelectCard={handleInsertCard}
      />

      {/* Card Search Dialog for summary inline cards */}
      <CardSearchDialog
        open={showSummaryCardSearch}
        onOpenChange={setShowSummaryCardSearch}
        onSelectCard={handleSummaryCardSelect}
      />
    </div>
  );
}
