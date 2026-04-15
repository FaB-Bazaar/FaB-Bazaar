// components/deck/CreateDeckDialog.tsx
"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Globe, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { HERO_INFO, getHeroesGroupedByClass, getYoungHeroesGroupedByClass, YOUNG_HERO_INFO } from '@/lib/fab-constants';

interface CreateDeckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateDeck: (deckData: {
    name: string;
    description: string;
    format: string;
    hero?: string;
    heroPrintingId?: string;
    isPublic: boolean;
  }) => Promise<void>;
}

// Merge adult + young hero classes into a single grouped list
function mergeHeroClasses(
  adult: Record<string, string[]>,
  young: Record<string, string[]>
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const allClasses = new Set([...Object.keys(adult), ...Object.keys(young)]);
  for (const cls of allClasses) {
    const combined = [...(adult[cls] ?? []), ...(young[cls] ?? [])];
    if (combined.length) result[cls] = combined;
  }
  return result;
}

const ALL_HERO_CLASSES = mergeHeroClasses(
  getHeroesGroupedByClass(),
  getYoungHeroesGroupedByClass()
);

function toDisplayName(name: string): string {
  return name.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));
}

function deriveFormat(heroName: string): string {
  if (heroName === 'none') return 'Classic Constructed';
  const key = heroName.toLowerCase();
  if (!HERO_INFO[key as keyof typeof HERO_INFO] && YOUNG_HERO_INFO[key as keyof typeof YOUNG_HERO_INFO]) {
    return 'Silver Age';
  }
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

  const derivedFormat = deriveFormat(hero);

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
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
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
            <span className="text-xs text-gray-400 shrink-0">
              Step {step} of 2
            </span>
          </div>
        </DialogHeader>

        {/* Step 1: Hero Selection — inline command search */}
        {step === 1 && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <Command className="flex-1 overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700 rounded-lg">
              <CommandInput placeholder="Search by name, class, or talent..." autoFocus />
              <CommandList className="flex-1 overflow-y-auto">
                <CommandEmpty>No heroes found.</CommandEmpty>
                {Object.entries(ALL_HERO_CLASSES).sort(([a], [b]) => a.localeCompare(b)).map(([className, heroNames]) => (
                  <CommandGroup key={className} heading={className.charAt(0).toUpperCase() + className.slice(1)}>
                    {[...heroNames].sort((a, b) => a.localeCompare(b)).map((heroName) => {
                      const info = HERO_INFO[heroName.toLowerCase() as keyof typeof HERO_INFO]
                        ?? YOUNG_HERO_INFO[heroName.toLowerCase() as keyof typeof YOUNG_HERO_INFO];
                      return (
                        <CommandItem key={heroName} value={heroName} onSelect={() => handleHeroSelect(heroName)}>
                          <Check className={`mr-2 h-4 w-4 shrink-0 ${hero === heroName ? "opacity-100" : "opacity-0"}`} />
                          <span className="flex-1 truncate">{toDisplayName(heroName)}</span>
                          {info?.talents.map((t: string) => (
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
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {/* Summary */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Hero:</span>
                <span className="font-medium">{hero === 'none' ? 'None' : toDisplayName(hero)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Format:</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                  {derivedFormat}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deck-name">Deck Name <span className="text-red-500">*</span></Label>
              <Input
                id="deck-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setNameTouched(true)}
                placeholder="Enter deck name"
                maxLength={100}
                autoFocus
                required
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) handleSubmit(); }}
              />
              {nameTouched && !name.trim() && (
                <p className="text-xs text-red-500">
                  Deck name is required
                </p>
              )}
              <p className="text-xs text-gray-400">
                Suggestion: {getDefaultDeckName()} · Press Enter to create
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deck-description">Description (optional)</Label>
              <Textarea
                id="deck-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your deck strategy..."
                rows={3}
                maxLength={500}
              />
            </div>

            <label className={`flex items-start gap-3 cursor-pointer select-none rounded-lg border p-3 transition-colors ${isPublic ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-blue-500" />
                  Make public
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400">Required to feature in articles or share via link</span>
              </span>
            </label>

            <Button
              className="w-full h-11"
              onClick={handleSubmit}
              disabled={loading || !name.trim()}
            >
              {loading ? "Creating..." : "Create Deck"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
