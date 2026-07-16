// app/playmats/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Check, Heart, ImageOff, Lightbulb, Pencil, Search } from "lucide-react";
import { collectiblesClient } from "@/lib/client";
import type {
  CollectibleDTO,
  CollectibleMarkStatus,
} from "@/lib/services/contracts/ICollectibleService";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

// Tiles rendered per page — keeps image requests bounded until the user
// actually scrolls/pages through the catalog.
const PAGE_SIZE = 24;

export default function PlaymatsPage() {
  const { status: sessionStatus } = useSession();
  const signedIn = sessionStatus === "authenticated";

  const [items, setItems] = useState<CollectibleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  // ids with an in-flight mark request, so double-clicks don't race
  const [pending, setPending] = useState<Set<string>>(new Set());
  // Suggestion panel target: null = closed, target.collectible null = new-playmat
  // proposal, set = edit suggestion for that catalog entry.
  const [suggestTarget, setSuggestTarget] = useState<
    { collectible: CollectibleDTO | null } | null
  >(null);

  const openSuggest = useCallback((collectible: CollectibleDTO | null) => {
    setSuggestTarget({ collectible });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await collectiblesClient.listCollectibles({ kind: "playmat" });
    if (result.success) {
      setItems(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // refetch when auth resolves so viewerStatus reflects the session
    if (sessionStatus === "loading") return;
    void load();
  }, [load, sessionStatus]);

  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const item of items) if (item.year != null) ys.add(item.year);
    return Array.from(ys).sort((a, b) => b - a);
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (yearFilter !== "all" && String(item.year ?? "") !== yearFilter) return false;
      if (!q) return true;
      return [item.name, item.artist, item.source]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q));
    });
  }, [items, search, yearFilter]);

  const toggleMark = useCallback(
    async (item: CollectibleDTO, status: CollectibleMarkStatus) => {
      if (!signedIn || pending.has(item.id)) return;
      const clearing = item.viewerStatus === status;
      const nextStatus = clearing ? null : status;

      setPending((prev) => new Set(prev).add(item.id));
      // optimistic: flip viewerStatus + adjust counts locally
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? applyMark(it, nextStatus) : it)),
      );

      const result = clearing
        ? await collectiblesClient.clearMark(item.id)
        : await collectiblesClient.setMark(item.id, status);

      if (!result.success) {
        // revert to server truth
        void load();
      }
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    },
    [signedIn, pending, load],
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Playmats</h1>
        <p className="mt-1 text-base text-gray-600 dark:text-gray-300">
          Every official Flesh and Blood playmat in one place — where it came
          from, who made it, and which ones you have or want.
        </p>
        {!signedIn && sessionStatus !== "loading" && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            <Link
              href="/login"
              className={`font-medium text-blue-600 underline dark:text-blue-400 ${FOCUS_RING}`}
            >
              Sign in
            </Link>{" "}
            to mark playmats as have or want, or to suggest one we&apos;re missing.
          </p>
        )}
        {signedIn && !suggestTarget && (
          <button
            type="button"
            onClick={() => openSuggest(null)}
            className={`mt-3 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 ${FOCUS_RING}`}
          >
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            Suggest a playmat
          </button>
        )}
      </header>

      {suggestTarget && (
        <SuggestionPanel
          // remount when the target changes so stale form state doesn't leak
          key={suggestTarget.collectible?.id ?? "new"}
          collectible={suggestTarget.collectible}
          onClose={() => setSuggestTarget(null)}
        />
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Search by name, artist, or event…"
            aria-label="Search playmats"
            className={`w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-base dark:border-gray-700 dark:bg-gray-900 ${FOCUS_RING}`}
          />
        </div>
        <select
          value={yearFilter}
          onChange={(e) => {
            setYearFilter(e.target.value);
            setLimit(PAGE_SIZE);
          }}
          aria-label="Filter by year"
          className={`rounded-md border border-gray-300 bg-white px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900 ${FOCUS_RING}`}
        >
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-12 text-center text-base text-gray-600 dark:text-gray-300">
          Loading playmats…
        </p>
      ) : loadError ? (
        <p role="alert" className="py-12 text-center text-base text-red-600 dark:text-red-400">
          Couldn&apos;t load the catalog: {loadError}
        </p>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-base text-gray-600 dark:text-gray-300">
          {items.length === 0
            ? "No playmats in the catalog yet — check back soon."
            : "No playmats match your search."}
        </p>
      ) : (
        <>
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="playmat-grid">
          {visible.slice(0, limit).map((item) => (
            <li
              key={item.id}
              className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="relative aspect-[12/7] w-full bg-gray-100 dark:bg-gray-800">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={`${item.name} playmat`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-600 dark:text-gray-400">
                    <ImageOff className="h-6 w-6" aria-hidden="true" />
                    <span className="text-sm">No image yet</span>
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1 p-4">
                <h2 className="text-base font-semibold">{item.name}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {[item.source, item.year].filter(Boolean).join(" · ") || "Origin unknown"}
                </p>
                {item.artist && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">Art: {item.artist}</p>
                )}

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {item.haveCount} {item.haveCount === 1 ? "collector has" : "collectors have"} it
                  · {item.wantCount} want it
                </p>

                {signedIn && (
                  <button
                    type="button"
                    onClick={() => openSuggest(item)}
                    className={`mt-1 inline-flex items-center gap-1 self-start text-sm text-gray-600 underline decoration-dotted hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 ${FOCUS_RING}`}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Suggest an edit
                  </button>
                )}

                <div className="mt-3 flex gap-2">
                  <MarkButton
                    label="Have"
                    active={item.viewerStatus === "have"}
                    disabled={!signedIn || pending.has(item.id)}
                    onClick={() => toggleMark(item, "have")}
                    activeClasses="border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-600"
                  />
                  <MarkButton
                    label="Want"
                    icon={<Heart className="h-4 w-4" aria-hidden="true" />}
                    active={item.viewerStatus === "want"}
                    disabled={!signedIn || pending.has(item.id)}
                    onClick={() => toggleMark(item, "want")}
                    activeClasses="border-rose-600 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-600"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
        {visible.length > limit && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE_SIZE)}
              className={`rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 ${FOCUS_RING}`}
            >
              Show more ({visible.length - limit} remaining)
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}

const INPUT_CLASSES = `w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900 ${FOCUS_RING}`;

/**
 * Crowdsourcing form: suggest a new playmat (collectible null) or a correction
 * to an existing one. Submissions go to a pending queue that admins review —
 * nothing changes on the page immediately, so on success we just confirm.
 */
function SuggestionPanel({
  collectible,
  onClose,
}: {
  collectible: CollectibleDTO | null;
  onClose: () => void;
}) {
  const isEdit = collectible !== null;
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [artist, setArtist] = useState("");
  const [source, setSource] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEdit && !name.trim()) {
      setError("Give the playmat a name.");
      return;
    }
    const trimmedYear = year.trim();
    const parsedYear = trimmedYear ? Number(trimmedYear) : undefined;
    if (trimmedYear && (!Number.isInteger(parsedYear) || String(parsedYear) !== trimmedYear)) {
      setError("Year must be a whole number, e.g. 2024.");
      return;
    }
    if (
      isEdit &&
      ![name, artist, source, description, notes].some((f) => f.trim()) &&
      !trimmedYear
    ) {
      setError("Fill in at least one correction or a note.");
      return;
    }

    setSubmitting(true);
    const result = await collectiblesClient.submitSuggestion({
      collectibleId: collectible?.id,
      name: name.trim() || undefined,
      year: parsedYear,
      artist: artist.trim() || undefined,
      source: source.trim() || undefined,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error);
    }
  };

  if (submitted) {
    return (
      <div
        role="status"
        className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-base text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      >
        <p className="font-medium">Thanks — your suggestion is in!</p>
        <p className="mt-1 text-sm">
          It&apos;s waiting for review and will show up in the catalog once approved.
        </p>
        <button
          type="button"
          onClick={onClose}
          className={`mt-3 rounded-md border border-emerald-400 px-3 py-1.5 text-sm font-medium hover:bg-emerald-100 dark:border-emerald-700 dark:hover:bg-emerald-900 ${FOCUS_RING}`}
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      data-testid="suggestion-panel"
      className="mb-6 space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div>
        <h2 className="text-lg font-semibold">
          {isEdit ? `Suggest an edit: ${collectible.name}` : "Suggest a playmat"}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {isEdit
            ? "Only fill in what should change — leave the rest blank."
            : "Know a playmat we're missing? Tell us what you know and we'll add it after review."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="suggest-name" className="mb-1 block text-sm font-medium">
            Name{isEdit ? "" : " (required)"}
          </label>
          <input
            id="suggest-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isEdit ? collectible.name : "e.g. Calling Melbourne 2026 Top 8"}
            className={INPUT_CLASSES}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="suggest-year" className="mb-1 block text-sm font-medium">
              Year
            </label>
            <input
              id="suggest-year"
              type="text"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder={isEdit && collectible.year != null ? String(collectible.year) : "2026"}
              className={INPUT_CLASSES}
            />
          </div>
          <div>
            <label htmlFor="suggest-artist" className="mb-1 block text-sm font-medium">
              Artist
            </label>
            <input
              id="suggest-artist"
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder={isEdit ? (collectible.artist ?? "") : ""}
              className={INPUT_CLASSES}
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="suggest-source" className="mb-1 block text-sm font-medium">
            Where it&apos;s from
          </label>
          <input
            id="suggest-source"
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={
              isEdit && collectible.source
                ? collectible.source
                : "e.g. Calling Sydney 2026 Top 8 prize, Armory Deck Kit…"
            }
            className={INPUT_CLASSES}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="suggest-description" className="mb-1 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="suggest-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provenance, print run, how it was distributed…"
            className={INPUT_CLASSES}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="suggest-notes" className="mb-1 block text-sm font-medium">
            Notes for the reviewer
          </label>
          <textarea
            id="suggest-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else — links to photos or sources are very welcome."
            className={INPUT_CLASSES}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className={`rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-base font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          {submitting ? "Submitting…" : "Submit suggestion"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className={`rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 ${FOCUS_RING}`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function MarkButton({
  label,
  icon,
  active,
  disabled,
  onClick,
  activeClasses,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  activeClasses: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={disabled && !active ? "Sign in to track playmats" : undefined}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-base font-medium transition-colors disabled:cursor-not-allowed ${FOCUS_RING} ${
        active
          ? activeClasses
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:disabled:text-gray-500"
      }`}
    >
      {/* active state is never color-only: ✓ prefix marks it (WCAG 1.4.1) */}
      {active ? <Check className="h-4 w-4" aria-hidden="true" /> : icon}
      {label}
    </button>
  );
}

function applyMark(
  item: CollectibleDTO,
  nextStatus: CollectibleMarkStatus | null,
): CollectibleDTO {
  const prevStatus = item.viewerStatus;
  if (prevStatus === nextStatus) return item;
  let { haveCount, wantCount } = item;
  if (prevStatus === "have") haveCount -= 1;
  if (prevStatus === "want") wantCount -= 1;
  if (nextStatus === "have") haveCount += 1;
  if (nextStatus === "want") wantCount += 1;
  return { ...item, viewerStatus: nextStatus, haveCount, wantCount };
}
