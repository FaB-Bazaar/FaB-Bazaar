// components/deck/DeckMatchupsDialog.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { Plus, Trash2, Save, X, Swords, ArrowRightLeft, ChevronDown, ChevronUp, Settings2, Bookmark, Copy, Pencil, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { HERO_INFO, YOUNG_HERO_INFO } from '@/lib/fab-constants';
import { toTalisharIdentifier } from "@/lib/utils";
import { useExcludedHeroIds } from '@/hooks/banned-cards/useExcludedHeroIds';
import { getHeroPortraitUrl } from "@/lib/fab-constants/heroPortraits";
import { getStrategyPortraitUrl } from "@/lib/fab-constants/strategyPortraits";
import { getCopyTargets, buildCopiedMatchup } from "@/lib/utils/matchup-copy";
import { findExistingMatchupToEdit } from "@/lib/utils/matchup-edit-mode";
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
  // When provided + the dialog opens, jump straight into editing this matchup.
  // The deep-link is consumed once: changing tabs / saving / cancelling clears it.
  initialEditHeroId?: string | null;
  // When provided + the dialog opens, jump straight into the gallery overlay for this hero.
  initialGalleryHeroId?: string | null;
  // Talishar identifier → hero card image_url. Used as a portrait fallback for
  // heroes (especially young / SA / Blitz) without a stylized portrait file.
  heroCardImages?: Map<string, string>;
}

// Convert a lowercase hero key to a display name, e.g. 'bravo, showstopper' → 'Bravo, Showstopper'
function toHeroDisplayName(key: string): string {
  return key.replace(/\b\w/g, c => c.toUpperCase());
}

// Helper function to get appropriate hero list based on deck format,
// filtered to only include heroes legal in that format.
function getHeroOptionsForFormat(format: string | undefined, excludedHeroIds: Set<string>) {
  const isExcluded = (cardUniqueId?: string) =>
    !!cardUniqueId && excludedHeroIds.has(cardUniqueId);

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

const STRATEGY_MATCHUP_IDS: Record<string, string> = {
  aggro:    'Aggro',
  fatigue:  'Fatigue',
  combo:    'Combo',
  midrange: 'Midrange',
};

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
  const strategyLabel = STRATEGY_MATCHUP_IDS[formHeroId];
  const isStrategy = !!strategyLabel;
  const heroLabel = isCore
    ? "Core"
    : strategyLabel
      ?? (heroOptions.find(h => h.talisharId === formHeroId)?.displayName || formHeroId);

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
        className="flex items-center justify-between w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          <Settings2 className="h-3.5 w-3.5" />
          Settings
          {formHeroId && (
            <Badge variant="outline" className="text-[10px] font-normal h-4 px-1.5">
              {isCore ? "Core list" : isStrategy ? heroLabel : `vs ${heroLabel}`}
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
        <div className="mt-1.5 rounded-md border border-gray-300 dark:border-gray-700 p-3">
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
                  <div className="my-1 border-t border-gray-300 dark:border-gray-700" />
                  {Object.entries(STRATEGY_MATCHUP_IDS).map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      <span className="flex items-center gap-1.5">
                        <Swords className="h-3.5 w-3.5 text-amber-400" />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                  <div className="my-1 border-t border-gray-300 dark:border-gray-700" />
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
                  {editingHeroId === CORE_HERO_ID
                    ? "Core matchup locked."
                    : STRATEGY_MATCHUP_IDS[editingHeroId]
                      ? `${STRATEGY_MATCHUP_IDS[editingHeroId]} matchup locked.`
                      : "Hero locked."} Delete &amp; recreate to change.
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
  initialEditHeroId = null,
  initialGalleryHeroId = null,
  heroCardImages,
}: DeckMatchupsDialogProps) {
  const { toast } = useToast();
  const [matchups, setMatchups] = useState<DeckMatchup[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingHeroId, setEditingHeroId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("matchups");

  // Gallery state — fullscreen card image viewer
  const [gallery, setGallery] = useState<{ heroId: string; section: 'deck' | 'inventory' } | null>(null);

  // Sideboard-plan view mode — "vsDeck" (Side Out + Bring In), "setAside" (single pile), or "fullDeck" (complete post-sideboard deck)
  // Persisted per-user in localStorage. Only applies when viewing the inventory/sideboard gallery.
  const [galleryView, setGalleryView] = useState<'vsDeck' | 'setAside' | 'fullDeck'>('vsDeck');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fab:matchup-gallery-view');
      if (saved === 'vsDeck' || saved === 'setAside' || saved === 'fullDeck') setGalleryView(saved);
    } catch { /* localStorage unavailable */ }
  }, []);

  const updateGalleryView = (v: 'vsDeck' | 'setAside' | 'fullDeck') => {
    setGalleryView(v);
    try { localStorage.setItem('fab:matchup-gallery-view', v); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!gallery) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setGallery(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [gallery]);

  // Copy-to-another-hero state
  const [copySource, setCopySource] = useState<DeckMatchup | null>(null);
  const [copyTargetHeroId, setCopyTargetHeroId] = useState<string>("");

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
  const excludedHeroIds = useExcludedHeroIds(deck?.format ?? '');
  const HERO_OPTIONS = getHeroOptionsForFormat(deck?.format, excludedHeroIds);

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

  // Build grouped card arrays for the gallery (unique cards with qty + image)
  interface GalleryCard { talisharId: string; count: number; displayName: string; printingId: string; imageUrl?: string }

  const buildGalleryCards = useCallback((printings: any[]): GalleryCard[] => {
    const groups = new Map<string, GalleryCard>();
    for (const p of printings || []) {
      const id = buildTalisharIdentifier(p);
      const qty = p.quantity ?? 1;
      if (!groups.has(id)) {
        groups.set(id, {
          talisharId: id,
          count: qty,
          displayName: p.printingDetails?.display_name || p.printingDetails?.name || id,
          printingId: p.printingId,
          imageUrl: p.printingDetails?.image_url,
        });
      } else {
        groups.get(id)!.count += qty;
      }
    }
    return Array.from(groups.values());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deckGalleryCards = useMemo<GalleryCard[]>(
    () => buildGalleryCards([...(deck?.hero || []), ...(deck?.equipment || []), ...(deck?.maindeck || [])]),
    [deck, buildGalleryCards]
  );

  const inventoryGalleryCards = useMemo<GalleryCard[]>(
    () => buildGalleryCards(deck?.inventory || []),
    [deck, buildGalleryCards]
  );

  // Lookup map: talisharId → display name (deck + inventory cards)
  const cardNameMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const c of deckGalleryCards) map.set(c.talisharId, c.displayName);
    for (const c of inventoryGalleryCards) if (!map.has(c.talisharId)) map.set(c.talisharId, c.displayName);
    return map;
  }, [deckGalleryCards, inventoryGalleryCards]);

  // Set of talisharIds that belong to equipment/hero slots (used for mobile section grouping)
  const equipmentTalisharIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of [...(deck?.equipment || []), ...(deck?.hero || [])]) {
      set.add(buildTalisharIdentifier(p));
    }
    return set;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);

  // Derive deck section from a talishar ID
  const getCardSection = useCallback((id: string): 'equipment' | 'red' | 'yellow' | 'blue' | 'unpitched' => {
    if (equipmentTalisharIds.has(id)) return 'equipment';
    if (id.endsWith('_red')) return 'red';
    if (id.endsWith('_yellow')) return 'yellow';
    if (id.endsWith('_blue')) return 'blue';
    return 'unpitched';
  }, [equipmentTalisharIds]);

  useEffect(() => {
    if (open) {
      fetchMatchups();
      buildAvailableCards();
    }
  }, [open, deckId]);

  // Deep-link: caller passed an `initialEditHeroId` to jump straight to its
  // edit form. Wait for matchups to load, then either edit-existing or
  // pre-fill a new matchup form for that hero. Fires once per open + heroId.
  const initialEditAppliedRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      initialEditAppliedRef.current = null;
      return;
    }
    if (!initialEditHeroId) return;
    if (initialEditAppliedRef.current === initialEditHeroId) return;
    if (loading) return; // wait for matchups fetch
    initialEditAppliedRef.current = initialEditHeroId;

    const existing = matchups.find((m) => m.heroId === initialEditHeroId);
    if (existing) {
      handleEdit(existing);
    } else {
      // No matchup yet for this hero — pre-fill an empty form so the user
      // can save it without re-picking the hero.
      setFormHeroId(initialEditHeroId);
      setFormTurnOrder(null);
      setFormNotes("");
      setFormSideboardIn([]);
      setFormSideboardOut([]);
      setEditingHeroId(null);
    }
    setActiveTab("add");
  }, [open, initialEditHeroId, loading, matchups]);

  // Deep-link: caller passed `initialGalleryHeroId` to jump straight to the
  // gallery overlay for this hero's sideboard plan.
  const initialGalleryAppliedRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      initialGalleryAppliedRef.current = null;
      return;
    }
    if (!initialGalleryHeroId) return;
    if (initialGalleryAppliedRef.current === initialGalleryHeroId) return;
    if (loading) return;
    initialGalleryAppliedRef.current = initialGalleryHeroId;
    const matchup = matchups.find((m) => m.heroId === initialGalleryHeroId);
    if (matchup && (matchup.sideboard.in.length > 0 || matchup.sideboard.out.length > 0)) {
      setGallery({ heroId: initialGalleryHeroId, section: 'inventory' });
    }
  }, [open, initialGalleryHeroId, loading, matchups]);

  // If the user picks a hero in the form that already has a matchup, auto-load
  // that matchup into edit mode so Save updates it instead of POSTing a duplicate.
  useEffect(() => {
    const existing = findExistingMatchupToEdit(matchups, formHeroId, editingHeroId);
    if (existing) {
      handleEdit(existing);
    }
    // handleEdit is stable enough (defined inline but only reads setters); we
    // intentionally depend on matchups + formHeroId + editingHeroId to fire
    // exactly when the picked hero changes or the matchup list arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formHeroId, editingHeroId, matchups]);

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

  const handleCopyConfirm = async () => {
    if (!copySource || !copyTargetHeroId) return;
    setLoading(true);
    try {
      const newMatchup = buildCopiedMatchup(copySource, copyTargetHeroId);
      const response = await fetch(`/api/decks/${deckId}/matchups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ matchup: newMatchup }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to copy matchup');
      }
      toast({
        title: "Copied",
        description: `Plan copied to ${getHeroDisplayName(copyTargetHeroId)}`,
      });
      setCopySource(null);
      setCopyTargetHeroId("");
      fetchMatchups();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to copy matchup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const getHeroDisplayName = (heroId: string) => {
    if (heroId === CORE_HERO_ID) return "Core";
    if (STRATEGY_MATCHUP_IDS[heroId]) return STRATEGY_MATCHUP_IDS[heroId];

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
              (() => {
                // Flat grid — sorted: Core first, then strategy presets, then heroes by class then name.
                const classOf = (heroId: string): string => {
                  const opt = HERO_OPTIONS.find(h => h.talisharId === heroId);
                  return (opt?.classes?.[0] ?? "zzz_other");
                };

                const sorted = [...matchups].sort((a, b) => {
                  if (a.heroId === CORE_HERO_ID) return -1;
                  if (b.heroId === CORE_HERO_ID) return 1;
                  const aS = !!STRATEGY_MATCHUP_IDS[a.heroId];
                  const bS = !!STRATEGY_MATCHUP_IDS[b.heroId];
                  if (aS && !bS) return -1;
                  if (!aS && bS) return 1;
                  if (!aS && !bS) {
                    const cls = classOf(a.heroId).localeCompare(classOf(b.heroId));
                    if (cls !== 0) return cls;
                  }
                  return getHeroDisplayName(a.heroId).localeCompare(getHeroDisplayName(b.heroId));
                });

                return (
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1">
                    {sorted.map((matchup) => {
                        const isCore = matchup.heroId === CORE_HERO_ID;
                        const isStrategy = !!STRATEGY_MATCHUP_IDS[matchup.heroId];
                        const stylizedPortrait = !isCore
                          ? (getHeroPortraitUrl(matchup.heroId) || getStrategyPortraitUrl(matchup.heroId))
                          : null;
                        const cardArt = !isCore && !stylizedPortrait
                          ? heroCardImages?.get(matchup.heroId) ?? null
                          : null;
                        const portrait = stylizedPortrait || cardArt;
                        const hasSideboard =
                          matchup.sideboard.out.length > 0 || matchup.sideboard.in.length > 0;
                        const heroName = getHeroDisplayName(matchup.heroId);
                        const shortName = heroName.split(",")[0];
                        return (
                          <div key={matchup.heroId} className="flex flex-col gap-1.5">
                            {/* Tile */}
                            <div className="relative aspect-[3/4] rounded overflow-hidden border-2 border-gray-700 bg-gray-900">
                              {portrait ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={portrait}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className={
                                    "w-full h-full object-cover object-top " +
                                    // Card-art fallback: zoom + top-anchor so the
                                    // character art fills the tile (not the full card).
                                    (cardArt ? "scale-[1.45] origin-top" : "")
                                  }
                                />
                              ) : isCore ? (
                                <div className="w-full h-full flex items-center justify-center bg-blue-950/40">
                                  <Bookmark className="h-8 w-8 text-blue-400" aria-hidden="true" />
                                </div>
                              ) : isStrategy ? (
                                <div className="w-full h-full flex items-center justify-center bg-purple-950/40">
                                  <Swords className="h-8 w-8 text-purple-400" aria-hidden="true" />
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-800 text-xs text-gray-300 px-1 text-center">
                                  {shortName}
                                </div>
                              )}
                              {/* Bottom overlay: name + counts */}
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-1 pt-2 pb-0.5">
                                <p className="text-xs font-bold text-white truncate text-left leading-tight">
                                  {shortName}
                                </p>
                                <p className="text-[10px] text-gray-200 leading-tight truncate">
                                  {hasSideboard
                                    ? `${matchup.sideboard.out.length}↓ ${matchup.sideboard.in.length}↑`
                                    : "—"}
                                </p>
                              </div>
                              {/* Top-right turn-order badge */}
                              {matchup.preferredTurnOrder && matchup.preferredTurnOrder !== "NoPreference" && (
                                <span className="absolute top-0.5 right-0.5 rounded bg-black/70 border border-gray-600 px-1 text-[10px] font-semibold text-gray-100 leading-tight">
                                  {matchup.preferredTurnOrder === "First" ? "1st" : "2nd"}
                                </span>
                              )}
                              {isCore && (
                                <span className="absolute top-0.5 left-0.5 rounded bg-blue-500/90 px-1 text-[10px] font-semibold text-white leading-tight">
                                  Base
                                </span>
                              )}
                            </div>
                            {/* Action row: View / Edit / Kebab — icon-only to fit picker-sized tiles */}
                            <div className="grid grid-cols-3 gap-0.5">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!hasSideboard}
                                onClick={() => setGallery({ heroId: matchup.heroId, section: 'inventory' })}
                                aria-label={`View sideboard cards for ${heroName} matchup`}
                                title={hasSideboard ? "View sideboard plan" : "No sideboard changes"}
                                className="h-7 w-full p-0 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                              >
                                <Swords className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { handleEdit(matchup); setActiveTab("add"); }}
                                aria-label={`Edit ${heroName} matchup`}
                                title="Edit matchup"
                                className="h-7 w-full p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    aria-label={`More actions for ${heroName} matchup`}
                                    title="More actions"
                                    className="h-7 w-full p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setCopySource(matchup);
                                      setCopyTargetHeroId("");
                                    }}
                                  >
                                    <Copy className="h-4 w-4 mr-2" aria-hidden="true" />
                                    Copy to another hero
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => handleDelete(matchup.heroId)}
                                    className="text-red-400 focus:text-red-300"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })()
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

        {/* Copy-to-another-hero picker */}
        <Dialog
          open={!!copySource}
          onOpenChange={(open) => {
            if (!open) {
              setCopySource(null);
              setCopyTargetHeroId("");
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Copy matchup
              </DialogTitle>
              <DialogDescription>
                {copySource && (
                  <>Copy the {getHeroDisplayName(copySource.heroId)} sideboard plan to another hero.</>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="copy-target" className="text-xs">Target Hero</Label>
              <Select value={copyTargetHeroId} onValueChange={setCopyTargetHeroId}>
                <SelectTrigger id="copy-target" className="h-9 text-sm">
                  <SelectValue placeholder="Select a hero..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {copySource && (() => {
                    const targets = getCopyTargets(copySource.heroId, matchups, HERO_OPTIONS);
                    if (targets.length === 0) {
                      return (
                        <div className="px-2 py-1.5 text-xs text-gray-500">
                          No eligible heroes — every other hero already has a matchup.
                        </div>
                      );
                    }
                    return targets.map((hero) => (
                      <SelectItem key={hero.talisharId} value={hero.talisharId}>
                        {hero.displayName}
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCopySource(null);
                  setCopyTargetHeroId("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!copyTargetHeroId || loading}
                onClick={handleCopyConfirm}
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );

  // Gallery overlay — shared by both inline and dialog renderings.
  const galleryCards = (() => {
      if (gallery?.section === 'deck') {
        // Apply this matchup's sideboard changes to the deck view:
        // sideboard.out → those cards leave the deck (moving to inventory)
        // sideboard.in  → those cards enter the deck (coming from inventory)
        const matchup = matchups.find(m => m.heroId === gallery?.heroId);
        if (!matchup?.sideboard?.in?.length && !matchup?.sideboard?.out?.length) {
          return deckGalleryCards;
        }
        const countMap = new Map<string, { count: number; displayName: string; printingId: string; imageUrl?: string }>();
        for (const c of deckGalleryCards) {
          countMap.set(c.talisharId, { count: c.count, displayName: c.displayName, printingId: c.printingId, imageUrl: c.imageUrl });
        }
        for (const id of matchup?.sideboard?.out ?? []) {
          const entry = countMap.get(id);
          if (entry) {
            entry.count -= 1;
            if (entry.count <= 0) countMap.delete(id);
          }
        }
        for (const id of matchup?.sideboard?.in ?? []) {
          const existing = countMap.get(id);
          if (existing) {
            existing.count += 1;
          } else {
            const invCard = inventoryGalleryCards.find(c => c.talisharId === id);
            countMap.set(id, { count: 1, displayName: invCard?.displayName ?? id, printingId: invCard?.printingId ?? id, imageUrl: invCard?.imageUrl });
          }
        }
        return Array.from(countMap.entries()).map(([talisharId, v]) => ({ talisharId, count: v.count, displayName: v.displayName, printingId: v.printingId, imageUrl: v.imageUrl }));
      }
      // Apply this matchup's sideboard changes to the inventory view:
      // sideboard.in  → those cards leave inventory (moving into the deck)
      // sideboard.out → those cards enter inventory (coming out of the deck)
      const matchup = matchups.find(m => m.heroId === gallery?.heroId);
      if (!matchup?.sideboard?.in?.length && !matchup?.sideboard?.out?.length) {
        return inventoryGalleryCards;
      }
      const countMap = new Map<string, { count: number; displayName: string; printingId: string; imageUrl?: string }>();
      for (const c of inventoryGalleryCards) {
        countMap.set(c.talisharId, { count: c.count, displayName: c.displayName, printingId: c.printingId, imageUrl: c.imageUrl });
      }
      for (const id of matchup?.sideboard?.in ?? []) {
        const entry = countMap.get(id);
        if (entry) {
          entry.count -= 1;
          if (entry.count <= 0) countMap.delete(id);
        }
      }
      for (const id of matchup?.sideboard?.out ?? []) {
        const existing = countMap.get(id);
        if (existing) {
          existing.count += 1;
        } else {
          const deckCard = deckGalleryCards.find(c => c.talisharId === id);
          countMap.set(id, { count: 1, displayName: deckCard?.displayName ?? id, printingId: deckCard?.printingId ?? id });
        }
      }
      return Array.from(countMap.entries()).map(([talisharId, v]) => ({ talisharId, count: v.count, displayName: v.displayName, printingId: v.printingId, imageUrl: v.imageUrl }));
    })();
    const galleryHeroName = gallery ? getHeroDisplayName(gallery.heroId) : '';
    const galleryTotal = galleryCards.reduce((s, c) => s + c.count, 0);
    const galleryLabel = gallery?.section === 'deck'
      ? 'Full Deck'
      : 'Sideboard Plan';
    const galleryAccent = gallery?.section === 'deck' ? 'text-blue-400' : 'text-amber-400';
    const isInventory = gallery?.section === 'inventory';
    const galleryLabelSize = isInventory ? 'text-xl' : 'text-sm';
    const gallerySubSize = isInventory ? 'text-sm' : 'text-xs';

    const galleryOverlay = gallery && (
          <div
            className="fixed inset-0 z-[60] bg-black/90 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={`${galleryLabel} — ${galleryHeroName}`}
          >
            {/* Header — 3-column grid keeps label truly centered */}
            <div className="grid grid-cols-[44px_1fr_44px] items-center px-4 py-4 flex-shrink-0 border-b border-white/10">
              {/* left spacer matches X button width */}
              <span />
              <div className="flex flex-col items-center gap-0.5 text-center">
                <span className={`${galleryLabelSize} font-sans font-bold ${galleryAccent}`}>
                  {galleryLabel}
                </span>
                <span className={`${gallerySubSize} text-gray-400 font-sans`}>
                  {galleryHeroName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setGallery(null)}
                aria-label="Close gallery"
                className="flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            {/* View-mode toggle — only for the sideboard-plan (inventory) view */}
            {isInventory && (
              <div className="flex flex-col items-center gap-1 px-4 pt-3 pb-2 flex-shrink-0 border-b border-white/5">
                <div
                  role="radiogroup"
                  aria-label="Sideboard view mode"
                  className="inline-flex rounded-md border border-gray-700 bg-gray-950 overflow-hidden"
                >
                  {([
                    { v: 'vsDeck' as const, label: 'vs Main Deck' },
                    { v: 'setAside' as const, label: 'Set Aside' },
                    { v: 'fullDeck' as const, label: 'Full Deck' },
                  ]).map((opt, i) => {
                    const active = galleryView === opt.v;
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => updateGalleryView(opt.v)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                          i > 0 ? 'border-l border-gray-700' : ''
                        } ${
                          active
                            ? 'bg-amber-500/15 text-amber-300 border-t-[3px] border-t-amber-400'
                            : 'text-gray-300 hover:text-white hover:bg-white/5 border-t-[3px] border-t-transparent'
                        }`}
                      >
                        {active && <span aria-hidden="true">✓ </span>}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-300 text-center">
                  {galleryView === 'vsDeck'
                    ? 'Cards to remove from the deck · cards to bring in from the sideboard'
                    : galleryView === 'setAside'
                    ? 'Everything not in your matchup deck — pull these from the combined pile'
                    : 'Your complete deck after sideboarding — ready to present'}
                </p>
              </div>
            )}

            {/* ── Mobile: sectioned sideboard view (only for "Side These Out") ── */}
            {isInventory && (() => {
              const currentMatchup = matchups.find(m => m.heroId === gallery?.heroId);
              const SECTION_CONFIG = [
                { key: 'equipment' as const, label: 'Equipment & Weapons', dot: 'bg-gray-400' },
                { key: 'red'       as const, label: 'Library — Red',       dot: 'bg-red-500' },
                { key: 'yellow'    as const, label: 'Library — Yellow',    dot: 'bg-yellow-400' },
                { key: 'blue'      as const, label: 'Library — Blue',      dot: 'bg-blue-500' },
                { key: 'unpitched' as const, label: 'Library',             dot: 'bg-gray-500' },
              ];

              // vsDeck view — dedup sideboard.out grouped by section + sideboard.in
              const outBySection = new Map<string, Map<string, number>>();
              for (const s of SECTION_CONFIG) outBySection.set(s.key, new Map());
              for (const id of currentMatchup?.sideboard?.out ?? []) {
                const section = getCardSection(id);
                const m = outBySection.get(section)!;
                m.set(id, (m.get(id) ?? 0) + 1);
              }

              const inCounts = new Map<string, number>();
              for (const id of currentMatchup?.sideboard?.in ?? []) {
                inCounts.set(id, (inCounts.get(id) ?? 0) + 1);
              }

              // setAside view — galleryCards is already (inventory + out − in); group by section.
              const setAsideBySection = new Map<string, GalleryCard[]>();
              for (const s of SECTION_CONFIG) setAsideBySection.set(s.key, []);
              for (const card of galleryCards) {
                setAsideBySection.get(getCardSection(card.talisharId))!.push(card);
              }
              const setAsideEmpty = galleryCards.length === 0;

              const CardImg = ({ card }: { card: GalleryCard }) => (
                <div className="flex flex-col gap-1">
                  <div className="relative aspect-[5/7] rounded-lg overflow-hidden shadow-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.imageUrl || `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${card.printingId}/public`}
                      alt={card.displayName}
                      className="w-full h-full object-cover object-top"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/cardback.webp'; }}
                    />
                  </div>
                  <span className="text-xs text-gray-300 font-sans text-center leading-tight truncate">
                    {card.count > 1 && <span className="text-gray-400 font-bold">{card.count}× </span>}
                    {card.displayName}
                  </span>
                </div>
              );

              const gridCls = 'grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5 md:gap-2';

              // Summary counts helper — compute card totals per pitch color for a given set of cards
              const computeSummaryCounts = (cards: { talisharId: string; count: number }[]) => {
                let equipment = 0, red = 0, yellow = 0, blue = 0, unpitched = 0;
                for (const c of cards) {
                  const s = getCardSection(c.talisharId);
                  if (s === 'equipment') equipment += c.count;
                  else if (s === 'red') red += c.count;
                  else if (s === 'yellow') yellow += c.count;
                  else if (s === 'blue') blue += c.count;
                  else unpitched += c.count;
                }
                return { equipment, red, yellow, blue, unpitched, total: equipment + red + yellow + blue + unpitched };
              };

              const SummaryBar = ({ counts }: { counts: ReturnType<typeof computeSummaryCounts> }) => (
                <div className="flex items-center gap-3 text-sm font-sans flex-wrap">
                  <span className="font-bold text-gray-100">{counts.total} cards</span>
                  {counts.equipment > 0 && (
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /><span className="text-gray-300">{counts.equipment}</span></span>
                  )}
                  {counts.red > 0 && (
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-gray-300">{counts.red}</span></span>
                  )}
                  {counts.yellow > 0 && (
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /><span className="text-gray-300">{counts.yellow}</span></span>
                  )}
                  {counts.blue > 0 && (
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-gray-300">{counts.blue}</span></span>
                  )}
                  {counts.unpitched > 0 && (
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500" /><span className="text-gray-300">{counts.unpitched}</span></span>
                  )}
                </div>
              );

              // fullDeck view — compute the complete post-sideboard deck grouped by section
              const fullDeckBySection = new Map<string, GalleryCard[]>();
              for (const s of SECTION_CONFIG) fullDeckBySection.set(s.key, []);
              // Build post-sideboard deck: start with base deck, apply out/in
              const fullDeckMap = new Map<string, { count: number; displayName: string; printingId: string }>();
              for (const c of deckGalleryCards) {
                fullDeckMap.set(c.talisharId, { count: c.count, displayName: c.displayName, printingId: c.printingId });
              }
              for (const id of currentMatchup?.sideboard?.out ?? []) {
                const entry = fullDeckMap.get(id);
                if (entry) {
                  entry.count -= 1;
                  if (entry.count <= 0) fullDeckMap.delete(id);
                }
              }
              for (const id of currentMatchup?.sideboard?.in ?? []) {
                const existing = fullDeckMap.get(id);
                if (existing) {
                  existing.count += 1;
                } else {
                  const invCard = inventoryGalleryCards.find(c => c.talisharId === id);
                  fullDeckMap.set(id, { count: 1, displayName: invCard?.displayName ?? id, printingId: invCard?.printingId ?? id });
                }
              }
              for (const [talisharId, v] of fullDeckMap) {
                const section = getCardSection(talisharId);
                fullDeckBySection.get(section)!.push({ talisharId, count: v.count, displayName: v.displayName, printingId: v.printingId });
              }
              const fullDeckTotal = Array.from(fullDeckMap.values()).reduce((s, v) => s + v.count, 0);

              return (
                <div className="flex-1 overflow-y-scroll overscroll-contain p-4 space-y-5" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {galleryView === 'vsDeck' ? (
                    <>
                      {/* Side Out — grouped by deck section */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Side Out</p>
                          <SummaryBar counts={computeSummaryCounts(
                            Array.from(outBySection.entries()).flatMap(([key, m]) =>
                              Array.from(m.entries()).map(([id, qty]) => ({ talisharId: id, count: qty }))
                            )
                          )} />
                        </div>
                        {SECTION_CONFIG.every(s => (outBySection.get(s.key)?.size ?? 0) === 0) ? (
                          <p className="text-sm text-gray-300 italic">No cards to side out.</p>
                        ) : SECTION_CONFIG.map(s => {
                          const cards = outBySection.get(s.key)!;
                          if (cards.size === 0) return null;
                          const sectionTotal = Array.from(cards.values()).reduce((a, b) => a + b, 0);
                          return (
                            <div key={s.key} className="mb-4">
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                                <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                                  {s.label}
                                  <span className="ml-1.5 text-gray-400 font-normal">({sectionTotal})</span>
                                </p>
                              </div>
                              <div className={gridCls}>
                                {Array.from(cards.entries()).map(([id, qty]) => {
                                  const gc = galleryCards.find(c => c.talisharId === id) ?? { talisharId: id, count: qty, displayName: cardNameMap.get(id) ?? id, printingId: id };
                                  return <CardImg key={id} card={{ ...gc, count: qty }} />;
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Bring In */}
                      {inCounts.size > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-green-400 uppercase tracking-wide">Bring In</p>
                            <SummaryBar counts={computeSummaryCounts(
                              Array.from(inCounts.entries()).map(([id, qty]) => ({ talisharId: id, count: qty }))
                            )} />
                          </div>
                          <div className={gridCls}>
                            {Array.from(inCounts.entries()).map(([id, qty]) => {
                              const gc = inventoryGalleryCards.find(c => c.talisharId === id) ?? { talisharId: id, count: qty, displayName: cardNameMap.get(id) ?? id, printingId: id };
                              return <CardImg key={id} card={{ ...gc, count: qty }} />;
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : galleryView === 'setAside' ? (
                    /* Set Aside — single pile of everything not in the matchup deck */
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Side Out</p>
                        <SummaryBar counts={computeSummaryCounts(galleryCards)} />
                      </div>
                      {setAsideEmpty ? (
                        <p className="text-sm text-gray-300 italic">Nothing to set aside.</p>
                      ) : SECTION_CONFIG.map(s => {
                        const cards = setAsideBySection.get(s.key)!;
                        if (cards.length === 0) return null;
                        const sectionTotal = cards.reduce((a, c) => a + c.count, 0);
                        return (
                          <div key={s.key} className="mb-4">
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                                {s.label}
                                <span className="ml-1.5 text-gray-400 font-normal">({sectionTotal})</span>
                              </p>
                            </div>
                            <div className={gridCls}>
                              {cards.map(card => <CardImg key={card.talisharId} card={card} />)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Full Deck — complete post-sideboard deck for presentation */
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Full Deck</p>
                        <SummaryBar counts={computeSummaryCounts(
                          Array.from(fullDeckMap.entries()).map(([id, v]) => ({ talisharId: id, count: v.count }))
                        )} />
                      </div>
                      {SECTION_CONFIG.map(s => {
                        const cards = fullDeckBySection.get(s.key)!;
                        if (cards.length === 0) return null;
                        return (
                          <div key={s.key} className="mb-4">
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                                {s.label}
                                <span className="ml-1.5 text-gray-400 font-normal">
                                  ({cards.reduce((sum, c) => sum + c.count, 0)})
                                </span>
                              </p>
                            </div>
                            <div className={gridCls}>
                              {cards.map(card => <CardImg key={card.talisharId} card={card} />)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Non-inventory gallery (deck view) — flat grid on all screen sizes */}
            {!isInventory && (
              <div className="flex-1 overflow-y-scroll overscroll-contain p-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                {galleryCards.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500 italic font-sans">No cards in this section</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {galleryCards.map((card) => (
                      <div key={card.talisharId} className="flex flex-col gap-1.5">
                        <div className="relative aspect-[5/7] rounded-lg overflow-hidden shadow-xl">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={card.imageUrl || `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${card.printingId}/public`}
                            alt={card.displayName}
                            className="w-full h-full object-cover object-top"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/cardback.webp'; }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-300 font-sans text-center leading-tight truncate">
                          {card.count > 1 && <span className="text-gray-400 font-bold">{card.count}× </span>}
                          {card.displayName}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
    );

  if (inline) {
    return (
      <>
        {matchupsContent}
        {galleryOverlay}
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && gallery) { setGallery(null); return; } onOpenChange(v); }}>
      <DialogContent
        className={
          gallery
            ? 'fixed inset-0 z-50 !max-w-none !w-auto !max-h-none !translate-x-0 !translate-y-0 !top-0 !left-0 border-0 bg-transparent p-0 shadow-none [&>button:last-child]:hidden'
            : 'max-w-[1400px] w-[95vw] max-h-[90vh] overflow-y-auto'
        }
      >
        <DialogHeader className={gallery ? 'sr-only' : undefined}>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            Matchup Sideboards
          </DialogTitle>
          <DialogDescription>
            Configure sideboard plans for specific opponent heroes
          </DialogDescription>
        </DialogHeader>
        {!gallery && matchupsContent}
        {galleryOverlay}
      </DialogContent>
    </Dialog>
  );
}
