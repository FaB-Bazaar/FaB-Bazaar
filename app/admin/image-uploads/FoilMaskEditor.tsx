'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, X, Lock, LockOpen, Plus, AlertTriangle } from 'lucide-react';
import FoilCardImage from '@/components/shared/FoilCardImage';
import {
  DEFAULT_MASK,
  maskClipPath,
  printingImageSrc,
  type FoilMaskPreview,
  type FoilMaskTemplate,
  type FoilMaskValues,
  type PrintingRow,
} from './types';

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
        aria-label={label}
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

/** A card thumbnail with the candidate mask drawn over it. */
function MaskedThumb({
  row,
  mask,
  active,
  onClick,
}: {
  row: PrintingRow;
  mask: FoilMaskValues;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Preview ${row.name}`}
      aria-pressed={active}
      className={`relative shrink-0 w-16 rounded overflow-hidden aspect-[5/7] bg-muted transition
        ${active ? 'ring-2 ring-yellow-500' : 'ring-1 ring-border hover:ring-muted-foreground/50'}
        ${row.foilInsetLocked ? 'opacity-50' : ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={printingImageSrc(row)} alt="" className="w-full h-full object-cover" />
      <span
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'rgba(255, 200, 0, 0.3)',
          clipPath: maskClipPath(mask),
          boxShadow: 'inset 0 0 0 1px rgba(255, 200, 0, 0.9)',
        }}
      />
      {row.foilInsetLocked && (
        <span className="absolute top-0.5 right-0.5 rounded bg-emerald-700 p-0.5">
          <Lock className="h-2.5 w-2.5 text-white" />
        </span>
      )}
    </button>
  );
}

interface PendingSweep {
  label: string;
  criteria: Record<string, unknown>;
  preview: FoilMaskPreview;
}

export function FoilMaskEditor({
  rows,
  templates,
  onClose,
  onSaved,
  onTemplatesChanged,
}: {
  rows: PrintingRow[];
  templates: FoilMaskTemplate[];
  onClose: () => void;
  onSaved: (printingIds: string[], values: FoilMaskValues & { locked: boolean }) => void;
  onTemplatesChanged?: () => void;
}) {
  const { toast } = useToast();
  const primary = rows[0];
  const isBulk = rows.length > 1;

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [locked, setLocked] = useState(primary.foilInsetLocked);
  const [pendingSweep, setPendingSweep] = useState<PendingSweep | null>(null);
  const [newTemplateName, setNewTemplateName] = useState<string | null>(null);

  const [mask, setMask] = useState<FoilMaskValues>(() => ({
    top:    primary.foilInsetTop    ?? DEFAULT_MASK.top,
    right:  primary.foilInsetRight  ?? DEFAULT_MASK.right,
    bottom: primary.foilInsetBottom ?? DEFAULT_MASK.bottom,
    left:   primary.foilInsetLeft   ?? DEFAULT_MASK.left,
    round:  primary.foilInsetRound  ?? DEFAULT_MASK.round,
  }));

  const focused = rows[Math.min(focusIdx, rows.length - 1)];
  const clipPath = maskClipPath(mask);
  const hasDbValues = primary.foilInsetBottom != null;
  const lockedCount = useMemo(() => rows.filter(r => r.foilInsetLocked).length, [rows]);

  // Human-readable description of what a criteria sweep would match.
  const bulkLabel = useMemo(() => {
    const setUpper = primary.set.toUpperCase();
    const foilName =
      primary.foiling === 'r' ? 'Rainbow Foil' : primary.foiling === 'c' ? 'Cold Foil' : primary.foiling.toUpperCase();
    const variants = [
      primary.isExtendedArt && 'EA',
      ...(primary.artVariations?.filter(v => v !== 'EA') ?? []),
    ].filter(Boolean).join(' + ');
    return `${setUpper} · ${foilName}${variants ? ` · ${variants}` : ''}`;
  }, [primary]);

  function bustBrowseCache() {
    fetch('/api/admin/bust-browse-cache', { method: 'POST' }).catch(() => null);
  }

  // ------------------------------------------------------------- single save

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/foil-mask/${encodeURIComponent(primary.printingId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...mask, locked }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Save failed');
      toast({ title: 'Saved', description: `Foil mask updated for ${primary.name}${locked ? ' · locked' : ''}` });
      bustBrowseCache();
      onSaved([primary.printingId], { ...mask, locked });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------------------------------- selection apply

  async function handleApplyToSelection() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/foil-mask/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printingIds: rows.map(r => r.printingId),
          description: `${rows.length} hand-picked printings`,
          ...mask,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Apply failed');

      const skipped = json.data?.skippedLocked ?? 0;
      toast({
        title: 'Applied',
        description: `Updated ${json.data?.updated ?? 0} printings${skipped ? ` · ${skipped} locked and skipped` : ''}`,
      });
      bustBrowseCache();
      onSaved(rows.filter(r => !r.foilInsetLocked).map(r => r.printingId), { ...mask, locked: false });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Apply failed', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------ criteria sweep (2-phase)

  /** Phase 1: ask the server what would change. Never writes. */
  async function requestSweep(label: string, criteria: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/foil-mask/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...criteria, dryRun: true, ...mask }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Preview failed');
      setPendingSweep({ label, criteria, preview: json.data });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Preview failed', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  /** Phase 2: the operator has seen the count and said yes. */
  async function confirmSweep() {
    if (!pendingSweep) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/foil-mask/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pendingSweep.criteria, description: pendingSweep.label, ...mask }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Apply failed');
      toast({ title: 'Applied', description: `Updated ${json.updated ?? json.data?.updated ?? 0} printings — undoable from the toolbar` });
      bustBrowseCache();
      setPendingSweep(null);
      onTemplatesChanged?.();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Apply failed', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------- templates

  async function saveAsTemplate() {
    const name = (newTemplateName ?? '').trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/foil-mask/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...mask }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Could not save template');
      toast({ title: 'Template saved', description: name });
      setNewTemplateName(null);
      onTemplatesChanged?.();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Could not save template', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const disabled = saving || busy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 bg-background border rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-6">
        <div className="flex gap-6">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Template rail */}
        {templates.length > 0 && (
          <div className="w-48 shrink-0 space-y-2">
            <p className="text-xs font-semibold">Templates</p>
            <div className="space-y-1">
              {templates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMask({ top: t.top, right: t.right, bottom: t.bottom, left: t.left, round: t.round })}
                  title={t.notes ?? undefined}
                  className="w-full text-left px-2 py-1.5 rounded border border-border hover:border-yellow-500/60 hover:bg-yellow-500/5 transition"
                >
                  <span className="block text-[11px] font-medium leading-tight">{t.name}</span>
                  <span className="block text-[10px] text-muted-foreground font-mono">
                    {t.top}/{t.right}/{t.bottom}/{t.left}
                  </span>
                </button>
              ))}
            </div>

            {newTemplateName === null ? (
              <Button size="sm" variant="ghost" className="w-full h-7 text-[11px]" onClick={() => setNewTemplateName('')}>
                <Plus className="h-3 w-3 mr-1" /> Save current as…
              </Button>
            ) : (
              <div className="space-y-1">
                <Input
                  autoFocus
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveAsTemplate()}
                  placeholder="Template name"
                  className="h-7 text-xs"
                />
                <div className="flex gap-1">
                  <Button size="sm" className="h-6 text-[10px] flex-1" onClick={saveAsTemplate} disabled={disabled}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setNewTemplateName(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        <div className="shrink-0 w-80">
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            Foil area preview <span className="text-[10px] opacity-60">(hover to preview shimmer)</span>
          </p>
          <div className="relative rounded overflow-hidden aspect-[5/7] bg-muted">
            <FoilCardImage
              foiling={focused.foiling}
              foilInset={mask}
              src={printingImageSrc(focused)}
              alt={focused.name}
              className="w-full h-full"
              imgClassName="w-full h-full object-cover"
            />
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
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <p className="text-sm font-semibold">
              {isBulk ? `${rows.length} printings selected` : primary.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {isBulk ? `Editing one mask for all of them · previewing ${focused.name}` : 'Rainbow Foil mask editor'}
            </p>
          </div>

          {!isBulk && !hasDbValues && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-blue-500/10 border border-blue-500/30 text-xs text-blue-400">
              <span className="shrink-0 mt-0.5">ℹ</span>
              <span>No mask saved for this printing — showing defaults. Hit <strong>Save mask</strong> to lock these values in.</span>
            </div>
          )}

          {isBulk && lockedCount > 0 && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500">
              <Lock className="h-3 w-3 shrink-0 mt-0.5" />
              <span>{lockedCount} locked card{lockedCount === 1 ? '' : 's'} will be skipped.</span>
            </div>
          )}

          <div className="space-y-3">
            <SliderRow label="Top inset" value={mask.top} onValueChange={v => setMask(prev => ({ ...prev, top: v }))} />
            <SliderRow label="Right inset" value={mask.right} onValueChange={v => setMask(prev => ({ ...prev, right: v }))} />
            <SliderRow label="Bottom inset" value={mask.bottom} onValueChange={v => setMask(prev => ({ ...prev, bottom: v }))} />
            <SliderRow label="Left inset" value={mask.left} onValueChange={v => setMask(prev => ({ ...prev, left: v }))} />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-muted-foreground" htmlFor="foil-mask-round">Corner round</label>
            <Input
              id="foil-mask-round"
              value={mask.round}
              onChange={e => setMask(prev => ({ ...prev, round: e.target.value }))}
              placeholder="e.g. 1.5%, 8px, 0%"
              className="font-mono text-sm h-8"
            />
            <p className="text-[10px] text-muted-foreground">CSS length used as the round argument of inset()</p>
          </div>

          {isBulk ? (
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleApplyToSelection} disabled={disabled} className="flex-1">
                {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
                Apply to {rows.length} selected
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMask(DEFAULT_MASK)} disabled={disabled}>
                Reset
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSave} disabled={disabled} className="flex-1">
                  {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                  Save mask
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMask(DEFAULT_MASK)} disabled={disabled}>
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant={locked ? 'default' : 'outline'}
                  className={locked ? 'bg-emerald-700 hover:bg-emerald-600 border-emerald-600' : 'border-muted-foreground/30'}
                  onClick={() => setLocked(l => !l)}
                  disabled={disabled}
                  aria-label={locked ? 'Unlock this card' : 'Lock this card'}
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
                  disabled={disabled}
                  onClick={() => requestSweep(`${bulkLabel} (unset only)`, {
                    set: primary.set,
                    foiling: primary.foiling,
                    isExtendedArt: primary.isExtendedArt,
                    artVariations: primary.artVariations ?? [],
                  })}
                >
                  {busy ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
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
                  disabled={disabled}
                  onClick={() => requestSweep('All sets · no art variations (unset only)', {
                    foiling: primary.foiling,
                    isExtendedArt: false,
                    artVariations: [],
                  })}
                >
                  {busy ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
                  Apply globally (no art variation, unset only)
                </Button>
              </div>
            </>
          )}
        </div>
        </div>

        {/* Filmstrip — one mask has to look right on every card it lands on,
            so it gets the full width rather than the preview column's 320px. */}
        {isBulk && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[10px] text-muted-foreground mb-1.5">
              {rows.length} selected — click any card to inspect it above
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {rows.map((r, i) => (
                <MaskedThumb
                  key={r.printingId}
                  row={r}
                  mask={mask}
                  active={i === Math.min(focusIdx, rows.length - 1)}
                  onClick={() => setFocusIdx(i)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {pendingSweep && (
        <SweepConfirmDialog
          sweep={pendingSweep}
          mask={mask}
          busy={busy}
          onCancel={() => setPendingSweep(null)}
          onConfirm={confirmSweep}
        />
      )}
    </div>
  );
}

function SweepConfirmDialog({
  sweep,
  mask,
  busy,
  onCancel,
  onConfirm,
}: {
  sweep: PendingSweep;
  mask: FoilMaskValues;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { preview } = sweep;
  const count = preview.wouldUpdate.toLocaleString();
  const nothingToDo = preview.wouldUpdate === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onCancel} />
      <div className="relative z-10 bg-background border rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Confirm bulk apply</p>
            <p className="text-xs text-muted-foreground">{sweep.label}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-4 text-center">
          <p className="text-3xl font-bold tabular-nums">{count}</p>
          <p className="text-xs text-muted-foreground mt-1">
            printing{preview.wouldUpdate === 1 ? '' : 's'} across {preview.setCount} set{preview.setCount === 1 ? '' : 's'} will get this mask
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Skipped: <span className="font-medium text-foreground">{preview.skippedLocked.toLocaleString()}</span> locked ·{' '}
          <span className="font-medium text-foreground">{preview.skippedAlreadySet.toLocaleString()}</span> already masked.
          {' '}This apply is recorded and can be undone from the toolbar.
        </p>

        {preview.sample.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Sample of what will change:</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {preview.sample.map(s => (
                <div key={s.printingId} className="relative shrink-0 w-14 rounded overflow-hidden aspect-[5/7] bg-muted" title={`${s.name} · ${s.set.toUpperCase()}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={printingImageSrc(s)} alt="" className="w-full h-full object-cover" />
                  <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'rgba(255, 200, 0, 0.3)',
                      clipPath: maskClipPath(mask),
                      boxShadow: 'inset 0 0 0 1px rgba(255, 200, 0, 0.9)',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1" onClick={onConfirm} disabled={busy || nothingToDo}>
            {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
            {nothingToDo ? 'Nothing to apply' : `Apply to ${count} printings`}
          </Button>
        </div>
      </div>
    </div>
  );
}
