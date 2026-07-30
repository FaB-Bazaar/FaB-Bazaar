'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Power } from 'lucide-react';

const EDITION_OPTIONS = [
  { value: '', label: 'Any edition' },
  { value: 'A', label: 'Alpha' },
  { value: 'F', label: 'First Edition' },
  { value: 'U', label: 'Unlimited' },
  { value: 'N', label: 'Normal' },
];

const FOILING_OPTIONS = [
  { value: '', label: 'Any foiling' },
  { value: 'S', label: 'Non-foil' },
  { value: 'R', label: 'Rainbow Foil' },
  { value: 'C', label: 'Cold Foil' },
  { value: 'G', label: 'Gold Foil' },
];

interface FeedOverride {
  id: string;
  collectorNumber: string;
  edition: string | null;
  foiling: string | null;
  artVariations: string[] | null;
  language: string;
  setFields: Record<string, string>;
  reason: string;
  active: boolean;
  createdAt: string;
}

const emptyForm = {
  collectorNumber: '',
  edition: '',
  foiling: '',
  artVariations: '',
  productId: '',
  url: '',
  subtypeName: '',
  reason: '',
};

/**
 * Art-variations input → API value. Blank = any variant (wildcard); the
 * literal "none" = only printings WITHOUT a variant; otherwise
 * comma-separated tokens ("AA"). Needed because the feed can carry several
 * printings on one collector/edition/foiling key that differ only by art —
 * a wildcard override would patch all of them.
 */
function parseArtVariationsInput(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'none') return [];
  return trimmed.split(',').map((t) => t.trim()).filter(Boolean);
}

function formatArtVariations(value: string[] | null): string {
  if (value === null) return 'any art';
  if (value.length === 0) return 'no art variant';
  return value.join(',');
}

export function FeedOverridesClient() {
  const { toast } = useToast();
  const [overrides, setOverrides] = useState<FeedOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/feed-overrides');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load overrides');
      setOverrides(json.data);
    } catch (e: any) {
      toast({ title: 'Failed to load overrides', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const setFields: Record<string, string> = {};
    if (form.productId.trim()) setFields.tcgplayer_product_id = form.productId.trim();
    if (form.url.trim()) setFields.tcgplayer_url = form.url.trim();
    if (form.subtypeName.trim()) setFields.tcgplayer_subtype_name = form.subtypeName.trim();
    if (Object.keys(setFields).length === 0) {
      toast({ title: 'Nothing to override', description: 'Fill in at least one TCGplayer field.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/feed-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectorNumber: form.collectorNumber,
          edition: form.edition || null,
          foiling: form.foiling || null,
          artVariations: parseArtVariationsInput(form.artVariations),
          setFields,
          reason: form.reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create override');
      toast({ title: 'Override created', description: `${json.data.collectorNumber} — applies on the next pipeline run.` });
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      toast({ title: 'Failed to create override', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: FeedOverride) => {
    try {
      const res = await fetch(`/api/admin/feed-overrides/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !row.active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update override');
      await load();
    } catch (e: any) {
      toast({ title: 'Failed to update override', description: e.message, variant: 'destructive' });
    }
  };

  const remove = async (row: FeedOverride) => {
    if (!window.confirm(`Delete the override for ${row.collectorNumber}?`)) return;
    try {
      const res = await fetch(`/api/admin/feed-overrides/${row.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete override');
      toast({ title: 'Override deleted', description: row.collectorNumber });
      await load();
    } catch (e: any) {
      toast({ title: 'Failed to delete override', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={create}
        className="rounded-lg border border-gray-300 dark:border-gray-700 p-4 space-y-4"
        aria-label="Add feed override"
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" /> Add override
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-sm space-y-1">
            <span>Collector number *</span>
            <Input value={form.collectorNumber} onChange={setField('collectorNumber')} placeholder="SEA016" required />
          </label>
          <label className="text-sm space-y-1">
            <span>Edition</span>
            <select
              value={form.edition}
              onChange={setField('edition')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {EDITION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span>Foiling</span>
            <select
              value={form.foiling}
              onChange={setField('foiling')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {FOILING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <div className="text-sm space-y-1">
            <label className="space-y-1 block">
              <span>Art variations</span>
              <Input
                value={form.artVariations}
                onChange={setField('artVariations')}
                placeholder='blank = any · "none" = no variant · AA'
                aria-describedby="art-variations-help"
              />
            </label>
            <span id="art-variations-help" className="text-xs text-muted-foreground block">
              Art variants share collector/edition/foiling in the feed — use AA
              (or &quot;none&quot;) so the override only hits the right printing.
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-sm space-y-1">
            <span>TCGplayer product id</span>
            <Input value={form.productId} onChange={setField('productId')} placeholder="632643" />
          </label>
          <label className="text-sm space-y-1">
            <span>TCGplayer URL</span>
            <Input value={form.url} onChange={setField('url')} placeholder="https://www.tcgplayer.com/product/632643" />
          </label>
          <label className="text-sm space-y-1">
            <span>TCGplayer subtype</span>
            <Input value={form.subtypeName} onChange={setField('subtypeName')} placeholder="Rainbow Foil" />
          </label>
        </div>
        <label className="text-sm space-y-1 block">
          <span>Reason *</span>
          <Input
            value={form.reason}
            onChange={setField('reason')}
            placeholder="fab-cube feed points at the 1st Strike product"
            required
          />
        </label>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Create override'}
        </Button>
      </form>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading overrides…
        </div>
      ) : overrides.length === 0 ? (
        <p className="text-muted-foreground">No overrides yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-300 dark:border-gray-700 text-left">
                <th className="py-2 pr-4">Card</th>
                <th className="py-2 pr-4">Match</th>
                <th className="py-2 pr-4">Overridden fields</th>
                <th className="py-2 pr-4">Reason</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((row) => (
                <tr key={row.id} className="border-b border-gray-200 dark:border-gray-800 align-top">
                  <td className="py-2 pr-4 font-mono">{row.collectorNumber}</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {row.edition || 'any edition'} / {row.foiling || 'any foiling'} /{' '}
                    {formatArtVariations(row.artVariations)} / {row.language}
                  </td>
                  <td className="py-2 pr-4">
                    {Object.entries(row.setFields).map(([k, v]) => (
                      <div key={k} className="font-mono text-xs break-all">
                        {k} = {v}
                      </div>
                    ))}
                  </td>
                  <td className="py-2 pr-4 max-w-64">{row.reason}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={row.active ? 'default' : 'secondary'}>
                      {row.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(row)}
                        aria-label={row.active ? `Deactivate override for ${row.collectorNumber}` : `Activate override for ${row.collectorNumber}`}
                      >
                        <Power className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => remove(row)}
                        aria-label={`Delete override for ${row.collectorNumber}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
