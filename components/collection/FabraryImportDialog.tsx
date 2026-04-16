'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Upload, FileText, CheckCircle, AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseFabraryCsv } from '@/lib/utils/fabrary-csv';
import { fabraryClient } from '@/lib/client';
import type { FabraryResolveResult, FabraryImportResult } from '@/lib/client/fabrary-client';

interface FabraryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (binderId: string) => void;
}

type Step = 1 | 2 | 3;

export default function FabraryImportDialog({ open, onOpenChange, onImportComplete }: FabraryImportDialogProps) {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRowCount, setParsedRowCount] = useState<number>(0);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<FabraryResolveResult | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<FabraryImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(1);
    setFile(null);
    setParseError(null);
    setParsedRowCount(0);
    setResolving(false);
    setResolved(null);
    setResolveError(null);
    setImporting(false);
    setResult(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setParseError(null);
    setParsedRowCount(0);
    setFile(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, errors } = parseFabraryCsv(text);

      if (errors.length > 0 && rows.length === 0) {
        setParseError(errors[0]);
        return;
      }

      setFile(selected);
      setParsedRowCount(rows.length);
    };
    reader.readAsText(selected);
  };

  const handleResolve = async () => {
    if (!file) return;
    setResolving(true);
    setResolveError(null);

    const res = await fabraryClient.resolveFabraryCollection(file);
    setResolving(false);

    if (!res.success) {
      setResolveError(res.error || 'Failed to resolve cards.');
      return;
    }

    setResolved(res.data);
    setStep(2);
  };

  const handleImport = async () => {
    if (!resolved) return;
    setImporting(true);
    setImportError(null);

    const res = await fabraryClient.importFabraryCollection(
      resolved.inventory,
      resolved.wants,
      resolved.unresolved
    );
    setImporting(false);

    if (!res.success) {
      setImportError(res.error || 'Import failed.');
      return;
    }

    setResult(res.data);
    setStep(3);
  };

  const handleDone = () => {
    if (result) onImportComplete(result.binderId);
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Fabrary</DialogTitle>
          <DialogDescription>
            {step === 1 && 'Upload your Fabrary collection export CSV.'}
            {step === 2 && 'Review resolved cards before importing.'}
            {step === 3 && 'Import complete.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {(['Upload', 'Preview', 'Done'] as const).map((label, i) => (
            <React.Fragment key={label}>
              <span className={step === i + 1 ? 'text-foreground font-medium' : ''}>{label}</span>
              {i < 2 && <ChevronRight className="h-3 w-3" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Upload + Resolve */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              In Fabrary, go to <strong>Collection → Export</strong> and download the CSV. Then upload it here.
            </p>

            <label
              htmlFor="fabrary-csv-input"
              className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary hover:bg-muted/30 transition-colors"
            >
              {file ? (
                <>
                  <FileText className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium text-foreground">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {parsedRowCount.toLocaleString()} rows with quantity data
                  </span>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to choose a CSV file</span>
                </>
              )}
              <input
                id="fabrary-csv-input"
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>

            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {resolveError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{resolveError}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={resolving}>
                Cancel
              </Button>
              <Button disabled={!file || parsedRowCount === 0 || resolving} onClick={handleResolve}>
                {resolving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {resolving ? 'Resolving cards…' : 'Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Preview resolved results */}
        {step === 2 && resolved && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">A new unlisted binder will be created:</p>

              <div className="border-t border-border pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inventory cards</span>
                  <span className="font-medium text-foreground">{resolved.inventory.length.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wants entries</span>
                  <span className="font-medium text-foreground">{resolved.wants.length.toLocaleString()}</span>
                </div>
                {resolved.unresolved.length > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-500">
                    <span>Cards not found</span>
                    <span>{resolved.unresolved.length}</span>
                  </div>
                )}
              </div>
            </div>

            {resolved.unresolved.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Show {resolved.unresolved.length} unresolved cards
                </summary>
                <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto pl-2">
                  {resolved.unresolved.map((r, i) => (
                    <li key={i}>{r.collectorNumber} — {r.name} ({r.reason})</li>
                  ))}
                </ul>
              </details>
            )}

            {importError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={importing}>Back</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {importing ? 'Importing…' : 'Import'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Import complete</span>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inventory added</span>
                <span className="font-medium text-foreground">{result.inventoryAdded.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wants added</span>
                <span className="font-medium text-foreground">{result.wantsAdded.toLocaleString()}</span>
              </div>
              {(result.inventoryFailed > 0 || result.wantsFailed > 0) && (
                <div className="flex justify-between text-amber-600 dark:text-amber-500">
                  <span>Failed to insert</span>
                  <span>{result.inventoryFailed + result.wantsFailed}</span>
                </div>
              )}
              {result.unresolved.length > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-500">
                  <span>Cards not found</span>
                  <span>{result.unresolved.length}</span>
                </div>
              )}
            </div>

            {result.unresolved.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Show {result.unresolved.length} unresolved cards
                </summary>
                <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto pl-2">
                  {result.unresolved.map((r, i) => (
                    <li key={i}>{r.collectorNumber} — {r.name} ({r.reason})</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" asChild>
                <Link href={`/binder/${result.binderId}`}>View Binder</Link>
              </Button>
              <Button onClick={handleDone}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
