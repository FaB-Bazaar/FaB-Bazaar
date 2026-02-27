// components/deck/DeckSettings.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Settings, Save, Trash2, Swords } from "lucide-react";
import DeckMatchupsDialog from "./DeckMatchupsDialog";

const FORMATS = [
  'Classic Constructed',
  'Silver Age',
  'Blitz',
  'Limited',
  'Commoner',
  'Living Legend'
];

const POPULAR_HEROES = [
  'Rhinar',
  'Dorinthea',
  'Katsu',
  'Bravo',
  'Chane',
  'Viserai',
  'Prism',
  'Lexi',
  'Oldhim',
  'Briar',
  'Fai',
  'Iyslander'
];

// Popular young heroes for Silver Age
const POPULAR_YOUNG_HEROES = [
  'Rhinar',
  'Dorinthea',
  'Katsu',
  'Bravo',
  'Azalea',
  'Ira, Crimson Haze',
  'Dash',
  'Kayo',
  'Iyslander',
  'Lexi',
  'Viserai',
  'Fai'
];

interface DeckSettingsProps {
  deck: {
    _id: string;
    name: string;
    description?: string;
    format: string;
    hero?: string;
    isPublic: boolean;
  };
  onSave: (settings: {
    name: string;
    description: string;
    format: string;
    hero?: string;
    isPublic: boolean;
  }) => Promise<void>;
  loading?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Optional: for matchup sideboards feature
  deckId?: string; // publicId for API calls
  fullDeck?: any; // Full deck object with hero, equipment, maindeck, inventory arrays
}

export default function DeckSettings({ deck, onSave, loading = false, open, onOpenChange, deckId, fullDeck }: DeckSettingsProps) {
  const [name, setName] = useState(deck.name);
  const [description, setDescription] = useState(deck.description || "");
  const [format, setFormat] = useState(deck.format);
  const [hero, setHero] = useState(deck.hero || "");
  const [isPublic, setIsPublic] = useState(deck.isPublic);
  const [saving, setSaving] = useState(false);
  const [matchupsOpen, setMatchupsOpen] = useState(false);
  const [matchupsCount, setMatchupsCount] = useState(0);

  // Determine which hero list to show based on format
  const popularHeroes = format === 'Silver Age' ? POPULAR_YOUNG_HEROES : POPULAR_HEROES;

  const hasChanges = 
    name !== deck.name ||
    description !== (deck.description || "") ||
    format !== deck.format ||
    hero !== (deck.hero || "") ||
    isPublic !== deck.isPublic;

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      setSaving(true);
      await onSave({
        name: name.trim(),
        description: description.trim(),
        format,
        hero: hero.trim() || undefined,
        isPublic
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
    setHero(deck.hero || "");
    setIsPublic(deck.isPublic);
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

      {/* Hero */}
      <div className="space-y-1.5">
        <Label htmlFor="deck-hero">
          Hero{format === 'Silver Age' && <span className="text-xs text-muted-foreground ml-1">(Young heroes only)</span>}
        </Label>
        <Input
          id="deck-hero"
          value={hero}
          onChange={(e) => setHero(e.target.value)}
          placeholder="Enter hero name..."
          maxLength={50}
        />
        <div className="flex flex-wrap gap-1 pt-0.5">
          {popularHeroes.map(heroOption => (
            <button
              key={heroOption}
              type="button"
              onClick={() => setHero(heroOption)}
              className="text-xs px-2 py-0.5 bg-muted hover:bg-muted/70 rounded transition-colors"
            >
              {heroOption}
            </button>
          ))}
        </div>
      </div>

      {/* Public Toggle */}
      <div className="flex items-center justify-between py-1">
        <div>
          <Label htmlFor="deck-public">Public Deck</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Allow others to view this deck</p>
        </div>
        <Switch id="deck-public" checked={isPublic} onCheckedChange={setIsPublic} />
      </div>

      {/* Matchup Sideboards */}
      {deckId && fullDeck && (
        <div className="pt-3 border-t">
          <Button variant="outline" className="w-full" size="sm" onClick={() => setMatchupsOpen(true)}>
            <Swords className="h-4 w-4 mr-2" />
            Manage Matchup Sideboards {matchupsCount > 0 && `(${matchupsCount})`}
          </Button>
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