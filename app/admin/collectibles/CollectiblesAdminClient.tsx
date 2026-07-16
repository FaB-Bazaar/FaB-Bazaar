'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ImageOff, Pencil, Plus, Trash2 } from 'lucide-react';

const PAGE_SIZE = 50;

interface EditorState {
  id: string | null; // null = creating
  name: string;
  year: string;
  artist: string;
  source: string;
  description: string;
  imageUrl: string;
}

const EMPTY_EDITOR: EditorState = {
  id: null,
  name: '',
  year: '',
  artist: '',
  source: '',
  description: '',
  imageUrl: '',
};

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

export function CollectiblesAdminClient() {
  const { toast } = useToast();
  const [items, setItems] = useState<CollectibleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [submissions, setSubmissions] = useState<CollectibleSubmissionDTO[]>([]);
  // submission ids with an in-flight review call, so double-clicks don't race
  const [reviewing, setReviewing] = useState<Set<string>>(new Set());

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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.name, item.artist, item.source, String(item.year ?? '')]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [items, search]);

  const openEdit = (item: CollectibleDTO) => {
    setEditor({
      id: item.id,
      name: item.name,
      year: item.year != null ? String(item.year) : '',
      artist: item.artist ?? '',
      source: item.source ?? '',
      description: item.description ?? '',
      imageUrl: item.imageUrl ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!editor) return;
    if (!editor.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    const year = editor.year.trim() ? Number(editor.year.trim()) : null;
    if (editor.year.trim() && Number.isNaN(year)) {
      toast({ title: 'Year must be a number', variant: 'destructive' });
      return;
    }

    setSaving(true);
    if (editor.id) {
      const result = await collectiblesClient.adminUpdate(editor.id, {
        name: editor.name.trim(),
        year,
        artist: editor.artist.trim() || null,
        source: editor.source.trim() || null,
        description: editor.description.trim() || null,
        imageUrl: editor.imageUrl.trim() || null,
      });
      if (result.success) {
        toast({ title: 'Saved' });
        setEditor(null);
        void load();
      } else {
        toast({ title: 'Save failed', description: result.error, variant: 'destructive' });
      }
    } else {
      const result = await collectiblesClient.adminCreate({
        name: editor.name.trim(),
        year: year ?? undefined,
        artist: editor.artist.trim() || undefined,
        source: editor.source.trim() || undefined,
        description: editor.description.trim() || undefined,
        imageUrl: editor.imageUrl.trim() || undefined,
      });
      if (result.success) {
        toast({ title: 'Created' });
        setEditor(null);
        void load();
      } else {
        toast({ title: 'Create failed', description: result.error, variant: 'destructive' });
      }
    }
    setSaving(false);
  };

  const remove = async (item: CollectibleDTO) => {
    const confirmed = window.confirm(
      `Delete "${item.name}"? Collectors' have/want marks on it are removed too.`,
    );
    if (!confirmed) return;
    const result = await collectiblesClient.adminDelete(item.id);
    if (result.success) {
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      toast({ title: 'Deleted' });
    } else {
      toast({ title: 'Delete failed', description: result.error, variant: 'destructive' });
    }
  };

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

      {/* Editor panel */}
      {editor ? (
        <div
          data-testid="collectible-editor"
          className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 md:p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold">
            {editor.id ? `Edit: ${editor.name}` : 'Add collectible'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="col-name">Name</Label>
                <Input
                  id="col-name"
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="col-year">Year</Label>
                  <Input
                    id="col-year"
                    inputMode="numeric"
                    value={editor.year}
                    onChange={(e) => setEditor({ ...editor, year: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="col-artist">Artist</Label>
                  <Input
                    id="col-artist"
                    value={editor.artist}
                    onChange={(e) => setEditor({ ...editor, artist: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="col-source">Source</Label>
                <Input
                  id="col-source"
                  placeholder="e.g. Calling Sydney 2026 Top 8 prize"
                  value={editor.source}
                  onChange={(e) => setEditor({ ...editor, source: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="col-description">Description</Label>
                <Textarea
                  id="col-description"
                  rows={5}
                  placeholder="Provenance, print run, how it was distributed…"
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                />
              </div>
            </div>
            <div>
              <ImageUpload
                value={editor.imageUrl}
                onChange={(imageUrl) => setEditor((prev) => (prev ? { ...prev, imageUrl } : prev))}
                label="Image"
                description="Upload to Cloudflare or paste a URL"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {editor.id ? 'Save' : 'Create'}
            </Button>
            <Button variant="outline" onClick={() => setEditor(null)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setEditor(EMPTY_EDITOR)}>
          <Plus className="h-4 w-4 mr-1" />
          Add collectible
        </Button>
      )}

      {/* Search */}
      <div>
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
          className="mt-1 max-w-md"
        />
      </div>

      {/* List */}
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
            {visible.slice(0, limit).map((item) => (
              <li
                key={item.id}
                data-testid="collectible-row"
                className="flex items-center gap-4 p-3"
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
                <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => remove(item)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </li>
            ))}
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
  );
}
