'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Search, Upload, CheckCircle, XCircle, Loader2, ImageOff, ChevronLeft, ChevronRight, Sparkles, X, RefreshCw, Lock, Link, Undo2 } from 'lucide-react';
import { SET_MAP, FOILING_MAP, RARITY_MAP, EDITION_MAP } from '@/lib/fab-constants';
import { FoilMaskEditor } from './FoilMaskEditor';
import { CF_BASE_URL, type FoilMaskBulkOp, type FoilMaskTemplate, type PrintingRow } from './types';

const PITCH_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-yellow-400',
  3: 'bg-blue-500',
};

// SET_MAP has no aliases — every key is a unique set code.
// Sorted by code with code first so the native <select> keyboard prefix-search works (e.g. press M-P-W).
const SET_OPTIONS = Object.entries(SET_MAP)
  .map(([key, label]) => ({ value: key, label: `${key.toUpperCase()} — ${label}` }))
  .sort((a, b) => a.value.localeCompare(b.value));

const EDITION_OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'f', label: 'First Edition' },
  { value: 'u', label: 'Unlimited' },
  { value: 'n', label: 'Normal' },
];

const FOILING_OPTIONS = [
  { value: 's', label: 'Non-foil' },
  { value: 'r', label: 'Rainbow Foil' },
  { value: 'c', label: 'Cold Foil' },
  { value: 'g', label: 'Gold Foil' },
];

/** Masks only mean something on foil printings, so only those are selectable. */
const isMaskable = (row: PrintingRow) => row.foiling === 'r';

const SUBTYPE_OPTIONS = [
  { value: '', label: '— None —' },
  { value: 'Rainbow Foil', label: 'Rainbow Foil' },
  { value: 'Cold Foil', label: 'Cold Foil' },
];

function TcgplayerEditor({
  row,
  onClose,
  onSaved,
}: {
  row: PrintingRow;
  onClose: () => void;
  onSaved: (values: { tcgplayerProductId: string | null; tcgplayerUrl: string | null; tcgplayerSubtypeName: string | null }) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [productId, setProductId] = useState(row.tcgplayerProductId ?? '');
  const [url, setUrl] = useState(row.tcgplayerUrl ?? '');
  const [subtype, setSubtype] = useState(row.tcgplayerSubtypeName ?? '');

  // Auto-fill product ID from URL when URL is pasted
  function handleUrlChange(val: string) {
    setUrl(val);
    const match = val.match(/tcgplayer\.com\/product\/(\d+)/);
    if (match) setProductId(match[1]);
  }

  async function handleSave() {
    if (!productId && !url && !subtype) {
      toast({ title: 'Nothing to save', description: 'Enter at least one field.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Strip query params from URL before saving
      let cleanUrl: string | null = null;
      if (url.trim()) {
        try {
          const u = new URL(url.trim());
          cleanUrl = `${u.origin}${u.pathname}`;
        } catch {
          cleanUrl = url.trim();
        }
      }

      const res = await fetch(`/api/admin/printings/${encodeURIComponent(row.printingId)}/tcgplayer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tcgplayerProductId: productId.trim() || null,
          tcgplayerUrl: cleanUrl,
          tcgplayerSubtypeName: subtype || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Save failed');
      toast({ title: 'Saved', description: `TCGplayer data updated for ${row.name}` });
      onSaved({
        tcgplayerProductId: productId.trim() || null,
        tcgplayerUrl: cleanUrl,
        tcgplayerSubtypeName: subtype || null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-background border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <p className="text-sm font-semibold">{row.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{row.printingId}</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">TCGplayer URL</label>
            <Input
              value={url}
              onChange={e => handleUrlChange(e.target.value)}
              placeholder="https://www.tcgplayer.com/product/..."
              className="text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground">Paste the full URL — query params will be stripped automatically and the product ID filled in.</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Product ID</label>
            <Input
              value={productId}
              onChange={e => setProductId(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 657480"
              className="text-sm font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Foil type (subtype name)</label>
            <select
              className={selectClass}
              value={subtype}
              onChange={e => setSubtype(e.target.value)}
            >
              {SUBTYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

interface CardUploadState {
  state: UploadState;
  newUrl?: string;
  error?: string;
}

export function ImageUploadsClient() {
  const [nameFilter, setNameFilter] = useState('');
  const [setFilter, setSetFilter] = useState('');
  const [editionFilter, setEditionFilter] = useState('');
  const [foilingFilter, setFoilingFilter] = useState('');
  const [rows, setRows] = useState<PrintingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadStates, setUploadStates] = useState<Record<string, CardUploadState>>({});
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const [maskEditorRows, setMaskEditorRows] = useState<PrintingRow[] | null>(null);
  const [tcgEditorRow, setTcgEditorRow] = useState<PrintingRow | null>(null);
  const [bustingCache, setBustingCache] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<FoilMaskTemplate[]>([]);
  const [lastOp, setLastOp] = useState<FoilMaskBulkOp | null>(null);
  const [undoing, setUndoing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadId = useRef<string | null>(null);
  // Anchor for shift-click range selection, as an index into the current page.
  const lastPickedIdx = useRef<number | null>(null);
  const { toast } = useToast();

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/foil-mask/templates');
      const json = await res.json();
      if (json.success) setTemplates(json.data);
    } catch {
      // The rail is an accelerant, not a requirement — fail quiet.
    }
  }, []);

  const loadLastOp = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/foil-mask/ops?limit=5');
      const json = await res.json();
      if (json.success) {
        setLastOp((json.data as FoilMaskBulkOp[]).find(op => !op.undoneAt) ?? null);
      }
    } catch {
      setLastOp(null);
    }
  }, []);

  async function handleUndo() {
    if (!lastOp) return;
    setUndoing(true);
    try {
      const res = await fetch('/api/admin/foil-mask/ops/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opId: lastOp.id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Undo failed');
      toast({ title: 'Undone', description: `Restored ${json.data.restored.toLocaleString()} printings to their previous masks.` });
      fetch('/api/admin/bust-browse-cache', { method: 'POST' }).catch(() => null);
      await loadLastOp();
      fetchPrintings(page);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Undo failed', variant: 'destructive' });
    } finally {
      setUndoing(false);
    }
  }

  async function handleBustCache() {
    setBustingCache(true);
    try {
      const res = await fetch('/api/admin/bust-browse-cache', { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      toast({ title: 'Cache cleared', description: 'Search page will load fresh data on next visit.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clear cache';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setBustingCache(false);
    }
  }

  const fetchPrintings = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (nameFilter.trim()) params.set('name', nameFilter.trim());
      if (setFilter) params.set('set', setFilter);
      if (editionFilter) params.set('edition', editionFilter);
      if (foilingFilter) params.set('foiling', foilingFilter);

      const res = await fetch(`/api/admin/printings-missing-images?${params}`);
      const json = await res.json();
      if (json.success) {
        setRows(json.data.printings);
        setTotal(json.data.total);
        setPage(json.data.page);
        setPages(json.data.pages);
        // Selection is page-scoped: carrying ids across pages would hide part
        // of the blast radius from the operator.
        setSelected(new Set());
        lastPickedIdx.current = null;
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load printings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [nameFilter, setFilter, editionFilter, foilingFilter, toast]);

  useEffect(() => {
    fetchPrintings(1);
    loadTemplates();
    loadLastOp();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchPrintings(1);
  }

  // ------------------------------------------------------------- selection

  function toggleSelected(idx: number, shiftKey: boolean) {
    const row = rows[idx];
    if (!isMaskable(row)) return;

    // Read the anchor BEFORE the updater and capture it. Reading the ref inside
    // makes the updater impure: React invokes it twice under StrictMode, and by
    // the second pass the ref has already moved to idx, so the range branch is
    // skipped and a shift-click collapses to a plain toggle.
    const anchor = lastPickedIdx.current;
    lastPickedIdx.current = idx;

    setSelected(prev => {
      const next = new Set(prev);

      if (shiftKey && anchor !== null && anchor !== idx) {
        // Range select follows the anchor's resulting state, like a file list.
        const [from, to] = anchor < idx ? [anchor, idx] : [idx, anchor];
        const turningOn = !prev.has(row.printingId);
        for (let i = from; i <= to; i++) {
          if (!isMaskable(rows[i])) continue;
          if (turningOn) next.add(rows[i].printingId);
          else next.delete(rows[i].printingId);
        }
      } else if (next.has(row.printingId)) {
        next.delete(row.printingId);
      } else {
        next.add(row.printingId);
      }
      return next;
    });
  }

  function selectAllOnPage() {
    setSelected(new Set(rows.filter(isMaskable).map(r => r.printingId)));
  }

  const selectedRows = rows.filter(r => selected.has(r.printingId));
  const maskableCount = rows.filter(isMaskable).length;

  function triggerUpload(printingId: string) {
    pendingUploadId.current = printingId;
    fileInputRef.current?.click();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const printingId = pendingUploadId.current;
    if (!file || !printingId) return;

    e.target.value = '';
    pendingUploadId.current = null;

    setUploadStates(prev => ({ ...prev, [printingId]: { state: 'uploading' } }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Dedicated admin endpoint: derives the DETERMINISTIC image id (with
      // printing_id fallback on key collisions) and persists image_url —
      // the old generic /api/upload/cloudflare path uploaded under the
      // printing_id and never updated the DB row.
      const res = await fetch(`/api/admin/printings/${encodeURIComponent(printingId)}/image`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (!json.success) throw new Error(json.error || 'Upload failed');

      const newUrl = json.data.imageUrl as string;
      setUploadStates(prev => ({ ...prev, [printingId]: { state: 'success', newUrl } }));
      setBrokenImages(prev => { const s = new Set(prev); s.delete(printingId); return s; });
      toast({ title: 'Uploaded', description: `Image for ${printingId} uploaded successfully.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadStates(prev => ({ ...prev, [printingId]: { state: 'error', error: msg } }));
      toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
    }
  }

  const selectClass = "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6 pb-24">
      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-40">
          <label className="text-sm font-medium mb-1 block">Card name</label>
          <Input
            placeholder="Search by name..."
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Set</label>
          <select
            className={selectClass}
            value={setFilter}
            onChange={e => setSetFilter(e.target.value)}
          >
            <option value="">All sets</option>
            {SET_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Edition</label>
          <select
            className={selectClass}
            value={editionFilter}
            onChange={e => setEditionFilter(e.target.value)}
          >
            <option value="">All editions</option>
            {EDITION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Foiling</label>
          <select
            className={selectClass}
            value={foilingFilter}
            onChange={e => setFoilingFilter(e.target.value)}
          >
            <option value="">All foilings</option>
            {FOILING_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <Button type="submit" disabled={loading}>
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
            : <Search className="h-4 w-4 mr-2" />}
          Search
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={bustingCache}
          onClick={handleBustCache}
          title="Clears the Redis browse cache so foil mask changes appear on the search page immediately"
        >
          {bustingCache
            ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
            : <RefreshCw className="h-4 w-4 mr-2" />}
          Bust cache
        </Button>
      </form>

      {/* Undo banner — the last bulk apply stays reversible until it is undone */}
      {lastOp && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 text-xs">
          <Undo2 className="h-4 w-4 text-yellow-600 shrink-0" />
          <span className="flex-1 min-w-0">
            Last bulk apply: <span className="font-medium">{lastOp.description}</span>{' '}
            — <span className="tabular-nums">{lastOp.affectedCount.toLocaleString()}</span> printing{lastOp.affectedCount === 1 ? '' : 's'}
          </span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleUndo} disabled={undoing}>
            {undoing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Undo2 className="h-3 w-3 mr-1" />}
            Undo
          </Button>
        </div>
      )}

      {/* Results summary */}
      {!loading && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{total.toLocaleString()} printing{total !== 1 ? 's' : ''} — page {page} of {pages}</span>
          {maskableCount > 0 && (
            <>
              <span aria-hidden className="opacity-40">·</span>
              <button type="button" className="underline hover:text-foreground" onClick={selectAllOnPage}>
                Select all {maskableCount} foil on page
              </button>
              {selected.size > 0 && (
                <button type="button" className="underline hover:text-foreground" onClick={() => setSelected(new Set())}>
                  Clear selection
                </button>
              )}
              <span className="text-[11px] opacity-70">Shift-click to select a range</span>
            </>
          )}
        </div>
      )}

      {/* Card Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <ImageOff className="h-10 w-10" />
          <p className="text-sm">No printings found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {rows.map((row, idx) => {
            const uploadState = uploadStates[row.printingId];
            const isBroken = brokenImages.has(row.printingId);
            const cfUrl = uploadState?.newUrl ?? row.imageUrl ?? `${CF_BASE_URL}/${row.printingId}/public`;
            const setLabel = (SET_MAP as Record<string, string>)[row.set] ?? row.set.toUpperCase();
            const foilLabel = (FOILING_MAP as Record<string, string>)[row.foiling] ?? row.foiling;
            const editionLabel = (EDITION_MAP as Record<string, string>)[row.edition] ?? row.edition;
            const rarityLabel = (RARITY_MAP as Record<string, string>)[row.rarity] ?? row.rarity;
            const isSelected = selected.has(row.printingId);

            return (
              <div key={row.printingId} className="flex flex-col gap-1.5">
                {/* Image container */}
                <div className={`relative rounded overflow-hidden bg-muted aspect-[5/7] ${isSelected ? 'ring-2 ring-yellow-500' : ''}`}>
                  {uploadState?.state === 'uploading' ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  ) : null}

                  {!isBroken ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cfUrl}
                      alt={row.name}
                      className="w-full h-full object-cover"
                      onError={() => setBrokenImages(prev => new Set(prev).add(row.printingId))}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground p-2">
                      <ImageOff className="h-5 w-5" />
                      <span className="text-[10px] text-center leading-tight">{row.name}</span>
                    </div>
                  )}

                  {/* Selection checkbox — foil printings only.
                      Deliberately NOT wrapped in a <label>: a label re-dispatches
                      the click to its control with shiftKey cleared, which
                      silently kills shift-range selection. */}
                  {isMaskable(row) && (
                    <span
                      className="absolute top-1 left-1 flex items-center justify-center h-6 w-6 rounded bg-black/60 hover:bg-black/80"
                      title={`${isSelected ? 'Deselect' : 'Select'} ${row.name} (shift-click for a range)`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        aria-label={`Select ${row.name}`}
                        onChange={() => { /* click handler owns the state so shiftKey is available */ }}
                        onClick={e => toggleSelected(idx, e.shiftKey)}
                        className="h-3.5 w-3.5 accent-yellow-500 cursor-pointer"
                      />
                    </span>
                  )}

                  {/* Status overlay badge */}
                  {uploadState?.state === 'success' && (
                    <div className="absolute top-1 right-1 bg-green-600 rounded-full p-0.5">
                      <CheckCircle className="h-3 w-3 text-white" />
                    </div>
                  )}
                  {uploadState?.state === 'error' && (
                    <div className="absolute top-1 right-1 bg-destructive rounded-full p-0.5" title={uploadState.error}>
                      <XCircle className="h-3 w-3 text-white" />
                    </div>
                  )}
                  {isBroken && !uploadState && (
                    <div className="absolute bottom-1 left-1">
                      <Badge variant="destructive" className="text-[9px] px-1 py-0">Missing</Badge>
                    </div>
                  )}
                </div>

                {/* Card info */}
                <div className="space-y-0.5">
                  <div className="flex items-start gap-1">
                    {row.pitch != null && (
                      <span
                        className={`mt-0.5 shrink-0 inline-block w-2.5 h-2.5 rounded-full ${PITCH_COLORS[row.pitch] ?? 'bg-gray-400'}`}
                        title={`Pitch ${row.pitch}`}
                      />
                    )}
                    <a
                      href={`/printing/${row.printingId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium hover:underline line-clamp-2 leading-tight"
                      title={row.name}
                    >
                      {row.name}
                    </a>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {setLabel} &middot; {editionLabel} &middot; {foilLabel}
                    {row.collectorNumber ? ` · #${row.collectorNumber}` : ''}
                  </p>
                  <p className="font-mono text-[9px] text-muted-foreground truncate" title={row.printingId}>
                    {row.printingId}
                  </p>
                </div>

                {/* Upload button */}
                <Button
                  size="sm"
                  variant={uploadState?.state === 'success' ? 'outline' : isBroken ? 'default' : 'secondary'}
                  className="h-7 text-xs w-full"
                  disabled={uploadState?.state === 'uploading'}
                  onClick={() => triggerUpload(row.printingId)}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  {uploadState?.state === 'success' ? 'Re-upload' : 'Upload'}
                </Button>

                {/* Foil mask button — only for rainbow foil cards */}
                {isMaskable(row) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs w-full border-yellow-500/40 text-yellow-600 hover:text-yellow-500 hover:border-yellow-500"
                    onClick={() => setMaskEditorRows([row])}
                  >
                    {row.foilInsetLocked
                      ? <Lock className="h-3 w-3 mr-1 text-emerald-500" />
                      : <Sparkles className="h-3 w-3 mr-1" />}
                    {row.foilInsetBottom != null ? 'Edit mask' : 'Set mask'}
                  </Button>
                )}

                {/* TCGplayer button */}
                <Button
                  size="sm"
                  variant="outline"
                  className={`h-7 text-xs w-full ${row.tcgplayerProductId ? 'border-emerald-500/40 text-emerald-600 hover:text-emerald-500 hover:border-emerald-500' : 'border-muted-foreground/30 text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setTcgEditorRow(row)}
                  title={row.tcgplayerProductId ? `TCGplayer #${row.tcgplayerProductId}` : 'No TCGplayer link set'}
                >
                  <Link className="h-3 w-3 mr-1" />
                  {row.tcgplayerProductId ? 'Edit TCG' : 'Set TCG'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => fetchPrintings(page - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages || loading}
            onClick={() => fetchPrintings(page + 1)}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Sticky selection bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 py-3">
            <span className="text-sm font-medium">
              {selected.size} selected
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              The mask applies to exactly these cards
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button
              size="sm"
              className="border-yellow-500/40"
              onClick={() => setMaskEditorRows(selectedRows)}
            >
              <Sparkles className="h-3 w-3 mr-1.5" />
              Edit foil mask
            </Button>
          </div>
        </div>
      )}

      {/* Hidden shared file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Foil mask editor modal */}
      {maskEditorRows && maskEditorRows.length > 0 && (
        <FoilMaskEditor
          rows={maskEditorRows}
          templates={templates}
          onClose={() => setMaskEditorRows(null)}
          onSaved={(printingIds, values) => {
            const touched = new Set(printingIds);
            setRows(prev => prev.map(r =>
              touched.has(r.printingId)
                ? {
                    ...r,
                    foilInsetTop: values.top,
                    foilInsetRight: values.right,
                    foilInsetBottom: values.bottom,
                    foilInsetLeft: values.left,
                    foilInsetRound: values.round,
                    // Lock state is only editable one card at a time.
                    foilInsetLocked: printingIds.length === 1 ? values.locked : r.foilInsetLocked,
                  }
                : r
            ));
            setMaskEditorRows(null);
            setSelected(new Set());
            loadLastOp();
          }}
          onTemplatesChanged={() => { loadTemplates(); loadLastOp(); }}
        />
      )}

      {/* TCGplayer editor modal */}
      {tcgEditorRow && (
        <TcgplayerEditor
          row={tcgEditorRow}
          onClose={() => setTcgEditorRow(null)}
          onSaved={(values) => {
            setRows(prev => prev.map(r =>
              r.printingId === tcgEditorRow.printingId
                ? { ...r, ...values }
                : r
            ));
            setTcgEditorRow(null);
          }}
        />
      )}
    </div>
  );
}
