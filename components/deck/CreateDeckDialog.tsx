// components/deck/CreateDeckDialog.tsx
"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { HERO_INFO, getHeroesGroupedByClass, getYoungHeroesGroupedByClass, YOUNG_HERO_INFO, type HeroInfo } from '@/lib/fab-constants';
import DeckCardSearchDialog from "@/components/deck/DeckCardSearchDialog";
import { SearchableHeroSelect } from "@/components/deck/SearchableHeroSelect";

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

const FORMATS = [
  'Classic Constructed',
  'Silver Age',
  'Blitz',
  'Limited',
  'Commoner',
  'Living Legend'
];

const FORMAT_ABBREVIATIONS: Record<string, string> = {
  'Classic Constructed': 'CC',
  'Silver Age': 'SAGE',
  'Blitz': 'Blitz',
  'Limited': 'Limited',
  'Commoner': 'Commoner',
  'Living Legend': 'LL',
};

// Get heroes grouped by class from the single source of truth
const HERO_CLASSES = getHeroesGroupedByClass();
const YOUNG_HERO_CLASSES = getYoungHeroesGroupedByClass();

export default function CreateDeckDialog({
  open,
  onOpenChange,
  onCreateDeck
}: CreateDeckDialogProps) {
  const [step, setStep] = useState(1); // 1=format, 2=hero, 3=visibility, 4=name
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState("");
  const [hero, setHero] = useState("none");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedHeroPrinting, setSelectedHeroPrinting] = useState<any | null>(null);
  const [heroPrintingDialogOpen, setHeroPrintingDialogOpen] = useState(false);

  // Get the appropriate hero list based on format
  const heroClasses = format === 'Silver Age'
    ? YOUNG_HERO_CLASSES
    : HERO_CLASSES;

  // Generate default deck name
  const getDefaultDeckName = () => {
    const abbrev = FORMAT_ABBREVIATIONS[format] || format;
    if (hero !== 'none') {
      return `${abbrev} - ${hero}`;
    }
    return `${abbrev} Deck`;
  };

  const STEP_TITLES = ['', 'Select Format', 'Select Hero', 'Visibility', 'Name Your Deck'];

  const handleFormatSelect = (selectedFormat: string) => {
    setFormat(selectedFormat);
    setHero('none');
    setSelectedHeroPrinting(null);
    setStep(2);
  };

  const handleHeroSelect = (selectedHero: string) => {
    setHero(selectedHero);
    setSelectedHeroPrinting(null);

    if (selectedHero === 'none') {
      setStep(3);
    } else {
      // Open printing picker for the selected hero
      setHeroPrintingDialogOpen(true);
    }
  };

  const handleVisibilitySelect = (publicChoice: boolean) => {
    setIsPublic(publicChoice);
    setStep(4);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    const deckName = name.trim();

    // Require deck name
    if (!deckName) {
      return;
    }

    try {
      setLoading(true);
      await onCreateDeck({
        name: deckName,
        description: description.trim(),
        format,
        hero: hero === "none" ? undefined : hero.trim() || undefined,
        heroPrintingId: selectedHeroPrinting?.printing_id || selectedHeroPrinting?.unique_id,
        isPublic
      });

      // Reset form
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
    setFormat("");
    setHero("none");
    setIsPublic(false);
    setSelectedHeroPrinting(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
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
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="flex-1">
              {STEP_TITLES[step]}
            </DialogTitle>
            <span className="text-xs text-gray-400 shrink-0">
              Step {step} of 4
            </span>
          </div>
        </DialogHeader>

        {/* Step 1: Format Selection */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f}
                className={cn(
                  "p-3 rounded-lg border-2 text-left transition-colors",
                  "hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20",
                  "active:bg-blue-100 dark:active:bg-blue-900/30",
                  "border-gray-200 dark:border-gray-700"
                )}
                onClick={() => handleFormatSelect(f)}
              >
                <div className="font-medium text-sm">{f}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {FORMAT_ABBREVIATIONS[f]}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Hero Selection */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Search for your hero by name, class, or talent
              </div>
              <SearchableHeroSelect
                heroes={heroClasses}
                format={format}
                onSelect={handleHeroSelect}
                value={hero !== 'none' ? hero : undefined}
              />
            </div>
          </div>
        )}

        {/* Step 3: Visibility */}
        {step === 3 && (
          <div className="space-y-3">
            {/* Summary of selections so far */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Format:</span>
                <span className="font-medium">{format}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Hero:</span>
                <span className="font-medium">{hero === 'none' ? 'None' : hero}</span>
              </div>
              {selectedHeroPrinting && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Printing:</span>
                  <span>{selectedHeroPrinting.set} / {selectedHeroPrinting.edition === 'f' ? '1st Ed' : selectedHeroPrinting.edition === 'u' ? 'Unlimited' : selectedHeroPrinting.edition}</span>
                </div>
              )}
            </div>

            <button
              className={cn(
                "w-full p-4 rounded-lg border-2 text-left transition-colors",
                "hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20",
                "active:bg-blue-100 dark:active:bg-blue-900/30",
                "border-gray-200 dark:border-gray-700"
              )}
              onClick={() => handleVisibilitySelect(false)}
            >
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-gray-500 shrink-0" />
                <div>
                  <div className="font-medium text-sm">Private</div>
                  <div className="text-xs text-gray-500">Only you can see this deck</div>
                </div>
              </div>
            </button>

            <button
              className={cn(
                "w-full p-4 rounded-lg border-2 text-left transition-colors",
                "hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20",
                "active:bg-blue-100 dark:active:bg-blue-900/30",
                "border-gray-200 dark:border-gray-700"
              )}
              onClick={() => handleVisibilitySelect(true)}
            >
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-blue-500 shrink-0" />
                <div>
                  <div className="font-medium text-sm">Public</div>
                  <div className="text-xs text-gray-500">Anyone can view (required for articles)</div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Step 4: Name & Create */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Format:</span>
                <span className="font-medium">{format}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Hero:</span>
                <span className="font-medium">{hero === 'none' ? 'None' : hero}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Visibility:</span>
                <div className="flex items-center gap-1">
                  {isPublic ? <Globe className="h-3 w-3 text-blue-500" /> : <Lock className="h-3 w-3 text-gray-500" />}
                  <span className="font-medium">{isPublic ? 'Public' : 'Private'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deck-name">Deck Name <span className="text-red-500">*</span></Label>
              <Input
                id="deck-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter deck name"
                maxLength={100}
                autoFocus
                required
              />
              {!name.trim() && (
                <p className="text-[10px] text-red-500">
                  Deck name is required
                </p>
              )}
              <p className="text-[10px] text-gray-400">
                Suggestion: {getDefaultDeckName()}
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

      {/* Hero Printing Search Dialog */}
      <DeckCardSearchDialog
        open={heroPrintingDialogOpen}
        onOpenChange={(dialogOpen) => {
          setHeroPrintingDialogOpen(dialogOpen);
          // If user cancelled without picking a printing, reset hero
          if (!dialogOpen && !selectedHeroPrinting) {
            setHero('none');
          }
        }}
        onSelectCard={(card, printing, quantity) => {
          setSelectedHeroPrinting(printing);
          setHeroPrintingDialogOpen(false);
          setStep(3); // Advance to visibility step
        }}
        targetCategory="hero"
        deckFormat={format}
        heroNameFilter={hero !== "none" ? hero : undefined}
        heroCardUniqueId={(() => {
          if (hero === "none") return undefined;
          const key = hero.toLowerCase();
          const info = HERO_INFO[key as keyof typeof HERO_INFO];
          if (info?.cardUniqueId) return info.cardUniqueId;
          const youngInfo = YOUNG_HERO_INFO[key as keyof typeof YOUNG_HERO_INFO];
          return youngInfo?.cardUniqueId;
        })()}
        currentDeck={undefined}
      />
    </Dialog>
  );
}
