'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Search, Upload, CheckCircle, XCircle, Loader2, ImageOff, ChevronLeft, ChevronRight, Sparkles, X, RefreshCw, Lock, LockOpen, Link } from 'lucide-react';
import { SET_MAP, FOILING_MAP, RARITY_MAP, EDITION_MAP } from '@/lib/fab-constants';
import FoilCardImage from '@/components/shared/FoilCardImage';

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

interface PrintingRow {
  printingId: string;
  name: string;
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  collectorNumber: string | null;
  pitch: number | null;
  isExtendedArt: boolean;
  artVariations: string[] | null;
  foilInsetTop: number | null;
  foilInsetRight: number | null;
  foilInsetBottom: number | null;
  foilInsetLeft: number | null;
  foilInsetRound: string | null;
  foilInsetLocked: boolean;
  tcgplayerProductId: string | null;
  tcgplayerUrl: string | null;
  tcgplayerSubtypeName: string | null;
}

interface FoilMaskValues {
  top: number;
  right: number;
  bottom: number;
  left: number;
  round: string;
  locked: boolean;
}

const DEFAULT_MASK: FoilMaskValues = { top: 12.5, right: 9.5, bottom: 41.5, left: 9.5, round: '1.5%', locked: false };
const CF_BASE_URL = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';

// Module-level on purpose: defining this inside FoilMaskEditor gives it a new
// identity every render, so React remounts the row and the number input drops
// focus after each keystroke (typing "10" only registered "1").
function SliderRow({ label, value, onValueChange }: { label: string; value: number; onValueChange: (v: number) => void }) {
  const [inputVal, setInputVal] = useState(String(value));

  useEffect(() => {
    setInputVal(String(value));
  }, [value]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={value}
        onChange={e => onValueChange(parseFloat(e.target.value))}
        className="flex-1 h-2 accent-yellow-500 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      />
      <input
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={inputVal}
        onChange={e => {
          setInputVal(e.target.value);
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v >= 0 && v <= 100) {
            onValueChange(v);
          }
        }}
        onBlur={e => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v >= 0 && v <= 100) {
            onValueChange(v);
          } else {
            setInputVal(String(value));
          }
        }}
        className="w-16 shrink-0 px-2 py-1 rounded border border-input bg-background text-sm font-mono text-right focus:outline-none focus:ring-1 focus:ring-yellow-500"
      />
      <span className="text-sm text-muted-foreground shrink-0">%</span>
    </div>
  );
}

export function FoilMaskEditor({
  row,
  onClose,
  onSaved,
}: {
  row: PrintingRow;
  onClose: () => void;
  onSaved: (values: FoilMaskValues) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [locked, setLocked] = useState(row.foilInsetLocked);
  const [mask, setMask] = useState<FoilMaskValues>(() => ({
    top:    row.foilInsetTop    ?? DEFAULT_MASK.top,
    right:  row.foilInsetRight  ?? DEFAULT_MASK.right,
    bottom: row.foilInsetBottom ?? DEFAULT_MASK.bottom,
    left:   row.foilInsetLeft   ?? DEFAULT_MASK.left,
    round:  row.foilInsetRound  ?? DEFAULT_MASK.round,
    locked: row.foilInsetLocked,
  }));

  const clipPath = `inset(${mask.top}% ${mask.right}% ${mask.bottom}% ${mask.left}% round ${mask.round})`;
  const imgSrc = `${CF_BASE_URL}/${row.printingId}/public`;
  const hasDbValues = row.foilInsetBottom != null;

  // Build a human-readable description of what the bulk apply will match
  const bulkLabel = (() => {
    const setUpper = row.set.toUpperCase();
    const foilName = row.foiling === 'r' ? 'Rainbow Foil' : row.foiling === 'c' ? 'Cold Foil' : row.foiling.toUpperCase();
    const variants = [
      row.isExtendedArt && 'EA',
      ...(row.artVariations?.filter(v => v !== 'EA') ?? []),
    ].filter(Boolean).join(' + ');
    return `${setUpper} · ${foilName}${variants ? ` · ${variants}` : ''}`;
  })();

  // Unset-only on purpose: the UI deliberately offers no overwrite mode, so a
  // bulk apply can never clobber a mask that was saved by hand.
  async function handleBulkApply() {
    setBulkApplying(true);
    try {
      const res = await fetch('/api/admin/foil-mask/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          set: row.set,
          foiling: row.foiling,
          isExtendedArt: row.isExtendedArt,
          artVariations: row.artVariations ?? [],
          overwrite: false,
          top: mask.top, right: mask.right, bottom: mask.bottom, left: mask.left, round: mask.round,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Bulk apply failed');
      toast({ title: 'Applied', description: `Updated ${json.updated} printings matching ${bulkLabel}` });
      fetch('/api/admin/bust-browse-cache', { method: 'POST' }).catch(() => null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bulk apply failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setBulkApplying(false);
    }
  }

  async function handleGlobalNoVariationApply() {
    setBulkApplying(true);
    try {
      const res = await fetch('/api/admin/foil-mask/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // No set — applies across all sets
          foiling: row.foiling,
          isExtendedArt: false,
          artVariations: [],
          overwrite: false,
          top: mask.top, right: mask.right, bottom: mask.bottom, left: mask.left, round: mask.round,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Global apply failed');
      const foilName = row.foiling === 'r' ? 'Rainbow Foil' : row.foiling.toUpperCase();
      toast({ title: 'Applied', description: `Updated ${json.updated} ${foilName} printings with no art variations (all sets)` });
      fetch('/api/admin/bust-browse-cache', { method: 'POST' }).catch(() => null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Global apply failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setBulkApplying(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/foil-mask/${encodeURIComponent(row.printingId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top: mask.top, right: mask.right, bottom: mask.bottom, left: mask.left, round: mask.round, locked }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Save failed');
      toast({ title: 'Saved', description: `Foil mask updated for ${row.name}${locked ? ' · locked' : ''}` });
      fetch('/api/admin/bust-browse-cache', { method: 'POST' }).catch(() => null);
      onSaved({ ...mask, locked });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 bg-background border rounded-xl shadow-2xl w-full max-w-4xl flex gap-8 p-6">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Card preview — live foil shimmer on hover */}
        <div className="flex-shrink-0 w-96">
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            Foil area preview <span className="text-[10px] opacity-60">(hover to preview shimmer)</span>
          </p>
          <div className="relative rounded overflow-hidden aspect-[5/7] bg-muted">
            <FoilCardImage
              foiling={row.foiling}
              foilInset={{ top: mask.top, right: mask.right, bottom: mask.bottom, left: mask.left, round: mask.round }}
              src={imgSrc}
              alt={row.name}
              className="w-full h-full"
              imgClassName="w-full h-full object-cover"
            />
            {/* Golden overlay showing the foil clip boundary */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'rgba(255, 200, 0, 0.25)',
                clipPath,
                boxShadow: 'inset 0 0 0 2px rgba(255, 200, 0, 0.9)',
              }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-mono break-all leading-tight">{clipPath}</p>
        </div>

        {/* Controls */}
        <div className="flex-1 space-y-4">
          <div>
            <p className="text-sm font-semibold">{row.name}</p>
            <p className="text-xs text-muted-foreground">Rainbow Foil mask editor</p>
          </div>

          {!hasDbValues && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-blue-500/10 border border-blue-500/30 text-xs text-blue-400">
              <span className="shrink-0 mt-0.5">ℹ</span>
              <span>No mask saved for this printing — showing defaults. Hit <strong>Save mask</strong> to lock these values in.</span>
            </div>
          )}

          <div className="space-y-3">
            <SliderRow label="Top inset" value={mask.top} onValueChange={v => setMask(prev => ({ ...prev, top: v }))} />
            <SliderRow label="Right inset" value={mask.right} onValueChange={v => setMask(prev => ({ ...prev, right: v }))} />
            <SliderRow label="Bottom inset" value={mask.bottom} onValueChange={v => setMask(prev => ({ ...prev, bottom: v }))} />
            <SliderRow label="Left inset" value={mask.left} onValueChange={v => setMask(prev => ({ ...prev, left: v }))} />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Corner round</label>
            <Input
              value={mask.round}
              onChange={e => setMask(prev => ({ ...prev, round: e.target.value }))}
              placeholder="e.g. 1.5%, 8px, 0%"
              className="font-mono text-sm h-8"
            />
            <p className="text-[10px] text-muted-foreground">CSS length used as the round argument of inset()</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleSave} disabled={saving || bulkApplying} className="flex-1">
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              Save mask
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMask(DEFAULT_MASK)} disabled={saving || bulkApplying}>
              Reset
            </Button>
            <Button
              size="sm"
              variant={locked ? 'default' : 'outline'}
              className={locked ? 'bg-emerald-700 hover:bg-emerald-600 border-emerald-600' : 'border-muted-foreground/30'}
              onClick={() => setLocked(l => !l)}
              disabled={saving || bulkApplying}
              title={locked ? 'Locked — bulk operations skip this card. Click to unlock.' : 'Unlocked — bulk operations can update this card. Click to lock.'}
            >
              {locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
            </Button>
          </div>
          {locked && (
            <p className="text-[11px] text-emerald-500">
              Locked — bulk operations will skip this card. Save to persist.
            </p>
          )}

          <div className="pt-1 border-t border-border space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Bulk apply to all <span className="font-semibold text-foreground">{bulkLabel}</span> printings with exactly matching art variations.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full border-yellow-500/40 text-yellow-600 hover:text-yellow-500 hover:border-yellow-500"
              onClick={() => handleBulkApply()}
              disabled={saving || bulkApplying}
            >
              {bulkApplying ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
              Apply to unset cards
            </Button>
          </div>

          <div className="pt-1 border-t border-border space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Apply to all <span className="font-semibold text-foreground">Rainbow Foil with no art variations</span> across every set (unset cards only).
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full border-blue-500/40 text-blue-500 hover:text-blue-400 hover:border-blue-400"
              onClick={() => handleGlobalNoVariationApply()}
              disabled={saving || bulkApplying}
            >
              {bulkApplying ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
              Apply globally (no art variation, unset only)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [maskEditorRow, setMaskEditorRow] = useState<PrintingRow | null>(null);
  const [tcgEditorRow, setTcgEditorRow] = useState<PrintingRow | null>(null);
  const [bustingCache, setBustingCache] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadId = useRef<string | null>(null);
  const { toast } = useToast();

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchPrintings(1);
  }

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
      formData.append('customId', printingId);

      const res = await fetch('/api/upload/cloudflare', { method: 'POST', body: formData });
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
    <div className="space-y-6">
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

      {/* Results summary */}
      {!loading && rows.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} printing{total !== 1 ? 's' : ''} — page {page} of {pages}
        </p>
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
          {rows.map(row => {
            const uploadState = uploadStates[row.printingId];
            const isBroken = brokenImages.has(row.printingId);
            const cfUrl = uploadState?.newUrl ?? `${CF_BASE_URL}/${row.printingId}/public`;
            const setLabel = (SET_MAP as Record<string, string>)[row.set] ?? row.set.toUpperCase();
            const foilLabel = (FOILING_MAP as Record<string, string>)[row.foiling] ?? row.foiling;
            const editionLabel = (EDITION_MAP as Record<string, string>)[row.edition] ?? row.edition;
            const rarityLabel = (RARITY_MAP as Record<string, string>)[row.rarity] ?? row.rarity;

            return (
              <div key={row.printingId} className="flex flex-col gap-1.5">
                {/* Image container */}
                <div className="relative rounded overflow-hidden bg-muted aspect-[5/7]">
                  {uploadState?.state === 'uploading' ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  ) : null}

                  {!isBroken ? (
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
                    <div className="absolute top-1 left-1">
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
                {row.foiling === 'r' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs w-full border-yellow-500/40 text-yellow-600 hover:text-yellow-500 hover:border-yellow-500"
                    onClick={() => setMaskEditorRow(row)}
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

      {/* Hidden shared file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Foil mask editor modal */}
      {maskEditorRow && (
        <FoilMaskEditor
          row={maskEditorRow}
          onClose={() => setMaskEditorRow(null)}
          onSaved={(values) => {
            setRows(prev => prev.map(r =>
              r.printingId === maskEditorRow.printingId
                ? { ...r, foilInsetTop: values.top, foilInsetRight: values.right, foilInsetBottom: values.bottom, foilInsetLeft: values.left, foilInsetRound: values.round, foilInsetLocked: values.locked }
                : r
            ));
            setMaskEditorRow(null);
          }}
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
