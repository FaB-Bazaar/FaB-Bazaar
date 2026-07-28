// components/BuylistBlockEditor.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import CardSearchDialog from '@/components/dialogs/cards/card-search-dialog';
import { parseQuantity } from '@/lib/buylist/rollup';

interface BuylistCard {
  printingId: string;
  qty: string | number;
}

interface BuylistGroup {
  label: string;
  cards: BuylistCard[];
}

interface BuylistTier {
  label: string;
  groups: BuylistGroup[];
}

interface BuylistSection {
  title?: string;
  note?: string;
  tiers?: BuylistTier[];
}

interface BuylistBlockEditorProps {
  section: BuylistSection;
  onChange?: (updates: Partial<BuylistSection>) => void;
  onUpdate?: (updates: Partial<BuylistSection>) => void;
}

interface CardDetails {
  printing_id: string;
  display_name?: string;
  name?: string;
  collector_number: string;
  image_url?: string;
  tcg_low?: number;
}

/** Mirrors the server-side guard so authors see the error before publishing. */
function quantityError(qty: string | number): string | null {
  try {
    parseQuantity(qty);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid quantity';
  }
}

export function BuylistBlockEditor({ section, onChange, onUpdate }: BuylistBlockEditorProps) {
  const handleChange = onChange || onUpdate || (() => {});
  const tiers: BuylistTier[] = section.tiers || [];

  const [searchTarget, setSearchTarget] = useState<{ tier: number; group: number } | null>(null);
  const [cardDetails, setCardDetails] = useState<Record<string, CardDetails>>({});

  const setTiers = (next: BuylistTier[]) => handleChange({ tiers: next });

  const mutateTier = (tierIndex: number, fn: (tier: BuylistTier) => BuylistTier) =>
    setTiers(tiers.map((tier, i) => (i === tierIndex ? fn(tier) : tier)));

  const mutateGroup = (
    tierIndex: number,
    groupIndex: number,
    fn: (group: BuylistGroup) => BuylistGroup
  ) =>
    mutateTier(tierIndex, tier => ({
      ...tier,
      groups: tier.groups.map((group, i) => (i === groupIndex ? fn(group) : group)),
    }));

  const fetchCardDetails = useCallback(async (printingId: string) => {
    try {
      const response = await fetch(`/api/printings/search?printingIds=${printingId}&show=all`);
      const data = await response.json();
      if (data.success && data.data?.printings?.[0]) {
        setCardDetails(prev => ({ ...prev, [printingId]: data.data.printings[0] }));
      }
    } catch (error) {
      console.error('Failed to fetch card details:', error);
    }
  }, []);

  useEffect(() => {
    const ids = tiers
      .flatMap(tier => tier.groups || [])
      .flatMap(group => group.cards || [])
      .map(card => card.printingId)
      .filter(id => id && !cardDetails[id]);

    [...new Set(ids)].forEach(fetchCardDetails);
  }, [tiers, cardDetails, fetchCardDetails]);

  const handleAddCard = (selection: any) => {
    const { printing } = selection;
    const printingId = printing?.printing_id || printing?.unique_id;

    if (printingId && searchTarget) {
      mutateGroup(searchTarget.tier, searchTarget.group, group => ({
        ...group,
        cards: group.cards.some(c => c.printingId === printingId)
          ? group.cards
          : [...group.cards, { printingId, qty: 3 }],
      }));
    }
    setSearchTarget(null);
  };

  const cardLabel = (printingId: string) => {
    const details = cardDetails[printingId];
    if (!details) return printingId;
    return details.display_name || details.name || printingId;
  };

  return (
    <div className="space-y-4 rounded-md border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="buylistTitle" className="font-semibold">
            Title <span className="text-sm text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="buylistTitle"
            value={section.title || ''}
            onChange={e => handleChange({ title: e.target.value })}
            placeholder="Buy List"
            className="mt-1 bg-background"
          />
        </div>
        <div>
          <Label htmlFor="buylistNote" className="font-semibold">
            Footnote <span className="text-sm text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="buylistNote"
            value={section.note || ''}
            onChange={e => handleChange({ note: e.target.value })}
            placeholder="Prices update nightly."
            className="mt-1 bg-background"
          />
        </div>
      </div>

      {tiers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No tiers yet. Start with a tier like &ldquo;The Core&rdquo;, then add packages inside it.
        </p>
      )}

      {tiers.map((tier, tierIndex) => (
        <div key={tierIndex} className="space-y-3 rounded-md border border-border p-3">
          <div className="flex items-center gap-2">
            <Input
              value={tier.label}
              onChange={e => mutateTier(tierIndex, t => ({ ...t, label: e.target.value }))}
              placeholder="Tier name (e.g. The Core)"
              className="bg-background font-semibold"
            />
            <Button
              size="sm"
              variant="ghost"
              aria-label="Move tier up"
              disabled={tierIndex === 0}
              onClick={() => {
                const next = [...tiers];
                [next[tierIndex - 1], next[tierIndex]] = [next[tierIndex], next[tierIndex - 1]];
                setTiers(next);
              }}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Move tier down"
              disabled={tierIndex === tiers.length - 1}
              onClick={() => {
                const next = [...tiers];
                [next[tierIndex], next[tierIndex + 1]] = [next[tierIndex + 1], next[tierIndex]];
                setTiers(next);
              }}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Remove tier"
              onClick={() => setTiers(tiers.filter((_, i) => i !== tierIndex))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {(tier.groups || []).map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-2 rounded-md border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={group.label}
                  onChange={e =>
                    mutateGroup(tierIndex, groupIndex, g => ({ ...g, label: e.target.value }))
                  }
                  placeholder="Package name (e.g. Steel Soul Set)"
                  className="bg-card"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Remove package"
                  onClick={() =>
                    mutateTier(tierIndex, t => ({
                      ...t,
                      groups: t.groups.filter((_, i) => i !== groupIndex),
                    }))
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {(group.cards || []).map((card, cardIndex) => {
                const error = quantityError(card.qty);
                return (
                  <div key={cardIndex} className="flex items-center gap-2 pl-2">
                    <Input
                      value={String(card.qty)}
                      onChange={e =>
                        mutateGroup(tierIndex, groupIndex, g => ({
                          ...g,
                          cards: g.cards.map((c, i) =>
                            i === cardIndex ? { ...c, qty: e.target.value } : c
                          ),
                        }))
                      }
                      aria-label={`Quantity for ${cardLabel(card.printingId)}`}
                      aria-invalid={error ? true : undefined}
                      placeholder="3 or 2-3"
                      className={`w-24 bg-card ${error ? 'border-destructive' : ''}`}
                    />
                    <span className="flex-1 truncate text-sm">{cardLabel(card.printingId)}</span>
                    {error && (
                      <span className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${cardLabel(card.printingId)}`}
                      onClick={() =>
                        mutateGroup(tierIndex, groupIndex, g => ({
                          ...g,
                          cards: g.cards.filter((_, i) => i !== cardIndex),
                        }))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}

              <Button
                size="sm"
                variant="outline"
                onClick={() => setSearchTarget({ tier: tierIndex, group: groupIndex })}
              >
                <Plus className="mr-1 h-4 w-4" /> Add card
              </Button>
            </div>
          ))}

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              mutateTier(tierIndex, t => ({
                ...t,
                groups: [...(t.groups || []), { label: '', cards: [] }],
              }))
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add package
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => setTiers([...tiers, { label: '', groups: [] }])}
      >
        <Plus className="mr-2 h-4 w-4" /> Add tier
      </Button>

      <CardSearchDialog
        open={searchTarget !== null}
        onOpenChange={open => !open && setSearchTarget(null)}
        onSelectCard={handleAddCard}
      />
    </div>
  );
}

export default BuylistBlockEditor;
