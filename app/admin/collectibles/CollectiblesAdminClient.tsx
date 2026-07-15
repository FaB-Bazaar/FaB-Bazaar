'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collectiblesClient } from '@/lib/client';
import type { CollectibleDTO } from '@/lib/services/contracts/ICollectibleService';
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

export function CollectiblesAdminClient() {
  const { toast } = useToast();
  const [items, setItems] = useState<CollectibleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await collectiblesClient.listCollectibles();
    if (result.success) setItems(result.data);
    else toast({ title: 'Load failed', description: result.error, variant: 'destructive' });
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

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
