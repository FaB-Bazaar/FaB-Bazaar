'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Search, Upload, CheckCircle, XCircle, Loader2, ImageOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { SET_MAP, FOILING_MAP, RARITY_MAP, EDITION_MAP } from '@/lib/fab-constants';

const CF_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';

const PITCH_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-yellow-400',
  3: 'bg-blue-500',
};

// SET_MAP has no aliases — every key is a unique set code
const SET_OPTIONS = Object.entries(SET_MAP).map(([key, label]) => ({
  value: key,
  label: `${label} (${key.toUpperCase()})`,
}));

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadId = useRef<string | null>(null);
  const { toast } = useToast();

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
            const cfUrl = uploadState?.newUrl ?? `${CF_BASE}/${row.printingId}/public`;
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
    </div>
  );
}
