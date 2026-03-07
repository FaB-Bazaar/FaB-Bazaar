// components/deck/DeckMatchupsDialog.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Save, X, Swords, ArrowRightLeft, ChevronDown, ChevronUp, Settings2, Bookmark } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { HERO_INFO, YOUNG_HERO_INFO } from '@/lib/fab-constants';
import { toTalisharIdentifier } from "@/lib/utils";
import { getBannedCardIds, getLivingLegendHeroIds } from '@/lib/fab-banned-cards';
import MatchupSideboardEditor from "./MatchupSideboardEditor";

interface DeckMatchup {
  heroId: string;
  preferredTurnOrder: "First" | "Second" | "NoPreference" | null;
  notes: string | null;
  sideboard: {
    in: string[];
    out: string[];
  };
}

interface DeckMatchupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  deck: any; // Full deck object with hero, equipment, maindeck, inventory arrays
  inline?: boolean; // If true, renders content directly instead of in a dialog
  compact?: boolean; // If true (with inline), suppresses the title/description header
}

// Convert a lowercase hero key to a display name, e.g. 'bravo, showstopper' → 'Bravo, Showstopper'
function toHeroDisplayName(key: string): string {
  return key.replace(/\b\w/g, c => c.toUpperCase());
}

// Helper function to get appropriate hero list based on deck format,
// filtered to only include heroes legal in that format.
function getHeroOptionsForFormat(format?: string) {
  const bannedIds = getBannedCardIds(format || '');
  const livingLegendIds = getLivingLegendHeroIds(format || '');

  const isExcluded = (cardUniqueId?: string) =>
    cardUniqueId && (bannedIds.has(cardUniqueId) || livingLegendIds.has(cardUniqueId));

  // Silver Age and Blitz use young heroes
  if (format === 'Silver Age' || format === 'Blitz') {
    return Object.entries(YOUNG_HERO_INFO)
      .filter(([_, info]) => !isExcluded(info.cardUniqueId))
      .map(([key, info]) => ({
        name: key,
        displayName: toHeroDisplayName(key),
        talisharId: toTalisharIdentifier(key),
        classes: info.classes,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  // Classic Constructed and others use adult heroes; filter out Living Legend heroes
  return Object.entries(HERO_INFO)
    .filter(([_, info]) => !isExcluded(info.cardUniqueId))
    .map(([key, info]) => ({
      name: key,
      displayName: toHeroDisplayName(key),
      talisharId: toTalisharIdentifier(key),
      classes: info.classes,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

const TURN_ORDER_OPTIONS = [
  { value: null, label: "No Preference" },
  { value: "First", label: "Go First" },
  { value: "Second", label: "Go Second" },
  { value: "NoPreference", label: "No Preference" },
];

const CORE_HERO_ID = "core";

// ─────────────────────────────────────────────────────────
// Config panel — collapsible sidebar on all breakpoints
// ─────────────────────────────────────────────────────────

function ConfigPanel({
  formHeroId, setFormHeroId,
  formTurnOrder, setFormTurnOrder,
  formNotes, setFormNotes,
  editingHeroId, heroOptions, deckFormat,
  loading, onSave, onCancel,
}: {
  formHeroId: string;
  setFormHeroId: (v: string) => void;
  formTurnOrder: "First" | "Second" | "NoPreference" | null;
  setFormTurnOrder: (v: "First" | "Second" | "NoPreference" | null) => void;
  formNotes: string;
  setFormNotes: (v: string) => void;
  editingHeroId: string | null;
  heroOptions: { name: string; displayName: string; talisharId: string; classes: string[] }[];
  deckFormat?: string;
  loading: boolean;
  onSave: () => void;
  onCancel?: () => void;
}) {
  const [collapsed, setCollapsed] = React.useState(editingHeroId !== null);

  const isCore = formHeroId === CORE_HERO_ID;
  const heroLabel = isCore ? "Core" : (heroOptions.find(h => h.talisharId === formHeroId)?.displayName || formHeroId);

  // Auto-expand when switching to "add new" mode (editingHeroId cleared after cancel/save)
  React.useEffect(() => {
    if (!editingHeroId) setCollapsed(false);
  }, [editingHeroId]);

  return (
    <div>
      {/* Collapsible header bar */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          <Settings2 className="h-3.5 w-3.5" />
          Settings
          {formHeroId && (
            <Badge variant="outline" className="text-[10px] font-normal h-4 px-1.5">
              {isCore ? "Core list" : `vs ${heroLabel}`}
            </Badge>
          )}
          {formTurnOrder && formTurnOrder !== 'NoPreference' && (
            <Badge variant="outline" className="text-[10px] font-normal h-4 px-1.5">
              {formTurnOrder === 'First' ? 'Go 1st' : 'Go 2nd'}
            </Badge>
          )}
          {!formHeroId && !editingHeroId && (
            <span className="text-[10px] text-gray-400 font-normal">— select opponent hero</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {/* Save button visible in collapsed bar when hero selected */}
          {collapsed && formHeroId && (
            <span
              onClick={(e) => { e.stopPropagation(); onSave(); }}
              className="text-[10px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
            >
              <Save className="h-3 w-3" />{editingHeroId ? 'Update' : 'Save'}
            </span>
          )}
          {/* Cancel link in collapsed bar when editing */}
          {collapsed && editingHeroId && onCancel && (
            <span
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
              className="text-[10px] font-medium text-gray-400 hover:text-gray-200 flex items-center gap-0.5"
            >
              <X className="h-3 w-3" />Cancel
            </span>
          )}
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </div>
      </button>

      {/* Expanded content — horizontal on desktop, stacked on mobile */}
      {!collapsed && (
        <div className="mt-1.5 rounded-md border border-gray-200 dark:border-gray-700 p-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
            {/* Hero */}
            <div className="space-y-1">
              <Label htmlFor="hero-select" className="text-xs">
                Opponent Hero *
                {deckFormat && (
                  <span className="text-[10px] font-normal text-gray-500 ml-1">
                    ({deckFormat === 'Silver Age' || deckFormat === 'Blitz' ? 'Young' : 'Adult'})
                  </span>
                )}
              </Label>
              <Select
                value={formHeroId}
                onValueChange={setFormHeroId}
                disabled={editingHeroId !== null}
              >
                <SelectTrigger id="hero-select" className="h-8 text-sm">
                  <SelectValue placeholder="Select hero..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value={CORE_HERO_ID}>
                    <span className="flex items-center gap-1.5">
                      <Bookmark className="h-3.5 w-3.5 text-blue-400" />
                      Core — Baseline List
                    </span>
                  </SelectItem>
                  <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                  {heroOptions.map((hero) => (
                    <SelectItem key={hero.talisharId} value={hero.talisharId}>
                      {hero.displayName}
                      <span className="text-xs text-gray-500 ml-1">
                        ({hero.classes.join(', ')})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingHeroId && (
                <p className="text-[10px] text-gray-500 leading-tight">
                  {editingHeroId === CORE_HERO_ID ? "Core matchup locked." : "Hero locked."} Delete &amp; recreate to change.
                </p>
              )}
            </div>

            {/* Turn Order */}
            <div className="space-y-1">
              <Label htmlFor="turn-order" className="text-xs">Turn Order</Label>
              <Select
                value={formTurnOrder || "null"}
                onValueChange={(val) => setFormTurnOrder(val === "null" ? null : val as any)}
              >
                <SelectTrigger id="turn-order" className="h-8 text-sm">
                  <SelectValue placeholder="No preference" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    { value: "null", label: "No Preference" },
                    { value: "First", label: "Go First" },
                    { value: "Second", label: "Go Second" },
                  ].map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label htmlFor="notes" className="text-xs">Notes</Label>
              <Textarea
                id="notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Strategy..."
                rows={1}
                maxLength={500}
                className="text-sm resize-none h-8 min-h-[32px]"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-1.5">
              <Button onClick={onSave} disabled={loading} size="sm" className="h-8">
                <Save className="h-3.5 w-3.5 mr-1" />
                {editingHeroId ? 'Update' : 'Save'}
              </Button>
              {onCancel && (
                <Button variant="outline" size="sm" onClick={onCancel} className="h-8">
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeckMatchupsDialog({
  open,
  onOpenChange,
  deckId,
  deck,
  inline = false,
  compact = false,
}: DeckMatchupsDialogProps) {
  const { toast } = useToast();
  const [matchups, setMatchups] = useState<DeckMatchup[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingHeroId, setEditingHeroId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("matchups");
  const [expandedMatchups, setExpandedMatchups] = useState<Set<string>>(new Set());
  const [heroImageMap, setHeroImageMap] = useState<Map<string, string>>(new Map());

  // Form state for add/edit
  const [formHeroId, setFormHeroId] = useState("");
  const [formTurnOrder, setFormTurnOrder] = useState<"First" | "Second" | "NoPreference" | null>(null);
  const [formNotes, setFormNotes] = useState("");
  const [formSideboardIn, setFormSideboardIn] = useState<string[]>([]);
  const [formSideboardOut, setFormSideboardOut] = useState<string[]>([]);

  // Available cards for sideboard
  const [availableMainDeckCards, setAvailableMainDeckCards] = useState<Map<string, number>>(new Map());
  const [availableInventoryCards, setAvailableInventoryCards] = useState<Map<string, number>>(new Map());

  // Get hero options based on deck format
  const HERO_OPTIONS = getHeroOptionsForFormat(deck?.format);

  // Fetch matchups
  const fetchMatchups = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/decks/${deckId}/matchups`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch matchups');
      }

      const data = await response.json();
      if (data.success) {
        setMatchups(data.data.matchups || []);
      }
    } catch (error) {
      console.error('Error fetching matchups:', error);
      toast({
        title: "Error",
        description: "Failed to load matchups",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Build available cards map
  const buildAvailableCards = () => {
    const mainDeckMap = new Map<string, number>();
    const inventoryMap = new Map<string, number>();

    // Count main deck cards (hero + equipment + maindeck)
    [...(deck.hero || []), ...(deck.equipment || []), ...(deck.maindeck || [])].forEach((printing: any) => {
      const cardId = buildTalisharIdentifier(printing);
      mainDeckMap.set(cardId, (mainDeckMap.get(cardId) || 0) + 1);
    });

    // Count inventory cards
    (deck.inventory || []).forEach((printing: any) => {
      const cardId = buildTalisharIdentifier(printing);
      inventoryMap.set(cardId, (inventoryMap.get(cardId) || 0) + 1);
    });

    setAvailableMainDeckCards(mainDeckMap);
    setAvailableInventoryCards(inventoryMap);
  };

  const buildTalisharIdentifier = (printing: any): string => {
    const cardName = printing.printingDetails?.name || '';
    const baseIdentifier = toTalisharIdentifier(cardName) || printing.printingId;

    const pitchValue = printing.printingDetails?.pitch;
    let pitch: number | null = null;

    if (typeof pitchValue === 'number') {
      pitch = pitchValue;
    } else if (pitchValue && typeof pitchValue === 'object' && '$numberInt' in pitchValue) {
      pitch = parseInt(pitchValue.$numberInt, 10);
    }

    const PITCH_COLOR_MAP: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };

    if (pitch && PITCH_COLOR_MAP[pitch]) {
      return `${baseIdentifier}_${PITCH_COLOR_MAP[pitch]}`;
    }

    return baseIdentifier;
  };

  // Fetch hero images for matchup list thumbnails
  const fetchHeroImages = async () => {
    try {
      const format = (deck?.format === 'Silver Age' || deck?.format === 'Blitz') ? 'young' : 'adult';
      const response = await fetch(`/api/hero-printings?format=${format}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.success && data.heroes) {
        const map = new Map<string, string>();
        for (const hero of data.heroes) {
          const tId = toTalisharIdentifier(hero.name);
          if (tId && hero.image_url) map.set(tId, hero.image_url);
        }
        setHeroImageMap(map);
      }
    } catch {
      // Non-critical — matchups still work without images
    }
  };

  useEffect(() => {
    if (open) {
      fetchMatchups();
      buildAvailableCards();
      if (heroImageMap.size === 0) fetchHeroImages();
    }
  }, [open, deckId]);

  const resetForm = () => {
    setFormHeroId("");
    setFormTurnOrder(null);
    setFormNotes("");
    setFormSideboardIn([]);
    setFormSideboardOut([]);
    setEditingHeroId(null);
    setActiveTab("matchups");
  };

  const handleEdit = (matchup: DeckMatchup) => {
    setFormHeroId(matchup.heroId);
    setFormTurnOrder(matchup.preferredTurnOrder);
    setFormNotes(matchup.notes || "");
    setFormSideboardIn([...matchup.sideboard.in]);
    setFormSideboardOut([...matchup.sideboard.out]);
    setEditingHeroId(matchup.heroId);
  };

  const handleSave = async () => {
    // Validation
    if (!formHeroId) {
      toast({
        title: "Validation Error",
        description: "Please select an opponent hero",
        variant: "destructive",
      });
      return;
    }

    if (formNotes.length > 500) {
      toast({
        title: "Validation Error",
        description: "Notes must be 500 characters or less",
        variant: "destructive",
      });
      return;
    }

    const matchupData = {
      heroId: formHeroId,
      preferredTurnOrder: formTurnOrder,
      notes: formNotes || null,
      sideboard: {
        in: formSideboardIn,
        out: formSideboardOut,
      },
    };

    setLoading(true);
    try {
      const isEditing = editingHeroId !== null;
      const url = isEditing
        ? `/api/decks/${deckId}/matchups/${editingHeroId}`
        : `/api/decks/${deckId}/matchups`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ matchup: matchupData }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save matchup');
      }

      toast({
        title: "Success",
        description: isEditing ? "Matchup updated" : "Matchup created",
      });

      resetForm();
      fetchMatchups();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save matchup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (heroId: string) => {
    if (!confirm('Delete this matchup?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/decks/${deckId}/matchups/${heroId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete matchup');
      }

      toast({
        title: "Success",
        description: "Matchup deleted",
      });

      fetchMatchups();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete matchup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (heroId: string) => {
    const newExpanded = new Set(expandedMatchups);
    if (newExpanded.has(heroId)) {
      newExpanded.delete(heroId);
    } else {
      newExpanded.add(heroId);
    }
    setExpandedMatchups(newExpanded);
  };

  const getHeroDisplayName = (heroId: string) => {
    if (heroId === CORE_HERO_ID) return "Core";

    // First try current format's hero options
    let hero = HERO_OPTIONS.find(h => h.talisharId === heroId);
    if (hero) return hero.displayName;

    // Fallback: check both adult and young heroes (for legacy matchups)
    const allHeroes = [
      ...Object.keys(HERO_INFO).map(key => ({
        displayName: toHeroDisplayName(key),
        talisharId: toTalisharIdentifier(key),
      })),
      ...Object.keys(YOUNG_HERO_INFO).map(key => ({
        displayName: toHeroDisplayName(key),
        talisharId: toTalisharIdentifier(key),
      }))
    ];

    const match = allHeroes.find(h => h.talisharId === heroId);
    return match?.displayName || heroId;
  };

  const addCardToSideboard = (cardId: string, target: 'in' | 'out') => {
    if (target === 'in') {
      setFormSideboardIn([...formSideboardIn, cardId]);
    } else {
      setFormSideboardOut([...formSideboardOut, cardId]);
    }
  };

  const removeCardFromSideboard = (index: number, target: 'in' | 'out') => {
    if (target === 'in') {
      setFormSideboardIn(formSideboardIn.filter((_, i) => i !== index));
    } else {
      setFormSideboardOut(formSideboardOut.filter((_, i) => i !== index));
    }
  };

  // Main content component (used both in dialog and inline)
  const matchupsContent = (
    <div className={inline ? "w-full" : ""}>
      {inline && !compact && (
        <div className="mb-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Swords className="h-5 w-5" />
            Matchup Sideboards
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Configure sideboard plans for specific opponent heroes
          </p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(val) => {
          // Switching back to the list always resets edit state so "Add New" is available
          if (val === "matchups" && editingHeroId) resetForm();
          setActiveTab(val);
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="matchups">
              Matchups ({matchups.length})
            </TabsTrigger>
            <TabsTrigger value="add">
              {editingHeroId ? 'Edit' : 'Add New'}
            </TabsTrigger>
          </TabsList>

          {/* Existing Matchups List */}
          <TabsContent value="matchups" className="space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { resetForm(); setActiveTab("add"); }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />Add Matchup
              </Button>
            </div>
            {loading && matchups.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Loading...</p>
            ) : matchups.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No matchups configured yet.
              </p>
            ) : (
              [...matchups]
                .sort((a, b) => {
                  if (a.heroId === CORE_HERO_ID) return -1;
                  if (b.heroId === CORE_HERO_ID) return 1;
                  return getHeroDisplayName(a.heroId).localeCompare(getHeroDisplayName(b.heroId));
                })
                .map((matchup) => {
                const isCore = matchup.heroId === CORE_HERO_ID;
                const heroImg = !isCore ? heroImageMap.get(matchup.heroId) : undefined;
                return (
                  <Card key={matchup.heroId}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Hero card art thumbnail (cropped to top) — or Bookmark for Core */}
                          {isCore ? (
                            <div className="w-10 h-12 flex-shrink-0 rounded bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                              <Bookmark className="h-5 w-5 text-blue-400" />
                            </div>
                          ) : heroImg ? (
                            <div className="w-10 h-12 flex-shrink-0 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={heroImg}
                                alt={getHeroDisplayName(matchup.heroId)}
                                className="w-full h-full object-cover object-top"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-12 flex-shrink-0 rounded bg-gray-200 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700">
                              <Swords className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                              {getHeroDisplayName(matchup.heroId)}
                              {isCore && (
                                <Badge variant="secondary" className="text-xs">Baseline</Badge>
                              )}
                              {matchup.preferredTurnOrder && matchup.preferredTurnOrder !== 'NoPreference' && (
                                <Badge variant="outline" className="text-xs">
                                  {matchup.preferredTurnOrder === 'First' ? 'Go First' : 'Go Second'}
                                </Badge>
                              )}
                            </CardTitle>
                            {matchup.notes && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                                {matchup.notes}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              {matchup.sideboard.out.length > 0 || matchup.sideboard.in.length > 0
                                ? `${matchup.sideboard.out.length} out, ${matchup.sideboard.in.length} in`
                                : 'No sideboard changes'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              handleEdit(matchup);
                              setActiveTab("add");
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(matchup.heroId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleExpand(matchup.heroId)}
                          >
                            {expandedMatchups.has(matchup.heroId) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {expandedMatchups.has(matchup.heroId) && (
                      <CardContent className="pt-0">
                        <MatchupSideboardEditor
                          key={`review-${matchup.heroId}`}
                          deck={deck}
                          format={deck?.format}
                          initialSwaps={matchup.sideboard}
                          onChange={() => {}}
                          readOnly
                        />
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Add/Edit Form — sidebar layout on desktop, collapsible on mobile */}
          <TabsContent value="add" className="space-y-1.5 mt-2">
            <div className="flex flex-col gap-1.5">
              {/* Config panel — full-width collapsible bar */}
              <ConfigPanel
                formHeroId={formHeroId}
                setFormHeroId={setFormHeroId}
                formTurnOrder={formTurnOrder}
                setFormTurnOrder={setFormTurnOrder}
                formNotes={formNotes}
                setFormNotes={setFormNotes}
                editingHeroId={editingHeroId}
                heroOptions={HERO_OPTIONS}
                deckFormat={deck?.format}
                loading={loading}
                onSave={handleSave}
                onCancel={editingHeroId ? resetForm : undefined}
              />

              {/* Sideboard editor — takes majority of space */}
              <div className="flex-1 min-w-0">
                <MatchupSideboardEditor
                  deck={deck}
                  format={deck?.format}
                  initialSwaps={{
                    in: formSideboardIn,
                    out: formSideboardOut,
                  }}
                  onChange={(swaps) => {
                    setFormSideboardIn(swaps.in);
                    setFormSideboardOut(swaps.out);
                  }}
                />
              </div>
            </div>

            {/* Action buttons — shown when settings is collapsed (no buttons visible) */}
            {/* ConfigPanel has its own buttons when expanded */}
          </TabsContent>
        </Tabs>
      </div>
  );

  // Render inline or as dialog
  if (inline) {
    return matchupsContent;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            Matchup Sideboards
          </DialogTitle>
          <DialogDescription>
            Configure sideboard plans for specific opponent heroes
          </DialogDescription>
        </DialogHeader>
        {matchupsContent}
      </DialogContent>
    </Dialog>
  );
}
