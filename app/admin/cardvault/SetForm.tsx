'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, X } from 'lucide-react';
import { PRODUCT_KINDS, kindOf, type ProductKind, type TcgGroupRef } from '@/lib/sets/set-input';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

interface TcgGroupOption { groupId: number; name: string; abbreviation: string | null; publishedOn: string | null; mappedTo: string[] }

export interface SavedSet { code: string; displayCode: string }

/**
 * Register a new set, or edit one (code fixed). Everything the site needs to
 * show and price a set: its details, which TCGplayer groups price it, and its
 * logo. Saving refreshes the runtime set overlay server-side, so the set is
 * live across the site immediately.
 */
export function SetForm({ editCode, onDone, onCancel }: {
  editCode?: string;
  onDone: (set: SavedSet, message: string) => void;
  onCancel: () => void;
}) {
  const editing = Boolean(editCode);
  const [groups, setGroups] = useState<TcgGroupOption[] | null>(null);
  const [groupsError, setGroupsError] = useState('');
  const [loading, setLoading] = useState(editing);

  const [code, setCode] = useState(editCode?.toUpperCase() ?? '');
  const [name, setName] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [legalFrom, setLegalFrom] = useState('');
  const [kind, setKind] = useState<ProductKind | ''>('');
  const [inCardFilters, setInCardFilters] = useState(true);
  const [hasFirstEdition, setHasFirstEdition] = useState(false);
  const [chosen, setChosen] = useState<TcgGroupRef[]>([]);
  const [existingGroups, setExistingGroups] = useState<TcgGroupRef[]>([]);
  const [logo, setLogo] = useState<File | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetch('/api/admin/cardvault/tcg-groups')
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setGroups(j.data); })
      .catch((e) => setGroupsError(e.message ?? 'Could not load TCGplayer groups'));
  }, []);

  useEffect(() => {
    if (!editCode) return;
    fetch(`/api/admin/cardvault/sets/${editCode}`).then((r) => r.json()).then((j) => {
      const s = j.data?.set;
      if (s) {
        setName(s.name);
        setReleaseDate(s.releaseDate ?? '');
        setLegalFrom(s.legalFrom ?? '');
        setKind(kindOf(s.category, s.tier));
        setInCardFilters(s.inCardFilters ?? s.category === 'standard');
        setHasFirstEdition(s.hasFirstEdition);
        setCurrentLogoUrl(s.imageId ? `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${s.imageId}/public` : null);
      }
      setExistingGroups(j.data?.tcgGroups ?? []);
      setLoading(false);
    });
  }, [editCode]);

  // One object URL per chosen file, released when it changes.
  const logoPreview = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

  const linked = useMemo(() => new Set([...existingGroups, ...chosen].map((g) => g.groupId)), [existingGroups, chosen]);

  const pickGroup = (groupId: number) => {
    const g = groups?.find((x) => x.groupId === groupId);
    if (!g || linked.has(g.groupId)) return;
    setChosen((c) => [...c, { groupId: g.groupId, name: g.name }]);
    // The first group pre-fills an empty registration.
    if (!editing && !chosen.length) {
      if (!code && g.abbreviation) setCode(g.abbreviation.toUpperCase());
      if (!name) setName(g.name);
      if (!releaseDate && g.publishedOn) setReleaseDate(g.publishedOn);
    }
  };

  const chooseKind = (k: ProductKind) => {
    setKind(k);
    if (!editing) setInCardFilters(k === 'booster' || k === 'supplemental');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErrors({}); setFormError('');
    try {
      const body: Record<string, unknown> = {
        name, releaseDate, legalFrom, kind, inCardFilters, hasFirstEdition, tcgGroups: chosen,
        ...(editing ? {} : { code }),
      };
      const res = await fetch(editing ? `/api/admin/cardvault/sets/${editCode}` : '/api/admin/cardvault/sets', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) {
        setErrors(j.fields ?? {});
        setFormError(j.fields ? 'Some fields need fixing.' : j.error);
        return;
      }
      const saved: SavedSet = { code: j.data.code, displayCode: j.data.displayCode };
      let logoNote = '';
      if (logo) {
        const form = new FormData();
        form.append('file', logo);
        const up = await fetch(`/api/admin/cardvault/sets/${saved.code}/logo`, { method: 'POST', body: form });
        if (!up.ok) logoNote = ` The logo didn't upload (${(await up.json().catch(() => ({}))).error ?? up.status}) — try again from “Edit set details”.`;
      }
      onDone(saved, editing
        ? `Saved ${saved.displayCode}.${logoNote}`
        : `${saved.displayCode} is registered and live on the site. Next: check CardVault for its cards.${logoNote}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Saving failed');
    } finally {
      setSaving(false);
    }
  };

  const title = editing ? `Edit ${editCode!.toUpperCase()}` : 'Register a new set';
  const fieldError = (f: string) => errors[f] && <p className="text-sm text-red-700 dark:text-red-400">{errors[f]}</p>;

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading {editCode?.toUpperCase()}…</div>;

  return (
    <form aria-label={title} onSubmit={submit} className="rounded-lg border-2 border-blue-500 p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-base text-muted-foreground">
            {editing
              ? 'Changes show across the site within a minute.'
              : 'Once registered, the set shows across the site straight away and can be filled from CardVault.'}
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onCancel} className={focusRing} aria-label="Close"><X className="h-5 w-5" /></Button>
      </div>

      {/* 1 — TCGplayer */}
      <section className="space-y-2">
        <Label htmlFor="sf-group" className="text-base font-semibold">
          {editing ? 'Add a TCGplayer group' : 'Find it on TCGplayer'}
        </Label>
        <p className="text-sm text-muted-foreground">
          {editing
            ? 'Prices come from these groups, refreshed nightly.'
            : 'Picking its TCGplayer group fills in the details below and is where prices come from (refreshed nightly). Not listed yet? Skip this — you can add it later.'}
        </p>
        {groupsError ? (
          <p className="text-sm text-red-700 dark:text-red-400">{groupsError}</p>
        ) : (
          <select
            id="sf-group"
            value=""
            disabled={!groups}
            onChange={(e) => pickGroup(Number(e.target.value))}
            className={`w-full rounded-md border bg-background px-3 py-2 text-base ${focusRing}`}
          >
            <option value="">{groups ? 'Choose a TCGplayer group…' : 'Loading TCGplayer groups…'}</option>
            {groups?.map((g) => (
              <option key={g.groupId} value={g.groupId} disabled={linked.has(g.groupId)}>
                {g.name}{g.abbreviation ? ` (${g.abbreviation})` : ''}{g.publishedOn ? ` · ${g.publishedOn}` : ''}
                {g.mappedTo.length ? ` — prices ${g.mappedTo.map((c) => c.toUpperCase()).join(', ')}` : ''}
              </option>
            ))}
          </select>
        )}
        {(existingGroups.length > 0 || chosen.length > 0) && (
          <ul className="space-y-1" aria-label="Pricing groups">
            {existingGroups.map((g) => (
              <li key={g.groupId} className="text-sm">✓ {g.name} <span className="text-muted-foreground">#{g.groupId}</span></li>
            ))}
            {chosen.map((g) => (
              <li key={g.groupId} className="flex items-center gap-2 text-sm">
                <span>＋ {g.name} <span className="text-muted-foreground">#{g.groupId}</span></span>
                <button type="button" onClick={() => setChosen((c) => c.filter((x) => x.groupId !== g.groupId))}
                  className={`underline text-muted-foreground ${focusRing} rounded`}>remove</button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          Marvels sold in an earlier set&apos;s packs? Add that set&apos;s group too — TCGplayer lists them there.
        </p>
        {fieldError('tcgGroups')}
      </section>

      {/* 2 — details */}
      <section className="grid gap-4 md:grid-cols-[10rem_1fr_12rem]">
        <div className="space-y-1">
          <Label htmlFor="sf-code" className="text-base">Code</Label>
          <Input id="sf-code" value={code} disabled={editing} maxLength={10} placeholder="SPW"
            onChange={(e) => setCode(e.target.value.toUpperCase())} className="text-base uppercase" />
          {fieldError('code')}
        </div>
        <div className="space-y-1">
          <Label htmlFor="sf-name" className="text-base">Name</Label>
          <Input id="sf-name" value={name} onChange={(e) => setName(e.target.value)} className="text-base" />
          {fieldError('name')}
        </div>
        <div className="space-y-1">
          <Label htmlFor="sf-date" className="text-base">Release date</Label>
          <Input id="sf-date" type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="text-base" />
          {fieldError('releaseDate')}
        </div>
      </section>
      {!editing && <p className="-mt-3 text-sm text-muted-foreground">The code is how the site and CardVault name the set (the collector-number prefix). It can&apos;t be changed later.</p>}

      <fieldset className="space-y-2">
        <legend className="text-base font-semibold">Kind of product</legend>
        <div className="grid gap-2 md:grid-cols-3">
          {PRODUCT_KINDS.map((k) => (
            <label key={k.value} className={`flex cursor-pointer gap-2 rounded-md border p-3 ${kind === k.value ? 'border-blue-500 border-2' : ''}`}>
              <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => chooseKind(k.value)} className={`mt-1 ${focusRing}`} />
              <span>
                <span className="block text-base font-medium">{k.label}</span>
                <span className="block text-sm text-muted-foreground">{k.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {fieldError('kind')}
      </fieldset>

      <div className="space-y-2">
        <label className="flex items-start gap-2 text-base">
          <input type="checkbox" checked={inCardFilters} onChange={(e) => setInCardFilters(e.target.checked)} className={`mt-1 ${focusRing}`} />
          <span>Show in the set filters <span className="block text-sm text-muted-foreground">The set chips on search, binders, wants and collection.</span></span>
        </label>
        <label className="flex items-start gap-2 text-base">
          <input type="checkbox" checked={hasFirstEdition} onChange={(e) => setHasFirstEdition(e.target.checked)} className={`mt-1 ${focusRing}`} />
          <span>Printed in 1st Edition <span className="block text-sm text-muted-foreground">Older sets only — new sets have no 1st Edition.</span></span>
        </label>
      </div>

      {/* 3 — logo */}
      <section className="space-y-2">
        <Label htmlFor="sf-logo" className="text-base font-semibold">Set logo (optional)</Label>
        <div className="flex flex-wrap items-center gap-4">
          {(logoPreview || currentLogoUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview ?? currentLogoUrl!} alt="Logo preview" className="h-14 max-w-[220px] rounded border object-contain bg-white/50" />
          )}
          <input id="sf-logo" type="file" accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => setLogo(e.target.files?.[0] ?? null)} className={`text-base ${focusRing}`} />
        </div>
        <p className="text-sm text-muted-foreground">A wide banner (PNG/WebP/JPEG, up to 10 MB). Shown on /sets and in the set pickers.</p>
      </section>

      <details>
        <summary className={`cursor-pointer text-base ${focusRing} rounded`}>Advanced</summary>
        <div className="mt-3 max-w-xs space-y-1">
          <Label htmlFor="sf-legal">Constructed-legal from</Label>
          <Input id="sf-legal" type="date" value={legalFrom} onChange={(e) => setLegalFrom(e.target.value)} />
          <p className="text-sm text-muted-foreground">Only if cards become legal before release (prerelease week). Empty = the release date.</p>
          {fieldError('legalFrom')}
        </div>
      </details>

      {formError && <p className="text-base text-red-700 dark:text-red-400" role="alert">{formError}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={saving} className={`text-base ${focusRing}`}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editing ? 'Save changes' : `Register ${code || 'set'}`}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className={`text-base ${focusRing}`}>Cancel</Button>
      </div>
    </form>
  );
}
