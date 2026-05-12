// components/deck/CreateDeckDialog.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Globe, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import type { HeroLegalityRow } from "@/lib/services/contracts/IPrintingsService";

interface CreateDeckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateDeck: (deckData: {
    name: string;
    description: string;
    format: string;
    hero?: string;
    heroCardUniqueId?: string;
    heroPrintingId?: string;
    isPublic: boolean;
  }) => Promise<void>;
}

// FaB talent strings to extract from cards.types for the picker badges.
const TALENT_TYPES = new Set([
  'shadow', 'light', 'royal', 'draconic', 'mystic', 'elemental',
  'ice', 'lightning', 'earth', 'chaos', 'revered', 'reviled', 'pirate',
]);

function toDisplayName(name: string): string {
  return name.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));
}

// Priority: cc > silver_age > blitz > commoner > ll. CC is the default for
// adult heroes, Silver Age for young, LL only for graduated heroes.
function deriveFormatFromHero(hero: HeroLegalityRow | undefined): string {
  if (!hero) return 'Classic Constructed';
  if (hero.ccLegal) return 'Classic Constructed';
  if (hero.silverAgeLegal) return 'Silver Age';
  if (hero.blitzLegal) return 'Blitz';
  if (hero.commonerLegal) return 'Commoner';
  if (hero.llLegal) return 'Living Legend';
  return 'Classic Constructed';
}

export default function CreateDeckDialog({
  open,
  onOpenChange,
  onCreateDeck
}: CreateDeckDialogProps) {
  const [step, setStep] = useState(1); // 1=hero, 2=name
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hero, setHero] = useState("none");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [heroes, setHeroes] = useState<HeroLegalityRow[]>([]);
  const [ageFilter, setAgeFilter] = useState<'all' | 'young' | 'adult'>('all');
  const [previewHero, setPreviewHero] = useState<HeroLegalityRow | null>(null);

  // Close zoom overlay on Esc
  useEffect(() => {
    if (!previewHero) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPreviewHero(null);
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [previewHero]);

  // Fetch hero roster + legality from DB once when the dialog opens.
  useEffect(() => {
    if (!open || heroes.length > 0) return;
    let cancelled = false;
    fetch('/api/heroes')
      .then(r => (r.ok ? r.json() : null))
      .then(payload => {
        if (cancelled || !payload?.success) return;
        setHeroes(payload.data as HeroLegalityRow[]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, heroes.length]);

  const heroesByName = useMemo(() => {
    const map = new Map<string, HeroLegalityRow>();
    for (const h of heroes) map.set(h.displayName.toLowerCase(), h);
    return map;
  }, [heroes]);

  const heroesByClass = useMemo(() => {
    const grouped: Record<string, HeroLegalityRow[]> = {};
    for (const h of heroes) {
      const isYoung = h.types.includes('young');
      if (ageFilter === 'young' && !isYoung) continue;
      if (ageFilter === 'adult' && isYoung) continue;
      const cls = h.klass ?? 'other';
      (grouped[cls] ||= []).push(h);
    }
    return grouped;
  }, [heroes, ageFilter]);

  const selectedHero = hero === 'none' ? undefined : heroesByName.get(hero.toLowerCase());
  const derivedFormat = deriveFormatFromHero(selectedHero);

  const getDefaultDeckName = () => {
    const abbrev = derivedFormat === 'Silver Age' ? 'Sage'
      : derivedFormat === 'Classic Constructed' ? 'CC'
      : derivedFormat;
    return hero !== 'none' ? `${abbrev} - ${toDisplayName(hero)}` : `${abbrev} Deck`;
  };

  const handleHeroSelect = (selectedHero: string) => {
    setHero(selectedHero);
    setStep(2);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    const deckName = name.trim();
    if (!deckName) return;

    try {
      setLoading(true);
      await onCreateDeck({
        name: deckName,
        description: description.trim(),
        format: derivedFormat,
        hero: hero === "none" ? undefined : hero.trim() || undefined,
        heroCardUniqueId: selectedHero?.cardUniqueId,
        isPublic,
      });
      resetForm();
    } catch (error) {
      console.error('Failed to create deck:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setName("");
    setDescription("");
    setHero("none");
    setIsPublic(false);
    setNameTouched(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md max-h-[85vh] flex flex-col px-7 sm:px-8"
        onPointerDownOutside={(e) => { if (previewHero) e.preventDefault(); }}
        onInteractOutside={(e) => { if (previewHero) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (previewHero) e.preventDefault(); }}
      >
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2 pr-8">
            {step > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                onClick={handleBack}
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="flex-1">
              {step === 1 ? 'Select Hero' : 'Name Your Deck'}
            </DialogTitle>
            {step === 1 && (
              <div className="flex items-center rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-xs shrink-0">
                {(['all', 'adult', 'young'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAgeFilter(opt)}
                    aria-pressed={ageFilter === opt}
                    className={
                      'px-2.5 py-1 font-medium capitalize transition-colors ' +
                      (ageFilter === opt
                        ? (opt === 'young'
                            ? 'bg-amber-500 text-white'
                            : 'bg-blue-600 text-white')
                        : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800')
                    }
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Step 1: Hero Selection — inline command search */}
        {step === 1 && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <Command className="flex-1 overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700 rounded-lg">
              <CommandInput placeholder="Search by name, class, or talent..." autoFocus />
              <CommandList className="flex-1 overflow-y-auto">
                <CommandEmpty>{heroes.length === 0 ? 'Loading heroes…' : 'No heroes found.'}</CommandEmpty>
                {Object.entries(heroesByClass).sort(([a], [b]) => a.localeCompare(b)).map(([className, classHeroes]) => (
                  <CommandGroup key={className} heading={className.charAt(0).toUpperCase() + className.slice(1)}>
                    {[...classHeroes].sort((a, b) => a.displayName.localeCompare(b.displayName)).map((h) => {
                      const heroKey = h.displayName.toLowerCase();
                      const talents = h.types.filter(t => TALENT_TYPES.has(t));
                      const isYoung = h.types.includes('young');
                      return (
                        <CommandItem key={h.cardUniqueId} value={heroKey} onSelect={() => handleHeroSelect(heroKey)}>
                          <Check className={`mr-1 h-4 w-4 shrink-0 ${hero === heroKey ? "opacity-100" : "opacity-0"}`} />
                          {h.imageUrl ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setPreviewHero(h);
                              }}
                              onPointerDown={(e) => {
                                // CommandItem (cmdk) selects on pointer-down — stop it here
                                // so the image click only zooms, never picks the hero.
                                e.stopPropagation();
                              }}
                              aria-label={`Enlarge ${h.displayName} art`}
                              className="shrink-0 mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-sm"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={h.imageUrl}
                                alt=""
                                loading="lazy"
                                className="w-6 h-8 object-cover rounded-sm bg-gray-100 dark:bg-gray-900 cursor-zoom-in hover:opacity-80 transition-opacity"
                              />
                            </button>
                          ) : (
                            <div className="w-6 h-8 rounded-sm bg-gray-100 dark:bg-gray-900 shrink-0 mr-2" aria-hidden />
                          )}
                          <span className="flex-1 truncate">{h.displayName}</span>
                          {ageFilter === 'all' && (
                            isYoung ? (
                              <Badge className="text-xs py-0 px-1.5 ml-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/60">
                                Young
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs py-0 px-1.5 ml-1 text-gray-500 dark:text-gray-400">
                                Adult
                              </Badge>
                            )
                          )}
                          {talents.map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs py-0 px-1.5 ml-1">{t}</Badge>
                          ))}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </div>
        )}

        {/* Step 2: Name & Create */}
        {step === 2 && (
          <div className="space-y-5 overflow-y-auto flex-1 px-1 -mx-1">
            {/* Compact hero summary — thumb + name + format pill on one line */}
            <div className="flex items-center gap-3 py-2">
              {selectedHero?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedHero.imageUrl}
                  alt=""
                  className="w-9 h-12 rounded object-cover bg-gray-100 dark:bg-gray-900 shrink-0"
                />
              ) : (
                <div className="w-9 h-12 rounded bg-gray-100 dark:bg-gray-900 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">
                  {hero === 'none' ? 'No hero' : (selectedHero?.displayName ?? toDisplayName(hero))}
                </div>
                <div className="mt-0.5">
                  <span className="inline-block text-[11px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                    {derivedFormat}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deck-name" className="text-sm">
                Deck Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="deck-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setNameTouched(true)}
                placeholder={getDefaultDeckName()}
                maxLength={100}
                autoFocus
                required
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) handleSubmit(); }}
              />
              {nameTouched && !name.trim() ? (
                <p className="text-xs text-red-500">Deck name is required</p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">Press Enter to create</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deck-description" className="text-sm">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="deck-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your deck strategy…"
                rows={3}
                maxLength={500}
              />
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none text-sm">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              />
              <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="font-medium text-gray-700 dark:text-gray-300">Make public</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">— shareable via link</span>
            </label>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={loading || !name.trim()}
            >
              {loading ? 'Creating…' : 'Create Deck'}
            </Button>
          </div>
        )}
      </DialogContent>

      {previewHero?.imageUrl && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${previewHero.displayName} art`}
          // Close on pointer-down (the same event cmdk uses for selection)
          // and stop propagation so nothing else reacts to the click.
          onPointerDown={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setPreviewHero(null);
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          // Radix sets pointer-events:none on body siblings while DialogContent
          // is open, so portaled overlays need to opt back in explicitly.
          style={{ pointerEvents: 'auto' }}
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewHero.imageUrl}
            alt={previewHero.displayName}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </Dialog>
  );
}
