'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { collectiblesClient } from '@/lib/client';
import type {
  CollectibleDTO,
  CollectibleSubmissionDTO,
} from '@/lib/services/contracts/ICollectibleService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

const PAGE_SIZE = 50;

interface EditorFields {
  name: string;
  year: string;
  artist: string;
  source: string;
  description: string;
  imageUrl: string;
}

interface EditorState extends EditorFields {
  id: string | null; // null = creating
  /** Snapshot at open/last-save time, for the unsaved-changes guard. */
  original: EditorFields;
  /** Bumped on every fresh "create" form so keyed children (ImageUpload) remount. */
  createSeq: number;
}

const EMPTY_FIELDS: EditorFields = {
  name: '',
  year: '',
  artist: '',
  source: '',
  description: '',
  imageUrl: '',
};

type QuickFilter = 'all' | 'no-image' | 'no-source' | 'no-year' | 'no-description';
type SortMode = 'catalog' | 'name' | 'updated';

const QUICK_FILTERS: Array<{ key: QuickFilter; label: string; test: (item: CollectibleDTO) => boolean }> = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'no-image', label: 'Missing image', test: (item) => !item.imageUrl },
  { key: 'no-source', label: 'Missing source', test: (item) => !item.source },
  { key: 'no-year', label: 'Missing year', test: (item) => item.year == null },
  { key: 'no-description', label: 'Missing description', test: (item) => !item.description },
];

/** Mirrors the service's catalog order (year asc, name asc) so client-side inserts land in place. */
function compareCatalog(a: CollectibleDTO, b: CollectibleDTO): number {
  const ay = a.year ?? Number.POSITIVE_INFINITY;
  const by = b.year ?? Number.POSITIVE_INFINITY;
  if (ay !== by) return ay - by;
  return a.name.localeCompare(b.name);
}

function fieldsFromItem(item: CollectibleDTO): EditorFields {
  return {
    name: item.name,
    year: item.year != null ? String(item.year) : '',
    artist: item.artist ?? '',
    source: item.source ?? '',
    description: item.description ?? '',
    imageUrl: item.imageUrl ?? '',
  };
}

function isDirty(editor: EditorState): boolean {
  return (Object.keys(EMPTY_FIELDS) as Array<keyof EditorFields>).some(
    (key) => editor[key] !== editor.original[key],
  );
}

/** Distinct non-empty values ordered by how often they occur — the common ones first. */
function rankedValues(values: Array<string | null | undefined>): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const v = value?.trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([v]) => v);
}

/**
 * One pending community submission. For edit suggestions, each proposed field
 * is shown as "current → proposed" so the diff is reviewable at a glance;
 * new-entry proposals just list the submitted fields.
 */
function SubmissionCard({
  submission,
  current,
  busy,
  onApprove,
  onReject,
}: {
  submission: CollectibleSubmissionDTO;
  current: CollectibleDTO | null;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isEdit = submission.collectibleId !== null;
  const fields: Array<{ label: string; proposed: string | number | null; existing: string | number | null }> = [
    { label: 'Name', proposed: submission.name, existing: current?.name ?? null },
    { label: 'Year', proposed: submission.year, existing: current?.year ?? null },
    { label: 'Artist', proposed: submission.artist, existing: current?.artist ?? null },
    { label: 'Source', proposed: submission.source, existing: current?.source ?? null },
    { label: 'Description', proposed: submission.description, existing: current?.description ?? null },
  ];
  const proposed = fields.filter((f) => f.proposed != null);

  return (
    <li
      data-testid="submission-card"
      className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-xs font-medium rounded-full px-2 py-0.5 ${
            isEdit
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
          }`}
        >
          {isEdit ? 'Edit suggestion' : 'New playmat'}
        </span>
        {isEdit && (
          <span className="font-medium">{submission.collectibleName ?? 'Unknown entry'}</span>
        )}
        <span className="text-sm text-gray-600 dark:text-gray-300">
          by {submission.username ?? 'deleted user'} ·{' '}
          {new Date(submission.createdAt).toLocaleDateString()}
        </span>
      </div>

      {proposed.length > 0 ? (
        <dl className="text-sm space-y-1">
          {proposed.map((field) => (
            <div key={field.label} className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-gray-700 dark:text-gray-200">{field.label}:</dt>
              <dd className="text-gray-900 dark:text-gray-100">
                {isEdit && field.existing != null && field.existing !== field.proposed ? (
                  <>
                    <s className="text-gray-500 dark:text-gray-400">{field.existing}</s>{' '}
                    {field.proposed}
                  </>
                ) : (
                  field.proposed
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-300">No field changes proposed.</p>
      )}

      {submission.notes && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium text-gray-700 dark:text-gray-200">Notes:</span>{' '}
          {submission.notes}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onApprove} disabled={busy}>
          Approve{isEdit ? ' & apply' : ' & add'}
        </Button>
        <Button size="sm" variant="outline" onClick={onReject} disabled={busy}>
          Reject
        </Button>
      </div>
    </li>
  );
}

/**
 * Catalog admin as a master-detail: the list stays put on the left while the
 * editor lives in a sticky side panel (full-screen on small viewports). Saves
 * patch the row in place — no reload, no scroll jump — and Prev/Next walk the
 * currently filtered list so a "fill in every missing image" pass is a
 * save → next loop instead of scroll → edit → scroll.
 */
export function CollectiblesAdminClient() {
  const { toast } = useToast();
  const [items, setItems] = useState<CollectibleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [sort, setSort] = useState<SortMode>('catalog');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [submissions, setSubmissions] = useState<CollectibleSubmissionDTO[]>([]);
  // submission ids with an in-flight review call, so double-clicks don't race
  const [reviewing, setReviewing] = useState<Set<string>>(new Set());
  const nameRef = useRef<HTMLInputElement>(null);
  const createSeqRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    const [catalog, queue] = await Promise.all([
      collectiblesClient.listCollectibles(),
      collectiblesClient.adminListSubmissions('pending'),
    ]);
    if (catalog.success) setItems(catalog.data);
    else toast({ title: 'Load failed', description: catalog.error, variant: 'destructive' });
    if (queue.success) setSubmissions(queue.data);
    else toast({ title: 'Submissions load failed', description: queue.error, variant: 'destructive' });
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Focus the name field whenever a different entry (or a fresh create form) opens.
  const focusKey = editor ? `${editor.id ?? 'new'}:${editor.createSeq}` : null;
  useEffect(() => {
    if (focusKey) nameRef.current?.focus({ preventScroll: true });
  }, [focusKey]);

  const review = async (submission: CollectibleSubmissionDTO, action: 'approve' | 'reject') => {
    if (reviewing.has(submission.id)) return;
    setReviewing((prev) => new Set(prev).add(submission.id));
    const result = await collectiblesClient.adminReviewSubmission(submission.id, action);
    if (result.success) {
      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
      toast({ title: action === 'approve' ? 'Approved — applied to catalog' : 'Rejected' });
      if (action === 'approve') void load();
    } else {
      toast({ title: 'Review failed', description: result.error, variant: 'destructive' });
    }
    setReviewing((prev) => {
      const next = new Set(prev);
      next.delete(submission.id);
      return next;
    });
  };

  const filterCounts = useMemo(
    () => QUICK_FILTERS.map((f) => ({ ...f, count: items.filter(f.test).length })),
    [items],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const quick = QUICK_FILTERS.find((f) => f.key === quickFilter) ?? QUICK_FILTERS[0];
    const filtered = items.filter((item) => {
      if (!quick.test(item)) return false;
      if (!q) return true;
      return [item.name, item.artist, item.source, String(item.year ?? '')]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q));
    });
    const sorted = [...filtered];
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'updated')
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    else sorted.sort(compareCatalog);
    return sorted;
  }, [items, search, quickFilter, sort]);

  const suggestions = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const years = new Set<number>([thisYear, thisYear + 1]);
    for (const item of items) if (item.year != null) years.add(item.year);
    return {
      sources: rankedValues(items.map((i) => i.source)),
      artists: rankedValues(items.map((i) => i.artist)),
      years: [...years].sort((a, b) => b - a),
    };
  }, [items]);

  const editIndex = editor?.id ? visible.findIndex((item) => item.id === editor.id) : -1;
  const prevItem = editIndex > 0 ? visible[editIndex - 1] : null;
  const nextItem = editIndex >= 0 && editIndex < visible.length - 1 ? visible[editIndex + 1] : null;

  /** Unsaved-changes guard for anything that would drop the current edits. */
  const confirmDiscard = () =>
    !editor || !isDirty(editor) || window.confirm('Discard unsaved changes to this entry?');

  const openEdit = (item: CollectibleDTO) => {
    if (editor?.id === item.id) return;
    if (!confirmDiscard()) return;
    const fields = fieldsFromItem(item);
    setEditor({ id: item.id, ...fields, original: fields, createSeq: createSeqRef.current });
  };

  const openCreate = (prefill: Partial<EditorFields> = {}) => {
    const fields = { ...EMPTY_FIELDS, ...prefill };
    createSeqRef.current += 1;
    setEditor({ id: null, ...fields, original: fields, createSeq: createSeqRef.current });
  };

  const closeEditor = () => {
    if (!confirmDiscard()) return;
    setEditor(null);
  };

  const patch = (partial: Partial<EditorFields>) =>
    setEditor((prev) => (prev ? { ...prev, ...partial } : prev));

  /** Persist the editor; returns the saved row (null on validation/API failure). */
  const persist = async (): Promise<CollectibleDTO | null> => {
    if (!editor) return null;
    if (!editor.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return null;
    }
    const year = editor.year.trim() ? Number(editor.year.trim()) : null;
    if (editor.year.trim() && Number.isNaN(year)) {
      toast({ title: 'Year must be a number', variant: 'destructive' });
      return null;
    }

    setSaving(true);
    try {
      if (editor.id) {
        const result = await collectiblesClient.adminUpdate(editor.id, {
          name: editor.name.trim(),
          year,
          artist: editor.artist.trim() || null,
          source: editor.source.trim() || null,
          description: editor.description.trim() || null,
          imageUrl: editor.imageUrl.trim() || null,
        });
        if (!result.success) {
          toast({ title: 'Save failed', description: result.error, variant: 'destructive' });
          return null;
        }
        const saved = result.data;
        setItems((prev) => prev.map((it) => (it.id === saved.id ? saved : it)));
        toast({ title: 'Saved' });
        return saved;
      }
      const result = await collectiblesClient.adminCreate({
        name: editor.name.trim(),
        year: year ?? undefined,
        artist: editor.artist.trim() || undefined,
        source: editor.source.trim() || undefined,
        description: editor.description.trim() || undefined,
        imageUrl: editor.imageUrl.trim() || undefined,
      });
      if (!result.success) {
        toast({ title: 'Create failed', description: result.error, variant: 'destructive' });
        return null;
      }
      setItems((prev) => [...prev, result.data]);
      toast({ title: 'Created' });
      return result.data;
    } finally {
      setSaving(false);
    }
  };

  /** Save and keep editing the same entry (create switches to editing the new row). */
  const save = async () => {
    const saved = await persist();
    if (!saved) return;
    const fields = fieldsFromItem(saved);
    setEditor((prev) => (prev ? { ...prev, id: saved.id, ...fields, original: fields } : prev));
  };

  /** Save, then open the next entry in the filtered list (the target is fixed before the
   *  save so a row that stops matching the active filter doesn't shift it). */
  const saveAndNext = async () => {
    const target = nextItem;
    const saved = await persist();
    if (!saved) return;
    if (target) {
      const fields = fieldsFromItem(target);
      setEditor({ id: target.id, ...fields, original: fields, createSeq: createSeqRef.current });
    } else {
      const fields = fieldsFromItem(saved);
      setEditor((prev) => (prev ? { ...prev, id: saved.id, ...fields, original: fields } : prev));
    }
  };

  /** Create, then start a fresh entry that keeps the batch-shaped fields (year, source, artist). */
  const createAndAddAnother = async () => {
    const saved = await persist();
    if (!saved || !editor) return;
    openCreate({ year: editor.year, source: editor.source, artist: editor.artist });
  };

  const remove = async (item: CollectibleDTO) => {
    const confirmed = window.confirm(
      `Delete "${item.name}"? Collectors' have/want marks on it are removed too.`,
    );
    if (!confirmed) return;
    const result = await collectiblesClient.adminDelete(item.id);
    if (result.success) {
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      if (editor?.id === item.id) setEditor(null);
      toast({ title: 'Deleted' });
    } else {
      toast({ title: 'Delete failed', description: result.error, variant: 'destructive' });
    }
  };

  const onEditorKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeEditor();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (saving) return;
      if (e.shiftKey && editor?.id) void saveAndNext();
      else void save();
    }
  };

  const dirty = editor ? isDirty(editor) : false;
  const editorKey = editor ? `${editor.id ?? 'new'}:${editor.createSeq}` : 'closed';

  return (
    <div className="space-y-6">
      {/* Crowdsourced submission review queue */}
      {submissions.length > 0 && (
        <section
          data-testid="submission-queue"
          className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 md:p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold">
            Community submissions ({submissions.length} pending)
          </h2>
          <ul className="space-y-3">
            {submissions.map((submission) => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                current={
                  submission.collectibleId
                    ? items.find((item) => item.id === submission.collectibleId) ?? null
                    : null
                }
                busy={reviewing.has(submission.id)}
                onApprove={() => review(submission, 'approve')}
                onReject={() => review(submission, 'reject')}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Toolbar: search, quick filters, sort, add */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[16rem]">
            <Label htmlFor="col-search">Search collectibles</Label>
            <Input
              id="col-search"
              type="search"
              placeholder="Name, artist, source, or year…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="col-sort">Sort</Label>
            <select
              id="col-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="mt-1 block h-10 rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <option value="catalog">Catalog order (year, name)</option>
              <option value="name">Name A→Z</option>
              <option value="updated">Recently updated</option>
            </select>
          </div>
          <Button onClick={() => confirmDiscard() && openCreate()}>
            <Plus className="h-4 w-4 mr-1" />
            Add collectible
          </Button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick filters">
          {filterCounts.map((f) => {
            const active = f.key === quickFilter;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setQuickFilter(f.key);
                  setLimit(PAGE_SIZE);
                }}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500'
                    : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-500'
                }`}
              >
                {active && <span aria-hidden="true">✓ </span>}
                {f.label} ({f.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Master-detail: list + sticky editor panel */}
      <div className={editor ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-6' : ''}>
        <div className="min-w-0 space-y-3">
          {loading ? (
            <p className="py-8 text-center text-gray-600 dark:text-gray-300">Loading…</p>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {visible.length} of {items.length} entries
                {' · '}
                {items.filter((item) => item.imageUrl).length} with images
              </p>
              <ul className="divide-y divide-gray-200 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                {visible.slice(0, limit).map((item) => {
                  const current = editor?.id === item.id;
                  return (
                    <li
                      key={item.id}
                      data-testid="collectible-row"
                      aria-current={current ? 'true' : undefined}
                      className={`flex items-center gap-3 p-3 ${
                        current
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-l-[3px] border-l-blue-600 dark:border-l-blue-400'
                          : ''
                      }`}
                    >
                      <div className="h-12 w-20 shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <ImageOff className="h-4 w-4 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="truncate text-sm text-gray-600 dark:text-gray-300">
                          {[item.source, item.year].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      {item.description && (
                        <span className="hidden md:inline text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 px-2 py-0.5">
                          desc
                        </span>
                      )}
                      <Button
                        variant={current ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => openEdit(item)}
                        aria-label={`Edit ${item.name}`}
                      >
                        <Pencil className="h-4 w-4 lg:mr-1" />
                        <span className="hidden lg:inline">Edit</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(item)}
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4 lg:mr-1" />
                        <span className="hidden lg:inline">Delete</span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {visible.length > limit && (
                <div className="text-center">
                  <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                    Show more ({visible.length - limit} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {editor && (
          <aside
            key={editorKey}
            data-testid="collectible-editor"
            role="dialog"
            aria-labelledby="col-editor-title"
            onKeyDown={onEditorKeyDown}
            className="fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-gray-900 p-4 pb-20 lg:sticky lg:inset-auto lg:top-[5.25rem] lg:z-auto lg:max-h-[calc(100vh-6.25rem)] lg:rounded-lg lg:border lg:border-gray-200 lg:dark:border-gray-800 lg:p-5 lg:pb-5"
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 id="col-editor-title" className="text-lg font-semibold truncate">
                {editor.id ? `Edit: ${editor.original.name}` : 'Add collectible'}
              </h2>
              <div className="flex items-center gap-1 shrink-0">
                {editor.id && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Previous entry"
                      disabled={!prevItem || saving}
                      onClick={() => prevItem && openEdit(prevItem)}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <span className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">
                      {editIndex >= 0 ? `${editIndex + 1} of ${visible.length}` : 'not in list'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Next entry"
                      disabled={!nextItem || saving}
                      onClick={() => nextItem && openEdit(nextItem)}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" aria-label="Close editor" onClick={closeEditor}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="col-name">Name</Label>
                <Input
                  id="col-name"
                  ref={nameRef}
                  value={editor.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="col-year">Year</Label>
                  <Input
                    id="col-year"
                    inputMode="numeric"
                    list="col-year-options"
                    value={editor.year}
                    onChange={(e) => patch({ year: e.target.value })}
                  />
                  <datalist id="col-year-options">
                    {suggestions.years.map((y) => (
                      <option key={y} value={y} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label htmlFor="col-artist">Artist</Label>
                  <Input
                    id="col-artist"
                    list="col-artist-options"
                    value={editor.artist}
                    onChange={(e) => patch({ artist: e.target.value })}
                  />
                  <datalist id="col-artist-options">
                    {suggestions.artists.map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div>
                <Label htmlFor="col-source">Source</Label>
                <Input
                  id="col-source"
                  list="col-source-options"
                  placeholder="e.g. Calling Sydney 2026 Top 8 prize"
                  value={editor.source}
                  onChange={(e) => patch({ source: e.target.value })}
                />
                <datalist id="col-source-options">
                  {suggestions.sources.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Start typing to pick an existing source — reuse the exact wording so filters group them.
                </p>
              </div>
              <div>
                <Label htmlFor="col-description">Description</Label>
                <Textarea
                  id="col-description"
                  rows={4}
                  placeholder="Provenance, print run, how it was distributed…"
                  value={editor.description}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </div>
              <ImageUpload
                key={editorKey}
                value={editor.imageUrl}
                onChange={(imageUrl) => patch({ imageUrl })}
                label="Image"
                description="Upload to Cloudflare or paste a URL"
              />
            </div>

            <div className="mt-5 space-y-2">
              <div className="flex flex-wrap gap-2">
                {editor.id ? (
                  <>
                    <Button onClick={save} disabled={saving}>
                      Save
                    </Button>
                    <Button variant="secondary" onClick={saveAndNext} disabled={saving || !nextItem}>
                      Save &amp; next
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={save} disabled={saving}>
                      Create
                    </Button>
                    <Button variant="secondary" onClick={createAndAddAnother} disabled={saving}>
                      Create &amp; add another
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={closeEditor} disabled={saving}>
                  Cancel
                </Button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {dirty ? 'Unsaved changes · ' : ''}
                <kbd className="font-sans font-bold">⌘/Ctrl</kbd>+<kbd className="font-sans font-bold">Enter</kbd> saves
                {editor.id ? (
                  <>
                    , +<kbd className="font-sans font-bold">Shift</kbd> saves &amp; moves on
                  </>
                ) : null}
                , <kbd className="font-sans font-bold">Esc</kbd> closes
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
