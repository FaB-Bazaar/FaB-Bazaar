"use client";

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DecklistBlockEditorProps {
  section: {
    title?: string;
    deckId?: string; // Deck public ID to fetch from API
    notes?: string;
  };
  onChange?: (updates: Partial<typeof section>) => void;
  onUpdate?: (updates: Partial<typeof section>) => void;
}

interface UserDeck {
  publicId: string;
  name: string;
  heroName?: string;
  format?: string;
}

export function DecklistBlockEditor({ section, onChange, onUpdate }: DecklistBlockEditorProps) {
  // Support both onChange and onUpdate for backward compatibility
  const handleChange = onChange || onUpdate || (() => {});

  const [userDecks, setUserDecks] = useState<UserDeck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  const [deckPreview, setDeckPreview] = useState<{
    loading: boolean;
    error: string;
    name?: string;
    format?: string;
    heroName?: string;
    cardCount?: number;
  }>({ loading: false, error: '' });

  // Fetch user's decks on mount
  useEffect(() => {
    fetchUserDecks();
  }, []);

  // Fetch deck preview when deckId changes
  useEffect(() => {
    if (section.deckId) {
      fetchDeckPreview(section.deckId);
    }
  }, [section.deckId]);

  const fetchUserDecks = async () => {
    setLoadingDecks(true);
    try {
      const response = await fetch('/api/decks/user');
      const result = await response.json();

      if (result.success && result.decks) {
        setUserDecks(result.decks);
      }
    } catch (error) {
      console.error('Error fetching user decks:', error);
    } finally {
      setLoadingDecks(false);
    }
  };

  const fetchDeckPreview = async (deckId: string) => {
    if (!deckId) return;

    setDeckPreview({ loading: true, error: '' });

    try {
      const response = await fetch(`/api/decks/${deckId}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Deck not found');
      }

      const deck = result.data;
      const cardCount = (deck.hero?.length || 0) +
                       (deck.equipment?.length || 0) +
                       (deck.maindeck?.length || 0) +
                       (deck.inventory?.length || 0);

      setDeckPreview({
        loading: false,
        error: '',
        name: deck.name,
        format: deck.format,
        heroName: deck.heroName,
        cardCount,
      });
    } catch (e) {
      setDeckPreview({
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to fetch deck',
      });
    }
  };

  return (
    <div className="space-y-4 rounded-md border border-border bg-card p-4">
      <div>
        <Label className="font-semibold mb-2 block">Deck Reference</Label>
        <p className="text-xs text-muted-foreground mb-3">
          Select one of your decks or enter a deck ID manually
        </p>
        <div className="space-y-3">
        {/* Deck Selector */}
        <div>
          <Label htmlFor="deckSelector" className="font-semibold">
            {showManualInput ? 'Manual Deck ID' : 'Select Your Deck'}
          </Label>
          {!showManualInput ? (
            <div className="space-y-2">
              <Select
                value={section.deckId || ''}
                onValueChange={(value) => handleChange({ deckId: value })}
                disabled={loadingDecks}
              >
                <SelectTrigger className="mt-1 bg-background">
                  <SelectValue placeholder={loadingDecks ? "Loading your decks..." : "Choose a deck"} />
                </SelectTrigger>
                <SelectContent>
                  {userDecks.length === 0 && !loadingDecks ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No decks found. Create a deck first!
                    </div>
                  ) : (
                    userDecks.map((deck) => (
                      <SelectItem key={deck.publicId} value={deck.publicId}>
                        <div className="flex flex-col">
                          <span className="font-medium">{deck.name}</span>
                          {(deck.heroName || deck.format) && (
                            <span className="text-xs text-muted-foreground">
                              {deck.heroName && <>{deck.heroName}</>}
                              {deck.heroName && deck.format && <> • </>}
                              {deck.format && <>{deck.format}</>}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowManualInput(true)}
                className="w-full text-xs"
              >
                Or enter deck ID manually
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                id="deckId"
                value={section.deckId || ''}
                onChange={(e) => {
                  const newDeckId = e.target.value.trim();
                  handleChange({ deckId: newDeckId });
                }}
                placeholder="Enter deck public ID (e.g., abc123XYZ...)"
                className="mt-1 font-mono bg-background"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Deck ID from URL: /decks/<strong className="text-foreground">[deck-id]</strong>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManualInput(false)}
                  className="text-xs"
                >
                  Back to selector
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Deck Preview */}
        {section.deckId && (
          <div className="rounded-md border border-border p-3 bg-background">
            {deckPreview.loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading deck preview...</span>
              </div>
            ) : deckPreview.error ? (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{deckPreview.error}</span>
              </div>
            ) : deckPreview.name ? (
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500 mt-0.5" />
                <div>
                  <div className="font-semibold text-foreground">{deckPreview.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {deckPreview.heroName && <span>{deckPreview.heroName} • </span>}
                    {deckPreview.format && <span>{deckPreview.format} • </span>}
                    <span>{deckPreview.cardCount} cards</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
        </div>
      </div>

      {/* Title Override */}
      <div>
        <Label htmlFor="decklistTitle" className="font-semibold">
          Title <span className="text-muted-foreground text-sm">(optional override)</span>
        </Label>
        <Input
          id="decklistTitle"
          value={section.title || ''}
          onChange={(e) => handleChange({ title: e.target.value })}
          placeholder="Leave empty to use deck name"
          className="mt-1 bg-background"
        />
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="decklistNotes" className="font-semibold">
          Deck Notes <span className="text-muted-foreground text-sm">(optional)</span>
        </Label>
        <Textarea
          id="decklistNotes"
          value={section.notes || ''}
          onChange={(e) => handleChange({ notes: e.target.value })}
          placeholder="Sideboard tech: +2 Unmovable, +1 Sink Below for Briar matchup..."
          className="mt-1 bg-background"
          rows={3}
        />
      </div>
    </div>
  );
}
