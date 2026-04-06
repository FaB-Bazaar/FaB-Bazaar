// components/deck/DeckSettings.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Settings, Save, Trash2, Swords, UserPlus, X, Loader2, Star } from "lucide-react";
import DeckMatchupsDialog from "./DeckMatchupsDialog";
import TalisharToggle from "./TalisharToggle";
import { TALISHAR_HERO_IDS } from "@/lib/fab-constants/heroes";

const FORMATS = [
  'Classic Constructed',
  'Silver Age',
  'Blitz',
  'Limited',
  'Commoner',
  'Living Legend'
];


interface DeckSettingsProps {
  deck: {
    _id: string;
    name: string;
    description?: string;
    format: string;
    hero?: string;
    visibility?: 'private' | 'unlisted' | 'public';
    isPublic: boolean;
    availableOnTalishar?: boolean;
    metafyGuideId?: string | null;
  };
  onSave: (settings: {
    name: string;
    description: string;
    format: string;
    hero?: string;
    visibility: 'private' | 'unlisted' | 'public';
    isPublic: boolean;
    availableOnTalishar: boolean;
    metafyGuideId: string | null;
  }) => Promise<void>;
  loading?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isMetafyPartner?: boolean;
  // Optional: for matchup sideboards feature
  deckId?: string; // publicId for API calls
  fullDeck?: any; // Full deck object with hero, equipment, maindeck, inventory arrays
  isCurator?: boolean;
  featured?: boolean;
  onToggleFeatured?: (deckId: string, value: boolean) => void;
}

export default function DeckSettings({ deck, onSave, loading = false, open, onOpenChange, isMetafyPartner, deckId, fullDeck, isCurator, featured: featuredProp, onToggleFeatured }: DeckSettingsProps) {
  const [name, setName] = useState(deck.name);
  const [description, setDescription] = useState(deck.description || "");
  const [format, setFormat] = useState(deck.format);
  const [visibility, setVisibility] = useState<'private' | 'unlisted' | 'public'>(deck.visibility || 'unlisted');
  const [availableOnTalishar, setAvailableOnTalishar] = useState(deck.availableOnTalishar ?? false);
  const [metafyGuideId, setMetafyGuideId] = useState(deck.metafyGuideId || "");
  const [saving, setSaving] = useState(false);
  const [featuredLocal, setFeaturedLocal] = useState(featuredProp ?? false);
  const [matchupsOpen, setMatchupsOpen] = useState(false);
  const [matchupsCount, setMatchupsCount] = useState(0);
  const [talisharHeroError, setTalisharHeroError] = useState(false);

  const heroNameForTalishar = deck.hero
    ?? fullDeck?.hero?.[0]?.printingDetails?.display_name
    ?? fullDeck?.hero?.[0]?.printingDetails?.name;
  const heroMappedForTalishar = heroNameForTalishar
    ? !!TALISHAR_HERO_IDS[heroNameForTalishar.toLowerCase()]
    : false;

  // Co-owners state
  const [coOwners, setCoOwners] = useState<{ id: string; username: string; avatar: string | null }[]>([]);
  const [coOwnerInput, setCoOwnerInput] = useState("");
  const [coOwnerSaving, setCoOwnerSaving] = useState(false);
  const [coOwnerError, setCoOwnerError] = useState<string | null>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<{ id: string; username: string; avatar: string | null }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const CO_OWNER_MAX = 20;

  const hasChanges =
    name !== deck.name ||
    description !== (deck.description || "") ||
    format !== deck.format ||
    visibility !== (deck.visibility || 'unlisted') ||
    availableOnTalishar !== (deck.availableOnTalishar ?? false) ||
    metafyGuideId !== (deck.metafyGuideId || "");

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      setSaving(true);
      await onSave({
        name: name.trim(),
        description: description.trim(),
        format,
        hero: deck.hero,
        visibility,
        isPublic: visibility !== 'private',
        availableOnTalishar,
        metafyGuideId: metafyGuideId.trim() || null,
      });
    } catch (error) {
      console.error('Failed to save deck settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setName(deck.name);
    setDescription(deck.description || "");
    setFormat(deck.format);
    setVisibility(deck.visibility || 'unlisted');
    setAvailableOnTalishar(deck.availableOnTalishar ?? false);
    setMetafyGuideId(deck.metafyGuideId || "");
  };

  // Fetch co-owners
  const fetchCoOwners = useCallback(() => {
    if (!deckId) return;
    fetch(`/api/decks/${deckId}/co-owners`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => { if (data.success) setCoOwners(data.data); })
      .catch(() => {});
  }, [deckId]);

  useEffect(() => { fetchCoOwners(); }, [fetchCoOwners]);

  useEffect(() => { setFeaturedLocal(featuredProp ?? false); }, [featuredProp]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCoOwnerInputChange = (value: string) => {
    setCoOwnerInput(value);
    setCoOwnerError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (!deckId) return;
      setSuggestionsLoading(true);
      try {
        const res = await fetch(`/api/users/autocomplete?q=${encodeURIComponent(value)}&deckId=${deckId}`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
          // Filter out already-added co-owners
          const addedIds = new Set(coOwners.map(c => c.id));
          setSuggestions(data.users.filter((u: { id: string }) => !addedIds.has(u.id)));
          setShowSuggestions(true);
        }
      } catch {
        // silently ignore autocomplete errors
      } finally {
        setSuggestionsLoading(false);
      }
    }, 250);
  };

  const putCoOwners = async (userIds: string[]): Promise<boolean> => {
    const res = await fetch(`/api/decks/${deckId}/co-owners`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userIds }),
    });
    const data = await res.json();
    if (data.success) {
      fetchCoOwners();
      return true;
    }
    setCoOwnerError(data.error || 'Failed to update co-owners');
    return false;
  };

  const handleSelectSuggestion = async (user: { id: string; username: string; avatar: string | null }) => {
    setShowSuggestions(false);
    setCoOwnerInput("");
    setSuggestions([]);
    if (coOwners.length >= CO_OWNER_MAX) {
      setCoOwnerError(`Maximum ${CO_OWNER_MAX} co-owners allowed`);
      return;
    }
    setCoOwnerSaving(true);
    setCoOwnerError(null);
    try {
      await putCoOwners([...coOwners.map(c => c.id), user.id]);
    } catch {
      setCoOwnerError('Failed to add co-owner');
    } finally {
      setCoOwnerSaving(false);
    }
  };

  const handleAddCoOwner = async () => {
    if (!deckId) return;
    if (coOwners.length >= CO_OWNER_MAX) {
      setCoOwnerError(`Maximum ${CO_OWNER_MAX} co-owners allowed`);
      return;
    }
    // Use the first suggestion if it matches the current input
    const match = suggestions.find(s => s.username.toLowerCase() === coOwnerInput.trim().toLowerCase()) ?? suggestions[0];
    if (!match) {
      setCoOwnerError('No matching user found. Please select from the dropdown.');
      return;
    }
    setCoOwnerSaving(true);
    setCoOwnerError(null);
    setShowSuggestions(false);
    setCoOwnerInput("");
    setSuggestions([]);
    try {
      await putCoOwners([...coOwners.map(c => c.id), match.id]);
    } catch {
      setCoOwnerError('Failed to add co-owner');
    } finally {
      setCoOwnerSaving(false);
    }
  };

  const handleRemoveCoOwner = async (coOwnerId: string) => {
    if (!deckId) return;
    setCoOwnerSaving(true);
    setCoOwnerError(null);
    try {
      const remainingIds = coOwners.filter(c => c.id !== coOwnerId).map(c => c.id);
      await putCoOwners(remainingIds);
    } catch {
      setCoOwnerError('Failed to remove co-owner');
    } finally {
      setCoOwnerSaving(false);
    }
  };

  // Fetch matchups count
  useEffect(() => {
    if (deckId) {
      fetch(`/api/decks/${deckId}/matchups`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setMatchupsCount(data.data.matchups?.length || 0);
          }
        })
        .catch(err => console.error('Failed to fetch matchups count:', err));
    }
  }, [deckId]);

  const content = (
    <div className="space-y-5 py-1">
      {/* Deck Name */}
      <div className="space-y-1.5">
        <Label htmlFor="deck-name">Deck Name *</Label>
        <Input
          id="deck-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter deck name..."
          required
          maxLength={100}
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="deck-description">Description</Label>
        <Textarea
          id="deck-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your deck strategy..."
          rows={3}
          maxLength={500}
        />
        <div className="text-xs text-muted-foreground text-right">{description.length}/500</div>
      </div>

      {/* Format */}
      <div className="space-y-1.5">
        <Label htmlFor="deck-format">Format *</Label>
        <select
          id="deck-format"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
          required
        >
          {FORMATS.map(formatOption => (
            <option key={formatOption} value={formatOption}>{formatOption}</option>
          ))}
        </select>
      </div>

      {/* Visibility */}
      <div className="flex items-center justify-between py-1">
        <div>
          <Label htmlFor="deck-visibility">Visibility</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {visibility === 'public' ? 'Listed in Community Decks' : visibility === 'unlisted' ? 'Accessible via link' : 'Only you can see this'}
          </p>
        </div>
        <select
          id="deck-visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as 'private' | 'unlisted' | 'public')}
          className="text-sm h-8 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2"
        >
          <option value="private">Private</option>
          <option value="unlisted">Unlisted</option>
          <option value="public">Public</option>
        </select>
      </div>

      {/* Available on Talishar */}
      <div className="space-y-1.5 py-1">
        <div className="flex items-center justify-between">
          <div>
            <Label>Available on Talishar</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Show this deck in Talishar imports</p>
          </div>
          <TalisharToggle
            checked={availableOnTalishar}
            onChange={(val) => {
              if (val && !heroMappedForTalishar) {
                setTalisharHeroError(true);
                return;
              }
              setTalisharHeroError(false);
              setAvailableOnTalishar(val);
            }}
          />
        </div>
        {talisharHeroError && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            A hero is required for Talishar. Add a hero card to your deck first.
          </p>
        )}
        {!talisharHeroError && availableOnTalishar && !heroMappedForTalishar && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            This deck&apos;s hero isn&apos;t recognized by Talishar. Add a supported hero card to enable imports.
          </p>
        )}
      </div>

      {/* Decks to Beat (curator-only, public decks only) */}
      {isCurator && visibility === 'public' && onToggleFeatured && deckId && (
        <div className="flex items-center justify-between py-1">
          <div>
            <Label>Decks to Beat</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Feature this deck in the Decks to Beat list</p>
          </div>
          <button
            role="switch"
            type="button"
            aria-checked={featuredLocal}
            onClick={() => {
              const next = !featuredLocal;
              setFeaturedLocal(next);
              onToggleFeatured(deckId, next);
            }}
            title={featuredLocal ? "Remove from Decks to Beat" : "Add to Decks to Beat"}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              featuredLocal ? "bg-amber-500 dark:bg-amber-600" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-200 ${
                featuredLocal ? "translate-x-5" : "translate-x-0"
              }`}
            >
              <Star className="h-3 w-3 text-amber-500" />
            </span>
          </button>
        </div>
      )}

      {/* Metafy Guide ID (partner-only) */}
      {isMetafyPartner && (
        <div className="space-y-1.5">
          <Label htmlFor="deck-metafy-guide">Metafy Guide ID</Label>
          <Input
            id="deck-metafy-guide"
            value={metafyGuideId}
            onChange={(e) => setMetafyGuideId(e.target.value)}
            placeholder="e.g. abc123"
            maxLength={100}
          />
          <p className="text-xs text-muted-foreground">
            Only users who purchased this guide on Metafy can view this deck.
          </p>
        </div>
      )}

      {/* Matchup Sideboards */}
      {deckId && fullDeck && (
        <div className="pt-3 border-t">
          <Button variant="outline" className="w-full" size="sm" onClick={() => setMatchupsOpen(true)}>
            <Swords className="h-4 w-4 mr-2" />
            Manage Matchup Sideboards {matchupsCount > 0 && `(${matchupsCount})`}
          </Button>
        </div>
      )}

      {/* Co-Owners */}
      {deckId && (
        <div className="pt-3 border-t space-y-2">
          <Label>Co-Owners ({coOwners.length}/{CO_OWNER_MAX})</Label>
          <p className="text-xs text-muted-foreground">Co-owners can edit cards and view results. Type 3+ characters to search.</p>
          <div ref={autocompleteRef} className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={coOwnerInput}
                  onChange={e => handleCoOwnerInputChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setShowSuggestions(false); }
                    if (e.key === 'Enter') { e.preventDefault(); handleAddCoOwner(); }
                  }}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  placeholder="Search username..."
                  disabled={coOwnerSaving || coOwners.length >= CO_OWNER_MAX}
                  autoComplete="off"
                />
                {suggestionsLoading && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddCoOwner}
                disabled={!coOwnerInput.trim() || coOwnerSaving || coOwners.length >= CO_OWNER_MAX}
                title="Add by exact username"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>

            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-50 left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-lg overflow-hidden">
                {suggestions.map(user => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); handleSelectSuggestion(user); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-800 transition-colors"
                    >
                      {user.avatar ? (
                        <img src={user.avatar} alt="" className="w-6 h-6 rounded-full shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-700 shrink-0" />
                      )}
                      <span className="text-gray-100">{user.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {coOwnerError && <p className="text-xs text-red-500">{coOwnerError}</p>}
          {coOwners.length > 0 && (
            <ul className="space-y-1">
              {coOwners.map(coOwner => (
                <li key={coOwner.id} className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-foreground">{coOwner.username}</span>
                  <button
                    onClick={() => handleRemoveCoOwner(coOwner.id)}
                    disabled={coOwnerSaving}
                    className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Remove co-owner"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Save Actions */}
      <div className="flex gap-2 pt-3 border-t">
        <Button
          onClick={handleSave}
          disabled={saving || loading || !hasChanges || !name.trim()}
          className="flex-1"
          size="sm"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        {hasChanges && (
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving || loading}>
            Reset
          </Button>
        )}
      </div>

      {/* Danger Zone */}
      <div className="pt-3 border-t border-red-200 dark:border-red-800">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => {
            if (confirm('Are you sure you want to delete this deck? This action cannot be undone.')) {
              console.log('Delete deck:', deck._id);
            }
          }}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Deck
        </Button>
      </div>
    </div>
  );

  // Matchups dialog (rendered regardless of Sheet vs inline mode)
  const matchupsDialog = deckId && fullDeck ? (
    <DeckMatchupsDialog
      open={matchupsOpen}
      onOpenChange={(open) => {
        setMatchupsOpen(open);
        if (!open && deckId) {
          fetch(`/api/decks/${deckId}/matchups`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
              if (data.success) setMatchupsCount(data.data.matchups?.length || 0);
            })
            .catch(err => console.error('Failed to refresh matchups count:', err));
        }
      }}
      deckId={deckId}
      deck={fullDeck}
    />
  ) : null;

  if (open !== undefined && onOpenChange) {
    return (
      <>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="right" className="w-[360px] sm:w-[400px] overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Deck Settings
              </SheetTitle>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
        {matchupsDialog}
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Deck Settings
            </CardTitle>
          </CardHeader>
          <CardContent>{content}</CardContent>
        </Card>
      </div>
      {matchupsDialog}
    </>
  );
}