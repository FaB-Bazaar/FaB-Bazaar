"use client";

// Deck Tools command HUD (Cmd/Ctrl+K): chord keys for jumping, highlighting
// (A/C/D/T/K/W/S/X), ownership views (O/U), adding cards (9/8/7) and the
// on-screen HUD. Extracted verbatim from the classic deck page so the classic
// page and deck v2 share one implementation. Returns the open state, the HUD
// element (render it once) and the "⌘K Deck Tools" trigger.

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { DeckCategory, DeckDTO } from "@/lib/services/contracts/IDeckService";
import { KEYWORDS } from "@/lib/fab-constants/keywords";
import MobileBuildToolsPanel from "@/components/deck/editor/MobileBuildToolsPanel";
import { useIsMac } from "@/components/ui/use-client-env";
import type { QuickAddTarget } from "@/lib/deck/quickAddRouting";
import { cn } from "@/lib/utils";

export interface DeckCommandHudOptions {
  deck: DeckDTO | null;
  deckId: string;
  canEdit: boolean;
  openQuickAdd: (target: QuickAddTarget) => void;
  /** Classic page tabs: D / jump keys switch to the Deck tab first. Pages
   *  without tabs (deck v2) leave these out — they're always "on the deck". */
  activeTab?: string;
  setActiveTab?: (tab: "deck") => void;
}

export function useDeckCommandHud({ deck, deckId, canEdit, openQuickAdd, activeTab = "deck", setActiveTab = () => {} }: DeckCommandHudOptions) {
  const router = useRouter();
  const state = { deck };
  const isMac = useIsMac();
  const modKey = isMac ? '⌘' : 'Ctrl';

  const NON_CLASS_TYPES = new Set(['hero', 'young', 'adult', 'action', 'attack', 'defense', 'reaction', 'instant', 'equipment', 'weapon', 'token', 'mentor', 'demi-hero', 'evo']);
  const heroTypes: string[] = ((state.deck?.hero?.[0]?.printingDetails as any)?.types || []).map((t: string) => t.toLowerCase());
  const heroClass = heroTypes.find(t => !NON_CLASS_TYPES.has(t)) || '';

  const [chordMode, setChordMode] = useState<null | 'select' | 'attack' | 'cost' | 'defense' | 'type' | 'keyword' | 'clear' | 'arcane' | 'nameFilter' | 'textFilter'>(null);
  const [chordExiting, setChordExiting] = useState(false);
  const [keywordBuffer, setKeywordBuffer] = useState('');
  // Tile size — synced from DeckEditorListView via custom events
  const [tileSize, setTileSize] = useState({ idx: 0, label: 'Compact', total: 3 });
  // Ownership filter — mirrored locally so the mobile Build Tools panel can show pressed state.
  // Keyboard chords (O/U) toggle; mobile panel sets explicitly via { setExplicit: true }.
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'owned' | 'unowned'>('all');
  const dispatchOwnershipFilter = (filter: 'all' | 'owned' | 'unowned', setExplicit: boolean) => {
    window.dispatchEvent(new CustomEvent('deck-ownership-filter', { detail: { filter, setExplicit } }));
    if (setExplicit) setOwnershipFilter(filter);
    else setOwnershipFilter(prev => (prev === filter ? 'all' : filter));
  };
  // Range picker state for numeric highlight sub-modes
  const [hudRangeMin, setHudRangeMin] = useState(0);
  const [hudRangeMax, setHudRangeMax] = useState(9);
  // Track which filter values are currently active (for chip active-state rendering)
  const [activeHighlights, setActiveHighlights] = useState<Map<string, Set<number | string>>>(new Map());

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const resetChord = () => { setChordMode(null); setKeywordBuffer(''); clearTimeout(timeout); };
    const startTimeout = () => { clearTimeout(timeout); timeout = setTimeout(resetChord, 2000); };

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setChordMode('select');
        startTimeout();
        return;
      }

      if (e.key === 'Escape') {
        if (chordMode) { resetChord(); return; }
        // Double-Escape: if no chord active, clear all highlight filters
        window.dispatchEvent(new CustomEvent('deck-highlight-clear'));
        return;
      }
      if (!chordMode) return;
      // When a chord is active it takes priority over any focused input
      // (isTyping only blocks chord *entry*, not chord *continuation*)
      e.preventDefault();

      if (chordMode === 'select') {
        // Navigation & actions
        if (e.key === '9') { openQuickAdd({ category: 'maindeck' }); resetChord(); }
        else if (e.key === '8') { openQuickAdd({ category: 'inventory' }); resetChord(); }
        else if (e.key === '7') { openQuickAdd({ category: 'benched' as DeckCategory }); resetChord(); }
        else if (e.key.toLowerCase() === 's') { setChordMode('nameFilter'); setKeywordBuffer(''); startTimeout(); }
        else if (e.key.toLowerCase() === 'x') { setChordMode('textFilter'); setKeywordBuffer(''); startTimeout(); }
        else if (e.key.toLowerCase() === 'm') { router.push(`/decks/${deckId}/matchups`); resetChord(); }
        // Scroll
        else if (e.key === '0') { window.scrollTo({ top: 0, behavior: 'smooth' }); resetChord(); }
        else if (e.key === '1') { document.getElementById('deck-section-red')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); resetChord(); }
        else if (e.key === '2') { document.getElementById('deck-section-yellow')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); resetChord(); }
        else if (e.key === '3') { document.getElementById('deck-section-blue')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); resetChord(); }
        else if (e.key === '4') { document.getElementById('deck-section-inventory')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); resetChord(); }
        // Filter sub-modes (only on deck tab — otherwise D switches to deck tab)
        else if (e.key.toLowerCase() === 'd' && activeTab !== 'deck') { setActiveTab('deck'); resetChord(); }
        else if (e.key.toLowerCase() === 'a') { setChordMode('attack'); startTimeout(); }
        else if (e.key.toLowerCase() === 'c') { setChordMode('cost'); startTimeout(); }
        else if (e.key.toLowerCase() === 'd') { setChordMode('defense'); startTimeout(); }
        else if (e.key.toLowerCase() === 't') { setChordMode('type'); startTimeout(); }
        else if (e.key.toLowerCase() === 'k') { setChordMode('keyword'); setKeywordBuffer(''); startTimeout(); }
        else if (e.key.toLowerCase() === 'f') { setChordMode('clear'); startTimeout(); }
        else if (e.key.toLowerCase() === 'w') { setChordMode('arcane'); startTimeout(); }
        else if (e.key.toLowerCase() === 'o') { dispatchOwnershipFilter('owned', false); resetChord(); }
        else if (e.key.toLowerCase() === 'u') { dispatchOwnershipFilter('unowned', false); resetChord(); }
        else { resetChord(); }
        return;
      }

      const scrollToRed = () => document.getElementById('deck-section-red')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
      const EQUIPMENT_KEYWORDS = new Set(['battleworn', 'arcane barrier', 'blade break', 'cloaked', 'modular', 'spellvoid', 'quell', 'temper', 'unity', 'guardwell']);
      const scrollForKeyword = (kw: string) => EQUIPMENT_KEYWORDS.has(kw) ? scrollToTop() : scrollToRed();

      // Helper: dispatch a range of highlight filter values (e.g. power 4-6)
      const dispatchRangeFilters = (stat: string, lo: number, hi: number) => {
        const [start, end] = [Math.min(lo, hi), Math.max(lo, hi)];
        for (let v = start; v <= end; v++) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat, value: v, additive: true } }));
        }
        scrollToRed();
        resetChord();
      };

      if (chordMode === 'attack') {
        // Range syntax: press "-" first to start a range (e.g. "-4-6" = power 4,5,6)
        if (keywordBuffer.startsWith('-')) {
          const buf = keywordBuffer + e.key;
          const rangeMatch = buf.match(/^-(\d)-(\d)$/);
          if (rangeMatch) { dispatchRangeFilters('power', parseInt(rangeMatch[1]), parseInt(rangeMatch[2])); return; }
          if (e.key === 'Escape' || e.key === 'Enter') { resetChord(); return; }
          setKeywordBuffer(buf); startTimeout(); return;
        }
        if (e.key === '-') { setKeywordBuffer('-'); startTimeout(); return; }
        const n = parseInt(e.key);
        if (!isNaN(n) && n >= 0 && n <= 9) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'power', value: n } }));
          scrollToRed();
        }
        resetChord();
        return;
      }

      if (chordMode === 'cost') {
        if (keywordBuffer.startsWith('-')) {
          const buf = keywordBuffer + e.key;
          const rangeMatch = buf.match(/^-(\d)-(\d)$/);
          if (rangeMatch) { dispatchRangeFilters('cost', parseInt(rangeMatch[1]), parseInt(rangeMatch[2])); return; }
          if (e.key === 'Escape' || e.key === 'Enter') { resetChord(); return; }
          setKeywordBuffer(buf); startTimeout(); return;
        }
        if (e.key === '-') { setKeywordBuffer('-'); startTimeout(); return; }
        const n = parseInt(e.key);
        if (!isNaN(n) && n >= 0 && n <= 9) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'cost', value: n } }));
          scrollToRed();
        }
        resetChord();
        return;
      }

      if (chordMode === 'defense') {
        if (keywordBuffer.startsWith('-')) {
          const buf = keywordBuffer + e.key;
          const rangeMatch = buf.match(/^-(\d)-(\d)$/);
          if (rangeMatch) { dispatchRangeFilters('defense', parseInt(rangeMatch[1]), parseInt(rangeMatch[2])); return; }
          if (e.key === 'Escape' || e.key === 'Enter') { resetChord(); return; }
          setKeywordBuffer(buf); startTimeout(); return;
        }
        if (e.key === '-') { setKeywordBuffer('-'); startTimeout(); return; }
        const n = parseInt(e.key);
        if (!isNaN(n) && n >= 0 && n <= 9) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'defense', value: n } }));
          scrollToRed();
        }
        resetChord();
        return;
      }

      if (chordMode === 'arcane') {
        const n = parseInt(e.key);
        if (!isNaN(n) && n >= 1 && n <= 9) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'arcane', value: n } }));
          scrollToRed();
        }
        resetChord();
        return;
      }

      if (chordMode === 'type') {
        const TYPE_KEYS: Record<string, string> = {
          'a': 'attack',
          'n': 'non-attack',
          'i': 'item',
          't': 'instant',
          'd': 'defense-reaction',
          'r': 'attack-reaction',
          'e': 'equipment',
          'w': 'weapon',
          'g': 'generic',
          'h': 'hero',
          'b': 'block',
          'm': 'item',
          'z': 'ally',
          's': 'base',
          'v': 'evo',
          'u': 'aura',
          'c': heroClass || '',
        };
        const val = TYPE_KEYS[e.key.toLowerCase()];
        if (val) {
          window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'type', value: val } }));
          scrollToRed();
        }
        resetChord();
        return;
      }

      if (chordMode === 'keyword') {
        if (e.key === 'Backspace') {
          setKeywordBuffer(prev => prev.slice(0, -1));
          startTimeout();
          return;
        }
        if (e.key === 'Enter') {
          const matches = (KEYWORDS as readonly string[]).filter(k => k.startsWith(keywordBuffer));
          if (matches.length >= 1) {
            window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'keyword', value: matches[0] } }));
            scrollForKeyword(matches[0]);
          }
          resetChord();
          setKeywordBuffer('');
          return;
        }
        const char = e.key.toLowerCase();
        if (/^[a-z ]$/.test(char)) {
          const next = keywordBuffer + char;
          setKeywordBuffer(next);
          const matches = (KEYWORDS as readonly string[]).filter(k => k.startsWith(next));
          if (matches.length === 1) {
            window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'keyword', value: matches[0] } }));
            scrollForKeyword(matches[0]);
            resetChord();
            setKeywordBuffer('');
          } else if (matches.length === 0) {
            setKeywordBuffer('');
            startTimeout();
          } else {
            startTimeout();
          }
        }
        return;
      }

      // S = card name, X = rules text (effects that aren't keywords: discard,
      // Gate to I'arathael, Corrupted Corpse…). Same type-then-Enter buffer.
      if (chordMode === 'nameFilter' || chordMode === 'textFilter') {
        if (e.key === 'Backspace') {
          setKeywordBuffer(prev => prev.slice(0, -1));
          startTimeout();
          return;
        }
        if (e.key === 'Enter') {
          if (keywordBuffer.trim()) {
            const stat = chordMode === 'textFilter' ? 'text' : 'name';
            window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat, value: keywordBuffer.trim() } }));
          }
          resetChord();
          return;
        }
        if (e.key === 'Escape') { resetChord(); return; }
        if (e.key.length === 1) {
          setKeywordBuffer(prev => prev + e.key);
          startTimeout();
        }
        return;
      }

      if (chordMode === 'clear') {
        if (e.key === '0') window.dispatchEvent(new CustomEvent('deck-highlight-clear'));
        resetChord();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); clearTimeout(timeout); };
  }, [chordMode, activeTab, keywordBuffer]);

  // Clicking / tapping outside the Deck Tools HUD closes it (parity with Esc and ✕).
  // Containers are tagged data-deck-hud; anything else on the page dismisses.
  useEffect(() => {
    if (!chordMode) return;
    const handler = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest('[data-deck-hud]')) return;
      setChordMode(null);
      setKeywordBuffer('');
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [chordMode]);

  // Sync tile size label from DeckEditorListView broadcasts
  useEffect(() => {
    const handler = (e: Event) => {
      const { idx, label, total } = (e as CustomEvent<{ idx: number; label: string; total: number }>).detail;
      setTileSize({ idx, label, total });
    };
    window.addEventListener('deck-tile-size-update', handler);
    return () => window.removeEventListener('deck-tile-size-update', handler);
  }, []);

  // Reset range pickers when entering a numeric sub-mode
  useEffect(() => {
    if (chordMode === 'arcane') { setHudRangeMin(1); setHudRangeMax(9); }
    else if (chordMode === 'attack' || chordMode === 'cost' || chordMode === 'defense') { setHudRangeMin(0); setHudRangeMax(9); }
  }, [chordMode]);

  // Track active highlight filters so chips can show their active state
  useEffect(() => {
    const filterHandler = (e: Event) => {
      const { stat, value, additive } = (e as CustomEvent<{ stat: string; value: number | string; additive?: boolean }>).detail;
      setActiveHighlights(prev => {
        const next = new Map(prev);
        if (!additive) {
          next.set(stat, new Set([value]));
        } else {
          const existing = next.get(stat) ?? new Set();
          next.set(stat, new Set([...existing, value]));
        }
        return next;
      });
    };
    const clearHandler = () => setActiveHighlights(new Map());
    window.addEventListener('deck-highlight-filter', filterHandler);
    window.addEventListener('deck-highlight-clear', clearHandler);
    return () => {
      window.removeEventListener('deck-highlight-filter', filterHandler);
      window.removeEventListener('deck-highlight-clear', clearHandler);
    };
  }, []);

  const renderToolsTrigger = (inRail = false) => (
    <button
      type="button"
      onClick={() => setChordMode('select')}
      className={cn(
        "flex items-center gap-2.5 bg-gray-900 border border-blue-400/60 rounded-full px-5 py-2 text-sm text-gray-200 hover:text-white hover:border-blue-300/90 hover:bg-gray-800 transition-all duration-200 group",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
        // The floating pill is tuned for sitting over content; inside the rail it needs a
        // solid ground so the light theme keeps its contrast.
        inRail && "w-full justify-center bg-gray-900 hover:bg-gray-800 dark:bg-black/40 dark:hover:bg-black/55",
      )}
    >
      {/* Keyboard hints are desktop-only chrome — meaningless on touch. */}
      <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono text-[10px] border border-white/20 group-hover:text-white transition-colors">{modKey}K</kbd>
      <span>Deck Tools</span>
      <span className="text-blue-400/70 group-hover:text-blue-300 transition-colors">▸</span>
    </button>
  );

  const hud = !chordMode ? null : (() => {
        const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const scrollRed = () => scrollTo('deck-section-red');
        const EQUIPMENT_KW = new Set(['battleworn', 'arcane barrier', 'blade break', 'cloaked', 'modular', 'spellvoid', 'quell', 'temper', 'unity', 'guardwell']);
        const scrollForKw = (kw: string) => EQUIPMENT_KW.has(kw) ? window.scrollTo({ top: 0, behavior: 'smooth' }) : scrollRed();
        const SELECT_ACTIONS: Record<string, () => void> = {
          '0': () => { window.scrollTo({ top: 0, behavior: 'smooth' }); setChordMode(null); },
          '1': () => { scrollTo('deck-section-red'); setChordMode(null); },
          '2': () => { scrollTo('deck-section-yellow'); setChordMode(null); },
          '3': () => { scrollTo('deck-section-blue'); setChordMode(null); },
          '4': () => { scrollTo('deck-section-inventory'); setChordMode(null); },
          '7': () => { openQuickAdd({ category: 'benched' as DeckCategory }); setChordMode(null); },
          '8': () => { openQuickAdd({ category: 'inventory' }); setChordMode(null); },
          '9': () => { openQuickAdd({ category: 'maindeck' }); setChordMode(null); },
          'A': () => setChordMode('attack'),
          'C': () => setChordMode('cost'),
          'D': () => { if (activeTab !== 'deck') { setActiveTab('deck'); setChordMode(null); } else setChordMode('defense'); },
          'T': () => setChordMode('type'),
          'K': () => { setChordMode('keyword'); setKeywordBuffer(''); },
          'F': () => setChordMode('clear'),
          'W': () => setChordMode('arcane'),
          'S': () => { setChordMode('nameFilter'); setKeywordBuffer(''); },
          'X': () => { setChordMode('textFilter'); setKeywordBuffer(''); },
          'M': () => { router.push(`/decks/${deckId}/matchups`); setChordMode(null); },
          'O': () => { dispatchOwnershipFilter('owned', false); setChordMode(null); },
          'U': () => { dispatchOwnershipFilter('unowned', false); setChordMode(null); },
        };
        const STAT_MAP: Record<string, string> = { attack: 'power', cost: 'cost', defense: 'defense', arcane: 'arcane' };
        // ── Deck distribution map for chip frequency bars ──────────────────────
        const statField = STAT_MAP[chordMode!];
        const deckDistMap = new Map<number, number>();
        if (statField && chordMode !== 'type') {
          const allCards = [
            ...(state.deck?.maindeck ?? []),
            ...(state.deck?.equipment ?? []),
            ...(state.deck?.inventory ?? []),
          ];
          for (const card of allCards) {
            const val = (card.printingDetails as Record<string, unknown>)?.[statField];
            if (val != null && typeof val === 'number') {
              deckDistMap.set(val, (deckDistMap.get(val) ?? 0) + (card.quantity ?? 1));
            }
          }
        }
        const maxDistCount = deckDistMap.size > 0 ? Math.max(...Array.from(deckDistMap.values())) : 0;
        const activeVals = activeHighlights.get(statField ?? '') ?? new Set<number | string>();
        // ── Type distribution map for type chips ───────────────────────────────
        const typeDistMap = new Map<string, number>();
        if (chordMode === 'type') {
          const allCards = [
            ...(state.deck?.maindeck ?? []),
            ...(state.deck?.equipment ?? []),
            ...(state.deck?.inventory ?? []),
          ];
          for (const card of allCards) {
            const types = (card.printingDetails?.types ?? []) as string[];
            const qty = card.quantity ?? 1;
            for (const t of types) typeDistMap.set(t, (typeDistMap.get(t) ?? 0) + qty);
          }
        }
        const activeTypeVals = activeHighlights.get('type') ?? new Set<number | string>();
        const TYPE_KEYS: Record<string, string> = { A: 'attack', N: 'non-attack', I: 'item', T: 'instant', D: 'defense-reaction', R: 'attack-reaction', E: 'equipment', W: 'weapon', G: 'generic', B: 'block', M: 'item', Z: 'ally', S: 'base', U: 'aura', V: 'evo', C: heroClass };
        const hudBtn = "flex items-center gap-2 cursor-pointer rounded px-1.5 py-0.5 -mx-1.5 hover:bg-gray-700/60 transition-colors";
        const isOverlayMode = chordMode === 'type' || chordMode === 'attack' || chordMode === 'cost' || chordMode === 'defense' || chordMode === 'arcane';
        const exitChord = () => {
          setChordExiting(true);
          setTimeout(() => { setChordMode(null); setKeywordBuffer(''); setChordExiting(false); }, 160);
        };
        const overlayChips: { key: string; label: string }[] = chordMode === 'type'
          ? [
              { key: 'A', label: 'Attack' },
              { key: 'N', label: 'Non-Attack' },
              { key: 'I', label: 'Item' },
              { key: 'T', label: 'Instant' },
              { key: 'D', label: 'Def Reaction' },
              { key: 'R', label: 'Atk Reaction' },
              { key: 'E', label: 'Equipment' },
              { key: 'W', label: 'Weapon' },
              { key: 'B', label: 'Block' },
              //ideally ally, evo, base, aura only shows up as an option when there are ally cards in a card pool of the hero
              { key: 'Z', label: 'Ally' },
              { key: 'U', label: 'Aura' },
              { key: 'S', label: 'Base' },
              { key: 'V', label: 'Evo' }, 
              { key: 'G', label: 'Generic' },
              ...(heroClass ? [{ key: 'C', label: heroClass.charAt(0).toUpperCase() + heroClass.slice(1) }] : []),
            ]
          : chordMode === 'arcane'
          ? [1,2,3,4,5,6,7,8,9].map(n => ({ key: String(n), label: String(n) }))
          : isOverlayMode
          ? [0,1,2,3,4,5,6,7,8,9].map(n => ({ key: String(n), label: String(n) }))
          : [];
        return (
          <>
            {/* Sub-mode chip overlay (type / attack / cost / defense / arcane) */}
            {isOverlayMode && !keywordBuffer.startsWith('-') && (
              <div
                data-deck-hud
                className="fixed left-1/2 -translate-x-1/2 z-50"
                style={{ bottom: '76px', width: chordMode === 'type' ? 'min(820px, 96vw)' : 'min(620px, 96vw)' }}
              >
                <div className="bg-gray-950 border border-gray-600 rounded-2xl shadow-2xl overflow-hidden">

                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-base font-medium text-gray-200 hover:text-white transition-colors rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-950"
                      onClick={() => setChordMode('select')}
                      aria-label="Back to Deck Tools menu"
                    >
                      ← Back
                    </button>
                    <span className="text-base font-bold text-white tracking-wide">
                      {{ attack: 'Attack Power', cost: 'Card Cost', defense: 'Defense Value', type: 'Card Type', arcane: 'Arcane Damage' }[chordMode]}
                    </span>
                    <span className="text-sm text-gray-300 text-right max-w-[180px] leading-tight">
                      {chordMode === 'type' ? 'Click a type or press its key' : 'Click a value to highlight matching cards'}
                    </span>
                  </div>

                  {/* Chip grid */}
                  <div
                    className="grid gap-2 p-4"
                    style={{ gridTemplateColumns: chordMode === 'type' ? 'repeat(4, 1fr)' : 'repeat(5, 1fr)' }}
                  >
                    {overlayChips.map((chip, i) => {
                      const isNumeric = chordMode !== 'type';
                      const chipNum = isNumeric ? parseInt(chip.key) : NaN;
                      const typeVal = !isNumeric ? TYPE_KEYS[chip.key] : '';
                      const chipCount = isNumeric ? (deckDistMap.get(chipNum) ?? 0) : (typeDistMap.get(typeVal) ?? 0);
                      const isZero = (isNumeric ? maxDistCount > 0 : typeDistMap.size > 0) && chipCount === 0;
                      const isActive = isNumeric ? activeVals.has(chipNum) : activeTypeVals.has(typeVal);
                      const lo = Math.min(hudRangeMin, hudRangeMax);
                      const hi = Math.max(hudRangeMin, hudRangeMax);
                      const inRange = isNumeric && !isNaN(chipNum) && chipNum >= lo && chipNum <= hi;
                      // 4 muted color groups — SC 1.4.1 compliant: text label is the non-color cue
                      // Background intensity scales with card count (heatmap): 10%–40% opacity range
                      type TypeTheme = { rgb: string; border: string; kbd: string };
                      const TYPE_GROUP: Record<string, TypeTheme> = {
                        A: { rgb: '127,29,29',   border: 'border-red-700/50',    kbd: 'bg-red-950/80 border-red-700/60' },
                        N: { rgb: '127,29,29',   border: 'border-red-700/50',    kbd: 'bg-red-950/80 border-red-700/60' },
                        R: { rgb: '127,29,29',   border: 'border-red-700/50',    kbd: 'bg-red-950/80 border-red-700/60' },
                        D: { rgb: '127,29,29',   border: 'border-red-700/50',    kbd: 'bg-red-950/80 border-red-700/60' },
                        B: { rgb: '127,29,29',   border: 'border-red-700/50',    kbd: 'bg-red-950/80 border-red-700/60' },
                        E: { rgb: '120,53,15',   border: 'border-amber-700/45',  kbd: 'bg-amber-950/80 border-amber-700/60' },
                        W: { rgb: '120,53,15',   border: 'border-amber-700/45',  kbd: 'bg-amber-950/80 border-amber-700/60' },
                        I: { rgb: '120,53,15',   border: 'border-amber-700/45',  kbd: 'bg-amber-950/80 border-amber-700/60' },
                        T: { rgb: '30,58,138',   border: 'border-blue-700/45',   kbd: 'bg-blue-950/80 border-blue-700/60' },
                        G: { rgb: '30,58,138',   border: 'border-blue-700/45',   kbd: 'bg-blue-950/80 border-blue-700/60' },
                        S: { rgb: '30,58,138',   border: 'border-blue-700/45',   kbd: 'bg-blue-950/80 border-blue-700/60' },
                        Z: { rgb: '76,29,149',   border: 'border-violet-700/45', kbd: 'bg-violet-950/80 border-violet-700/60' },
                        U: { rgb: '76,29,149',   border: 'border-violet-700/45', kbd: 'bg-violet-950/80 border-violet-700/60' },
                        V: { rgb: '76,29,149',   border: 'border-violet-700/45', kbd: 'bg-violet-950/80 border-violet-700/60' },
                        C: { rgb: '76,29,149',   border: 'border-violet-700/45', kbd: 'bg-violet-950/80 border-violet-700/60' },
                      };
                      const theme: TypeTheme = TYPE_GROUP[chip.key] ?? { rgb: '75,85,99', border: 'border-gray-600/50', kbd: 'bg-gray-900 border-gray-500' };
                      // Heatmap: scale bg opacity from 0.08 (floor) to 0.42 (ceiling) based on count ratio
                      const typeMaxCount = typeDistMap.size > 0 ? Math.max(...Array.from(typeDistMap.values())) : 0;
                      const heatRatio = !isNumeric && typeMaxCount > 0 && !isZero ? chipCount / typeMaxCount : 0;
                      const numHeatRatio = isNumeric && maxDistCount > 0 && !isZero ? chipCount / maxDistCount : 0;
                      const bgOpacity = isZero ? 0.07 : (!isNumeric ? 0.10 + heatRatio * 0.32 : 0.08 + numHeatRatio * 0.22);
                      const heatBg = !isNumeric
                        ? { backgroundColor: `rgba(${theme.rgb}, ${bgOpacity})` }
                        : { backgroundColor: `rgba(59,130,246, ${bgOpacity})` }; // numeric: subtle blue scale
                      return (
                        <button
                          key={chip.key}
                          type="button"
                          aria-label={chordMode === 'type' ? chip.label : `Highlight ${STAT_MAP[chordMode!] ?? chordMode} ${chip.key}`}
                          className={`${chordExiting ? 'chord-chip-exit' : 'chord-chip-enter'} relative ${
                            chordMode === 'type'
                              ? `flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl border transition-all ${
                                  isActive
                                    ? `border-amber-400/80 border-t-[3px]`
                                    : isZero
                                    ? `${theme.border} border-dashed`
                                    : `${theme.border} hover:brightness-125`
                                }`
                              : `flex flex-col items-center justify-center gap-1 px-3 py-4 rounded-xl border transition-all ${
                                  isActive
                                    ? 'border-amber-400/80 border-t-[3px]'
                                    : inRange
                                    ? 'border-amber-600/60 border-t-[3px] border-t-amber-500'
                                    : isZero
                                    ? 'border-gray-600/40 border-dashed'
                                    : 'border-blue-800/40 hover:brightness-125'
                                }`
                          } cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-950`}
                          style={{ animationDelay: chordExiting ? '0ms' : `${i * 22}ms`, ...heatBg }}
                          onClick={() => {
                            if (chordMode === 'type') {
                              const val = TYPE_KEYS[chip.key];
                              if (val) {
                                window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'type', value: val } }));
                                scrollRed();
                              }
                            } else {
                              const n = parseInt(chip.key);
                              window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: STAT_MAP[chordMode!], value: n } }));
                              scrollRed();
                            }
                            exitChord();
                          }}
                        >
                          {chordMode === 'type' ? (
                            <>
                              {isActive && (
                                <span className="absolute top-1.5 right-2 text-xs font-bold text-amber-300" aria-hidden="true">✓</span>
                              )}
                              <kbd className={`px-2.5 py-1 rounded-md font-sans text-base font-bold tracking-wide border min-w-[34px] text-center flex-shrink-0 ${theme.kbd} text-white`}>{chip.key}</kbd>
                              <span className={`text-base font-semibold truncate text-center leading-tight ${isActive ? 'text-amber-200' : isZero ? 'text-gray-300' : 'text-white'}`}>{chip.label}</span>
                              <span className={`text-base leading-none tabular-nums font-medium ${isZero ? 'text-gray-300' : isActive ? 'text-amber-300' : 'text-gray-200'}`}>{chipCount}×</span>
                            </>
                          ) : (
                            <>
                              {isActive && (
                                <span className="absolute top-1.5 right-2 text-xs font-bold text-amber-300" aria-hidden="true">✓</span>
                              )}
                              {inRange && !isActive && (
                                <span className="absolute top-1.5 right-2 text-xs font-bold text-amber-400" aria-hidden="true">~</span>
                              )}
                              <span className={`text-4xl font-mono font-bold leading-none select-none ${isZero ? 'text-gray-400' : isActive ? 'text-amber-300' : inRange ? 'text-amber-100' : 'text-white'}`}>{chip.key}</span>
                              {maxDistCount > 0 && (
                                <span className={`text-base leading-none tabular-nums font-medium ${isZero ? 'text-gray-300' : isActive ? 'text-amber-300' : 'text-gray-200'}`}>{chipCount}×</span>
                              )}
                              {maxDistCount > 0 && (
                                <div className="w-full h-1 rounded-full bg-gray-700 mt-1 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${isActive ? 'bg-amber-400' : inRange ? 'bg-amber-500' : 'bg-blue-500'}`}
                                    style={{ width: `${(chipCount / maxDistCount) * 100}%` }}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Range picker — issue 4: proportional button; issue 7: consistent visual language */}
                  {chordMode !== 'type' && (() => {
                    const lo = Math.min(hudRangeMin, hudRangeMax);
                    const hi = Math.max(hudRangeMin, hudRangeMax);
                    let rangeCardCount = 0;
                    for (let v = lo; v <= hi; v++) rangeCardCount += deckDistMap.get(v) ?? 0;
                    return (
                      <div className="border-t border-gray-700 bg-gray-900/60 px-5 py-4 flex items-center gap-4 flex-wrap">
                        <span className="text-base font-medium text-gray-200 flex-shrink-0">Highlight range:</span>
                        <select
                          value={hudRangeMin}
                          onChange={e => setHudRangeMin(Number(e.target.value))}
                          className="bg-gray-800 text-white text-base rounded-lg border border-gray-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                        >
                          {overlayChips.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <span className="text-base font-medium text-gray-300 flex-shrink-0">to</span>
                        <select
                          value={hudRangeMax}
                          onChange={e => setHudRangeMax(Number(e.target.value))}
                          className="bg-gray-800 text-white text-base rounded-lg border border-gray-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                        >
                          {overlayChips.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <button
                          type="button"
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-base font-semibold rounded-lg transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          onClick={() => {
                            const stat = STAT_MAP[chordMode!];
                            for (let v = lo; v <= hi; v++) {
                              window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat, value: v, additive: true } }));
                            }
                            scrollRed();
                            exitChord();
                          }}
                        >
                          Apply range{rangeCardCount > 0 ? ` (${rangeCardCount} cards)` : ''}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Main HUD bar */}
            <div
              data-deck-hud
              className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl backdrop-blur-sm transition-all duration-200"
              style={{ width: chordMode === 'select' ? 'min(880px, 96vw)' : undefined }}
            >
              {chordMode === 'select' ? (
                <>
                  {/* Mobile-only Build Tools panel — drops filtering, focuses on building.
                      Jump To buttons switch to the Deck tab first so users on Cards/Matchups/Results
                      land on the requested pitch section instead of seeing nothing happen. */}
                  <div className="sm:hidden">
                    <MobileBuildToolsPanel
                      modKey={modKey}
                      ownershipFilter={ownershipFilter}
                      onClose={() => setChordMode(null)}
                      onScrollToTop={() => {
                        if (activeTab !== 'deck') setActiveTab('deck');
                        // Two RAFs: one to flush the tab switch, the second to wait for the new section to mount.
                        requestAnimationFrame(() => requestAnimationFrame(() => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }));
                        setChordMode(null);
                      }}
                      onScrollToSection={(color) => {
                        if (activeTab !== 'deck') setActiveTab('deck');
                        requestAnimationFrame(() => requestAnimationFrame(() => {
                          document.getElementById(`deck-section-${color}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }));
                        setChordMode(null);
                      }}
                      onAddCards={(category) => { openQuickAdd({ category: category as DeckCategory }); setChordMode(null); }}
                      onOwnershipFilter={(filter) => dispatchOwnershipFilter(filter, true)}
                      canAddCards={canEdit}
                    />
                  </div>
                {/* ── Grouped select mode panel — desktop ── */}
                <div className="hidden sm:block px-6 py-5">
                  {/* Panel header */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                      <span className="hidden sm:inline">{modKey}K · </span>Deck Tools
                    </span>
                    <span className="text-xs text-gray-500">press a key or click an action</span>
                    <button type="button" className="text-xs text-gray-500 hover:text-gray-200 transition-colors px-2 py-0.5 rounded hover:bg-gray-700" onClick={() => setChordMode(null)}>
                      <span className="hidden sm:inline">✕ Esc</span>
                      <span className="sm:hidden">✕ Close</span>
                    </button>
                  </div>
                  {/* Four-column group layout (three columns for read-only viewers — no Add Cards) */}
                  <div className={cn("grid grid-cols-2 gap-x-6 gap-y-0 divide-x divide-gray-700/40", canEdit ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
                    {/* Navigate */}
                    <div className="pr-4">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2.5">Navigate to</div>
                      {[
                        { key: '0', label: 'Scroll to top' },
                        { key: '1', label: 'Red (1) section', color: 'text-red-400' },
                        { key: '2', label: 'Yellow (2) section', color: 'text-yellow-400' },
                        { key: '3', label: 'Blue (3) section', color: 'text-blue-400' },
                        { key: '4', label: 'Inventory section' },
                      ].map(({ key, label, color }) => (
                        <button key={key} type="button" className={`${hudBtn} w-full mb-1`} onClick={() => SELECT_ACTIONS[key]?.()}>
                          <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 font-mono text-xs border border-gray-600 min-w-[24px] text-center flex-shrink-0">{key}</kbd>
                          <span className={`text-sm ${color || 'text-gray-300'}`}>{label}</span>
                        </button>
                      ))}
                    </div>
                    {/* Highlight */}
                    <div className="px-4">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2.5">Highlight cards by</div>
                      {[
                        { key: 'A', label: 'Attack power', sub: true },
                        { key: 'C', label: 'Card cost', sub: true },
                        ...(activeTab === 'deck' ? [{ key: 'D', label: 'Defense value', sub: true }] : []),
                        { key: 'T', label: 'Card type', sub: true },
                        { key: 'K', label: 'Keyword', sub: true },
                        { key: 'W', label: 'Arcane damage', sub: true },
                        { key: 'S', label: 'Name search' },
                        { key: 'X', label: 'Card text' },
                        { key: 'F', label: 'Clear all filters' },
                      ].map(({ key, label, sub }) => (
                        <button key={key} type="button" className={`${hudBtn} w-full mb-1`} onClick={() => SELECT_ACTIONS[key]?.()}>
                          <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 font-mono text-xs border border-gray-600 min-w-[24px] text-center flex-shrink-0">{key}</kbd>
                          <span className="text-sm text-gray-300 flex-1">{label}</span>
                          {sub && <span className="text-xs text-gray-500">▸</span>}
                        </button>
                      ))}
                    </div>
                    {/* Add Cards — editors only; the actions no-op on decks the viewer can't change */}
                    {canEdit && (
                      <div className="px-4">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2.5">Add cards to</div>
                        {[
                          { key: '9', label: 'Maindeck' },
                          { key: '8', label: 'Inventory' },
                          { key: '7', label: 'Bench' },
                        ].map(({ key, label }) => (
                          <button key={key} type="button" className={`${hudBtn} w-full mb-1`} onClick={() => SELECT_ACTIONS[key]?.()}>
                            <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 font-mono text-xs border border-gray-600 min-w-[24px] text-center flex-shrink-0">{key}</kbd>
                            <span className="text-sm text-gray-300">+ {label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {/* View */}
                    <div className="pl-4">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2.5">Switch view</div>
                      {[
                        { key: 'M', label: 'Matchups tab' },
                        ...(activeTab !== 'deck' ? [{ key: 'D', label: 'Deck tab' }] : []),
                        { key: 'O', label: 'Owned cards only', color: 'text-green-400' },
                        { key: 'U', label: 'Unowned cards', color: 'text-red-400' },
                      ].map(({ key, label, color }) => (
                        <button key={key} type="button" className={`${hudBtn} w-full mb-1`} onClick={() => SELECT_ACTIONS[key]?.()}>
                          <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 font-mono text-xs border border-gray-600 min-w-[24px] text-center flex-shrink-0">{key}</kbd>
                          <span className={`text-sm ${color || 'text-gray-300'}`}>{label}</span>
                        </button>
                      ))}
                      {/* Tile size stepper */}
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-700/30">
                        <span className="text-xs text-gray-500 flex-1">Tile size</span>
                        <button
                          type="button"
                          disabled={tileSize.idx === 0}
                          onClick={() => window.dispatchEvent(new CustomEvent('deck-tile-size', { detail: { direction: 'smaller' } }))}
                          className="w-7 h-7 flex items-center justify-center rounded bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-colors"
                        >−</button>
                        <span className="text-sm text-gray-200 min-w-[52px] text-center">{tileSize.label}</span>
                        <button
                          type="button"
                          disabled={tileSize.idx === tileSize.total - 1}
                          onClick={() => window.dispatchEvent(new CustomEvent('deck-tile-size', { detail: { direction: 'larger' } }))}
                          className="w-7 h-7 flex items-center justify-center rounded bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-colors"
                        >+</button>
                      </div>
                    </div>
                  </div>
                </div>
                </>
              ) : (
                /* ── Sub-mode bar ── */
                <div className="flex items-center gap-3 text-sm text-gray-200 px-4 py-3 flex-wrap">
                  {/* Breadcrumb back button */}
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors flex-shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    onClick={() => setChordMode('select')}
                  >
                    <span>←</span>
                    <span className="hidden sm:flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono text-xs border border-gray-600">{modKey}K</kbd>
                      <span className="text-gray-600">→</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 font-mono text-xs border border-gray-500">
                        {{ attack: 'A', cost: 'C', defense: 'D', type: 'T', keyword: 'K', clear: 'F', arcane: 'W', nameFilter: 'S', textFilter: 'X' }[chordMode!]}
                      </kbd>
                    </span>
                  </button>
                  <div className="w-px h-5 bg-gray-700 flex-shrink-0" />

                  {isOverlayMode && !keywordBuffer.startsWith('-') && (
                    <span className="text-xs text-gray-400">
                      {{ attack: 'Attack Power', cost: 'Card Cost', defense: 'Defense', type: 'Card Type', arcane: 'Arcane Damage' }[chordMode]}
                    </span>
                  )}
                  {isOverlayMode && keywordBuffer.startsWith('-') && (
                    <span className="flex items-center gap-1.5 text-xs text-amber-400">
                      Range: <kbd className="px-1.5 py-0.5 rounded bg-gray-800 font-mono text-xs border border-amber-600/60 min-w-[48px] text-center">{keywordBuffer || '…'}</kbd>
                      <span className="text-gray-500 text-[10px]">e.g. -4-6</span>
                    </span>
                  )}
                  {chordMode === 'keyword' && (() => {
                    const matches = (KEYWORDS as readonly string[]).filter(k => k.startsWith(keywordBuffer));
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400">Type to filter:</span>
                        <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-100 font-mono text-xs border border-gray-600 min-w-[60px]">
                          {keywordBuffer || '…'}
                        </kbd>
                        <span className="text-[10px] text-gray-500">({matches.length} match{matches.length !== 1 ? 'es' : ''})</span>
                        <div className="flex gap-1.5 flex-wrap max-w-[500px]">
                          {matches.slice(0, 12).map(k => (
                            <button key={k} type="button" className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white cursor-pointer transition-colors" onClick={() => {
                              window.dispatchEvent(new CustomEvent('deck-highlight-filter', { detail: { stat: 'keyword', value: k } }));
                              scrollForKw(k);
                              setChordMode(null);
                              setKeywordBuffer('');
                            }}>
                              {k}
                            </button>
                          ))}
                          {matches.length > 12 && <span className="text-[10px] text-gray-500">+{matches.length - 12}</span>}
                        </div>
                      </div>
                    );
                  })()}
                  {(chordMode === 'nameFilter' || chordMode === 'textFilter') && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{chordMode === 'textFilter' ? 'Filter by card text:' : 'Filter by name:'}</span>
                      <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-100 font-mono text-xs border border-gray-600 min-w-[120px]">
                        {keywordBuffer || '…'}
                      </kbd>
                      <span className="text-[10px] text-gray-500">Enter to apply</span>
                    </div>
                  )}
                  {chordMode === 'clear' && (
                    <button type="button" className={hudBtn} onClick={() => {
                      window.dispatchEvent(new CustomEvent('deck-highlight-clear'));
                      setChordMode(null);
                    }}>
                      <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-xs border border-gray-600 min-w-[20px] text-center">0</kbd>
                      <span className="text-xs text-gray-400">Clear all filters</span>
                    </button>
                  )}
                  <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
                  <button type="button" className="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer transition-colors" onClick={() => setChordMode(null)}>Esc to close</button>
                </div>
              )}
            </div>
          </>
        );
  })();

  return { chordMode, setChordMode, hud, renderToolsTrigger };
}
