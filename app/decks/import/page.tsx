// app/decks/import/page.tsx
//
// FaBrary-style URL deck import: an external site links to
//   /decks/import?name=My+Deck&format=Classic+Constructed&hero=arakni-marionette
//     &cards=slug,slug-red,slug-red,...
// (card slugs repeated once per copy, pitch color suffixed). The page resolves
// every slug via /api/cards/by-talishar-id, shows a preview, and on confirm
// funnels through the existing FaBrary import pipeline (synthesized paste text
// → POST /api/decks/import/fabrary) so hero legality, categorization, and
// unresolved reporting stay in one place.

"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import IntegrationGuide from "@/components/shared/IntegrationGuide";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { decksClient, searchClient } from "@/lib/client";
import { trackDeckCreate } from "@/lib/gtag";
import {
  parseImportUrlParams,
  synthesizeFabraryText,
  type ImportUrlCard,
} from "@/lib/deck/import-url-params";

type ResolvedCard = import("@/lib/client/search-client").TalisharCardLookup;

interface PreviewRow extends ImportUrlCard {
  resolved: ResolvedCard | null;
}

const PITCH_DOT: Record<number, { className: string; label: string }> = {
  1: { className: "bg-red-500", label: "red" },
  2: { className: "bg-yellow-400", label: "yellow" },
  3: { className: "bg-blue-500", label: "blue" },
};

// Mirror of the import pipeline's categorizer (non-Evo equipment/weapon →
// equipment, everything else → main deck) — preview grouping only.
function isEquipment(types: string[] | null | undefined): boolean {
  const t = (types || []).map(x => x.toLowerCase());
  return (t.includes("equipment") || t.includes("weapon")) && !t.includes("evo");
}

function ImportDeckContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const request = useMemo(
    () => parseImportUrlParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [deckName, setDeckName] = useState(request.name);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [inventoryRows, setInventoryRows] = useState<PreviewRow[] | null>(null);
  const [hero, setHero] = useState<ResolvedCard | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => setDeckName(request.name), [request.name]);

  // Resolve the hero + every card and inventory id in one batch call.
  useEffect(() => {
    if (!request.heroSlug && request.cards.length === 0 && request.inventory.length === 0) return;
    let cancelled = false;

    (async () => {
      const heroId = request.heroSlug.replace(/-/g, "_");
      const ids = [
        ...(request.heroSlug ? [heroId] : []),
        ...request.cards.map(c => c.talisharId),
        ...request.inventory.map(c => c.talisharId),
      ];
      const result = await searchClient.lookupByTalisharIds(ids, { details: true });
      if (cancelled) return;
      if (!result.success) {
        setResolveError(result.error || "Card lookup failed");
        return;
      }

      const byId = result.data;
      setHero(request.heroSlug ? byId[heroId] ?? null : null);
      setRows(request.cards.map(c => ({ ...c, resolved: byId[c.talisharId] ?? null })));
      setInventoryRows(request.inventory.map(c => ({ ...c, resolved: byId[c.talisharId] ?? null })));
    })();

    return () => { cancelled = true; };
  }, [request]);

  const isHeroCard = (r: { resolved: ResolvedCard }) =>
    (r.resolved.types || []).some(t => t.toLowerCase() === "hero");

  // A hero-typed row in the card list is the hero's own entry (FaBrary-style
  // links repeat it); the hero is added at deck creation, so drop it here.
  const resolvedRows = (rows ?? [])
    .filter((r): r is PreviewRow & { resolved: ResolvedCard } => !!r.resolved)
    .filter(r => !isHeroCard(r));
  const missing = [...(rows ?? []), ...(inventoryRows ?? [])].filter(r => !r.resolved);
  const equipmentRows = resolvedRows.filter(r => isEquipment(r.resolved.types));
  const deckRows = resolvedRows.filter(r => !isEquipment(r.resolved.types));
  const resolvedInventory = (inventoryRows ?? [])
    .filter((r): r is PreviewRow & { resolved: ResolvedCard } => !!r.resolved)
    .filter(r => !isHeroCard(r));
  const totalCards = [...resolvedRows, ...resolvedInventory].reduce((s, r) => s + r.quantity, 0);

  const blockers: string[] = [];
  if (!request.format) blockers.push("The link is missing a valid format (e.g. format=Classic Constructed).");
  if (!request.heroSlug) blockers.push("The link is missing a hero (e.g. hero=arakni-marionette).");
  else if (rows !== null && !hero) blockers.push(`Hero "${request.heroSlug}" was not found.`);
  if (request.cards.length === 0) blockers.push("The link contains no cards (cards=slug,slug,...).");

  const canImport = blockers.length === 0 && resolvedRows.length > 0 && !importing;

  const handleImport = async () => {
    if (!hero || !request.format) return;
    setImporting(true);
    try {
      const text = synthesizeFabraryText({
        name: deckName.trim() || `Imported ${hero.displayName} deck`,
        format: request.format,
        heroName: hero.displayName,
        cards: resolvedRows.map(r => ({
          displayName: r.resolved.displayName,
          pitch: r.resolved.pitch,
          quantity: r.quantity,
        })),
      });

      const result = await decksClient.importFromFabrary(text);
      if (!result.success) throw new Error(result.error || "Failed to import deck");

      const { publicId, deckName: createdName, format, hero: createdHero, unresolved } = result.data;

      // Sideboard cards can't ride through the text pipeline (category is
      // re-derived from card types there) — add them directly as 'inventory'.
      let inventoryFailed = 0;
      const inventoryToAdd = resolvedInventory
        .filter(r => r.resolved.printingId)
        .map(r => ({ printingId: r.resolved.printingId as string, quantity: r.quantity, category: "inventory" as const }));
      if (inventoryToAdd.length > 0) {
        const invResult = await decksClient.addPrintings(publicId, inventoryToAdd);
        if (!invResult.success) inventoryFailed = inventoryToAdd.length;
      }

      window.dispatchEvent(new CustomEvent("deckCreated"));
      trackDeckCreate({
        deck_id: publicId,
        deck_name: createdName,
        format,
        hero: createdHero?.name,
        is_public: false,
      });

      const allUnresolved = [...missing.map(m => m.slug), ...unresolved];
      const problems = [
        allUnresolved.length > 0 ? `${allUnresolved.length} card(s) couldn't be matched: ${allUnresolved.join(", ")}` : null,
        inventoryFailed > 0 ? `${inventoryFailed} inventory card(s) could not be added.` : null,
      ].filter(Boolean);
      toast({
        title: "Deck created",
        description: problems.length > 0
          ? `${createdName} created. ${problems.join(" ")}`
          : `${createdName} has been created.`,
        variant: problems.length > 0 ? "destructive" : undefined,
      });
      router.push(`/decks/${publicId}`);
    } catch (e) {
      toast({
        title: "Import failed",
        description: e instanceof Error ? e.message : "Failed to import deck",
        variant: "destructive",
      });
      setImporting(false);
    }
  };

  const signInHref = `/auth/login?callbackUrl=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.pathname + window.location.search : "/decks/import",
  )}`;

  const loading = rows === null && !resolveError
    && (request.heroSlug !== "" || request.cards.length > 0 || request.inventory.length > 0);

  const renderRows = (list: typeof resolvedRows) => (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
      {list.map(r => {
        const dot = r.resolved.pitch != null ? PITCH_DOT[r.resolved.pitch] : null;
        return (
          <li key={r.slug} className="flex items-center gap-2 py-1.5 px-3">
            <span className="w-8 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right">
              {r.quantity}x
            </span>
            {dot ? (
              <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot.className}`} aria-hidden="true" />
            ) : (
              <span className="inline-block w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
            )}
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {r.resolved.displayName}
              {dot && <span className="sr-only"> ({dot.label})</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );

  // A bare /decks/import visit is a landing page for integrators, not a broken
  // import — show the guide instead of parameter warnings.
  const isEmptyLink = !request.heroSlug && !request.name && request.format === null
    && request.cards.length === 0 && request.inventory.length === 0;

  if (isEmptyLink) {
    return (
      <div className="min-h-screen bg-gray-200 dark:bg-gray-900 py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center gap-2">
            <Download className="h-6 w-6 text-gray-700 dark:text-gray-300" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import Deck</h1>
          </div>
          <p className="text-base text-gray-700 dark:text-gray-300">
            This page creates a deck from a shared link. Ask the site that sent you here for a
            complete import URL — or, if you&apos;re building one, the full spec is below.
          </p>
          <IntegrationGuide defaultOpen />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Download className="h-6 w-6 text-gray-700 dark:text-gray-300" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import Deck</h1>
        </div>

        {blockers.length > 0 && (
          <div className="rounded-md border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-1">
            {blockers.map(b => (
              <p key={b} className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />{b}
              </p>
            ))}
          </div>
        )}

        {resolveError && (
          <div className="rounded-md border border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/40 p-4">
            <p className="text-sm text-red-800 dark:text-red-300">{resolveError}</p>
          </div>
        )}

        <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {hero?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero.imageUrl} alt={hero.displayName} className="w-24 rounded-md flex-shrink-0" />
            )}
            <div className="flex-1 space-y-2">
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Deck name</span>
                <Input
                  value={deckName}
                  onChange={e => setDeckName(e.target.value)}
                  placeholder={hero ? `Imported ${hero.displayName} deck` : "Deck name"}
                  className="mt-1"
                />
              </label>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-semibold">Hero:</span> {hero?.displayName ?? request.heroSlug ?? "—"}
                <span className="mx-2 text-gray-400" aria-hidden="true">·</span>
                <span className="font-semibold">Format:</span> {request.format ?? "—"}
                <span className="mx-2 text-gray-400" aria-hidden="true">·</span>
                <span className="font-semibold">Cards:</span> {totalCards}
              </p>
            </div>
          </div>

          {loading && (
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Resolving cards…
            </p>
          )}

          {missing.length > 0 && (
            <div className="rounded-md border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {missing.length} card(s) couldn&apos;t be matched and will be skipped:
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300">{missing.map(m => m.slug).join(", ")}</p>
            </div>
          )}

          {equipmentRows.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Equipment &amp; Weapons ({equipmentRows.reduce((s, r) => s + r.quantity, 0)})
              </h2>
              <div className="rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden">
                {renderRows(equipmentRows)}
              </div>
            </div>
          )}

          {deckRows.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Deck ({deckRows.reduce((s, r) => s + r.quantity, 0)})
              </h2>
              <div className="rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden">
                {renderRows(deckRows)}
              </div>
            </div>
          )}

          {resolvedInventory.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Inventory ({resolvedInventory.reduce((s, r) => s + r.quantity, 0)})
              </h2>
              <div className="rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden">
                {renderRows(resolvedInventory)}
              </div>
            </div>
          )}

          <div className="pt-2">
            {authLoading ? null : user ? (
              <Button onClick={handleImport} disabled={!canImport} className="w-full sm:w-auto">
                {importing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />Importing…</>
                ) : (
                  "Import deck"
                )}
              </Button>
            ) : (
              <Button onClick={() => router.push(signInHref)} className="w-full sm:w-auto">
                Sign in to import
              </Button>
            )}
          </div>
        </div>

        <IntegrationGuide defaultOpen={false} />
      </div>
    </div>
  );
}

export default function ImportDeckPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-200 dark:bg-gray-900" />}>
      <ImportDeckContent />
    </Suspense>
  );
}
