"use client";

// Rail deck page Versions view (editors): save the deck's cards as a numbered
// version, list the saved ones, and open one to see its cards and what has
// changed in the deck since. Saving never changes the deck — the deck stays
// the working copy. The card shape and the comparison live in
// lib/deck/deck-versions.

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { DeckDTO } from "@/lib/services/contracts/IDeckService";
import {
  deckToVersionCards, diffVersionCards, MAX_VERSION_LABEL_LENGTH, VERSION_ZONE_LABEL,
  type DeckVersion, type VersionCard, type VersionChange, type VersionZone,
} from "@/lib/deck/deck-versions";
import type { DeckVersionsState } from "@/hooks/deck/useDeckVersions";
import { decksClient } from "@/lib/client";
import { cn } from "@/lib/utils";
import TalisharMark from "./TalisharMark";

const PITCH_DOT: Record<number, string> = { 1: "bg-red-500", 2: "bg-yellow-400", 3: "bg-blue-500" };
const PITCH_NAME: Record<number, string> = { 1: "red", 2: "yellow", 3: "blue" };

// The zones a version's card list shows, in reading order (tokens are stored but not listed).
const LIST_ZONES: VersionZone[] = ["hero", "equipment", "maindeck", "inventory", "benched"];

const savedAt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const BUTTON = "rounded-sm border border-gray-400 bg-gray-100 px-3 py-1 text-sm text-gray-900 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700";

export default function VersionsView({ deckId, deck, list, openNumber, onOpen }: {
  deckId: string;
  deck: DeckDTO;
  /** The saved versions (shared with the header's version picker). */
  list: DeckVersionsState;
  /** The version shown below the table — from `?version=`, so it can be linked. */
  openNumber: number | null;
  onOpen: (versionNumber: number | null) => void;
}) {
  const { versions, error: loadError, reload: loadVersions } = list;
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [details, setDetails] = useState<Record<number, DeckVersion>>({});
  const [detailError, setDetailError] = useState<string | null>(null);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice(null);
    const res = await decksClient.saveDeckVersion(deckId, label.trim() || undefined);
    setSaving(false);
    if (!res.success) {
      setNotice({ kind: "error", text: res.error || "Could not save a version." });
      return;
    }
    const { version, created } = res.data;
    setNotice({
      kind: "ok",
      text: created
        ? `Saved as version ${version.versionNumber}.`
        : `Nothing has changed since version ${version.versionNumber}, so no new version was saved.`,
    });
    if (created) {
      setLabel("");
      await loadVersions();
    }
  };

  // Load the open version's cards once (it stays cached while the view is up).
  const hasOpenDetail = openNumber != null && !!details[openNumber];
  useEffect(() => {
    if (openNumber == null || hasOpenDetail) return;
    let cancelled = false;
    setDetailError(null);
    decksClient.getDeckVersion(deckId, openNumber).then(res => {
      if (cancelled) return;
      if (res.success) {
        const version = res.data.version;
        setDetails(prev => ({ ...prev, [version.versionNumber]: version }));
      } else {
        setDetailError(res.error || "Could not load that version.");
      }
    });
    return () => { cancelled = true; };
  }, [deckId, openNumber, hasOpenDetail]);

  // The list Talishar imports (decks.talishar_version): a version, or the deck itself.
  const talisharVersion = deck.talisharVersion ?? null;

  const liveCards = useMemo(() => deckToVersionCards(deck), [deck]);
  const opened = openNumber != null ? details[openNumber] ?? null : null;
  const changes = useMemo(() => (opened ? diffVersionCards(opened.snapshot.cards, liveCards) : []), [opened, liveCards]);

  return (
    <div className="space-y-4 text-sm text-gray-800 dark:text-gray-200">
      <form onSubmit={save} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="version-note" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Note (optional)</label>
          <input
            id="version-note"
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            maxLength={MAX_VERSION_LABEL_LENGTH}
            placeholder="e.g. Before the Calling"
            className="mt-1 w-72 rounded-sm border border-gray-400 bg-white px-2 py-1 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-sm bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save version"}
        </button>
        {notice && (
          <p
            role={notice.kind === "error" ? "alert" : "status"}
            className={cn("pb-1", notice.kind === "error" ? "text-red-700 dark:text-red-300" : "text-gray-800 dark:text-gray-200")}
          >
            {notice.text}
          </p>
        )}
      </form>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        A version is a copy of this deck&apos;s cards as they are right now. Saving one never changes the deck, and a saved version never changes afterwards.
      </p>

      {loadError && <p role="alert" className="text-red-700 dark:text-red-300">{loadError}</p>}
      {!loadError && versions === null && <p className="text-gray-600 dark:text-gray-400">Loading versions…</p>}
      {versions && versions.length === 0 && (
        <p className="border border-gray-300 bg-gray-100 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">No versions saved yet.</p>
      )}

      {versions && versions.length > 0 && (
        <table aria-label="Deck versions" className="w-full border-collapse">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr className="border-b border-gray-300 text-left text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300">
              <th scope="col" className="w-24 px-2 py-1.5">Version</th>
              <th scope="col" className="px-2 py-1.5">Note</th>
              <th scope="col" className="w-48 px-2 py-1.5">Saved</th>
              <th scope="col" className="w-20 px-2 py-1.5 text-right">Deck</th>
              <th scope="col" className="w-20 px-2 py-1.5 text-right">Arena</th>
              <th scope="col" className="w-24 px-2 py-1.5 text-right">Sideboard</th>
              <th scope="col" className="w-24 px-2 py-1.5"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {versions.map(v => {
              const isOpen = openNumber === v.versionNumber;
              return (
                <tr
                  key={v.versionNumber}
                  className={cn("border-b border-gray-200 dark:border-gray-800", isOpen ? "bg-blue-50 dark:bg-blue-950" : "hover:bg-gray-50 dark:hover:bg-gray-800/60")}
                >
                  <th scope="row" className="px-2 py-1 text-left font-medium tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      Version {v.versionNumber}
                      {deck.availableOnTalishar !== false && talisharVersion === v.versionNumber && <TalisharMark />}
                    </span>
                  </th>
                  <td className="px-2 py-1">{v.label ?? <span className="text-gray-600 dark:text-gray-400">—</span>}</td>
                  <td className="px-2 py-1 tabular-nums">{savedAt(v.createdAt)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{v.counts.maindeck}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{v.counts.equipment}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{v.counts.inventory}</td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Close" : "View"} version ${v.versionNumber}`}
                      onClick={() => onOpen(isOpen ? null : v.versionNumber)}
                      className={BUTTON}
                    >
                      {isOpen ? "Close" : "View"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {openNumber != null && (
        <section aria-label={`Version ${openNumber}`} className="space-y-4 border-t border-gray-300 pt-4 dark:border-gray-700">
          {detailError && <p role="alert" className="text-red-700 dark:text-red-300">{detailError}</p>}
          {!detailError && !opened && <p className="text-gray-600 dark:text-gray-400">Loading version {openNumber}…</p>}
          {opened && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Version {opened.versionNumber}{opened.label ? ` — ${opened.label}` : ""}
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Saved {savedAt(opened.createdAt)}
                  {opened.snapshot.heroName ? ` · ${opened.snapshot.heroName}` : ""}
                  {opened.snapshot.format ? ` · ${opened.snapshot.format}` : ""}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Changed in the deck since this version</h3>
                {changes.length === 0 ? (
                  <p className="mt-1" data-testid="version-no-changes">Nothing — the deck has the same cards as this version.</p>
                ) : (
                  <div className="mt-2 grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="version-changes">
                    {changes.map(zone => (
                      <div key={zone.zone}>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{zone.label}</p>
                        <ul className="mt-1 space-y-0.5">
                          {zone.added.map(c => <ChangeLine key={`a-${c.name}-${c.pitch}`} change={c} added />)}
                          {zone.removed.map(c => <ChangeLine key={`r-${c.name}-${c.pitch}`} change={c} added={false} />)}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cards in this version</h3>
                <div className="mt-2 grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                  {LIST_ZONES.map(zone => {
                    const cards = mergeByCard(opened.snapshot.cards.filter(c => c.category === zone));
                    if (cards.length === 0) return null;
                    return (
                      <div key={zone}>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {VERSION_ZONE_LABEL[zone]} <span className="font-normal tabular-nums">({cards.reduce((n, c) => n + c.quantity, 0)})</span>
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {cards.map(c => (
                            <li key={`${c.name}-${c.pitch}`} className="flex items-center gap-1.5">
                              <span className="w-6 shrink-0 text-right tabular-nums">{c.quantity}x</span>
                              <PitchDot pitch={c.pitch} />
                              <span>{c.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

/** One line per card name + pitch (a version stores one row per printing). */
function mergeByCard(cards: VersionCard[]): VersionChange[] {
  const rows = new Map<string, VersionChange>();
  for (const c of cards) {
    const key = `${c.name}|${c.pitch ?? ""}`;
    const row = rows.get(key) ?? { name: c.name, pitch: c.pitch, quantity: 0 };
    row.quantity += c.quantity;
    rows.set(key, row);
  }
  return [...rows.values()];
}

function PitchDot({ pitch }: { pitch: number | null }) {
  return pitch && PITCH_DOT[pitch]
    ? <span className={cn("h-2 w-2 shrink-0 rounded-full", PITCH_DOT[pitch])} role="img" aria-label={PITCH_NAME[pitch]} />
    : <span className="h-2 w-2 shrink-0" aria-hidden />;
}

function ChangeLine({ change, added }: { change: VersionChange; added: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={cn("w-8 shrink-0 text-right font-medium tabular-nums", added ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-300")}>
        <span className="sr-only">{added ? "Added" : "Removed"} </span>
        <span aria-hidden>{added ? "+" : "−"}</span>{change.quantity}
      </span>
      <PitchDot pitch={change.pitch} />
      <span>{change.name}</span>
    </li>
  );
}
