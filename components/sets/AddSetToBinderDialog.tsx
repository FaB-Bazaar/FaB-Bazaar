// components/sets/AddSetToBinderDialog.tsx
// "Add this set to a new binder" flow on /sets/[setCode]. Creates a
// "{username} - {SETCODE}" binder with 1 copy of each card in the set,
// filtered by the chosen foilings (s/r/c) and edition. Renders nothing
// when logged out; a 409 from the route becomes the "already exists" prompt.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle, FolderPlus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { bindersClient } from '@/lib/client';
import type { SetBinderResult, ExistingSetBinder } from '@/lib/client/binders-client';
import { hasFirstEdition } from '@/lib/fab-constants';
import { displayUsername } from '@/lib/utils/display-username';

const FOILING_OPTIONS = [
  { code: 's', label: 'Non Foil' },
  { code: 'r', label: 'Rainbow Foil' },
  { code: 'c', label: 'Cold Foil' },
] as const;

interface AddSetToBinderDialogProps {
  setCode: string;
  /** The page's current edition code (a/f/u/n) — the dialog's default. */
  editionCode: string;
  setName: string;
}

export default function AddSetToBinderDialog({
  setCode,
  editionCode,
  setName,
}: AddSetToBinderDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [foilings, setFoilings] = useState<string[]>(['s']);
  const [edition, setEdition] = useState(editionCode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ExistingSetBinder | null>(null);
  const [result, setResult] = useState<SetBinderResult | null>(null);

  if (!user) return null;

  const binderName = `${displayUsername(user.username)} - ${setCode.toUpperCase()}`;
  // WTR's first print run is Alpha; EVR only exists in First Edition.
  const editionChoices =
    hasFirstEdition(setCode) && setCode !== 'evr'
      ? [
          { code: 'u', label: 'Unlimited' },
          setCode === 'wtr'
            ? { code: 'a', label: 'Alpha' }
            : { code: 'f', label: 'First Edition' },
        ]
      : null;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setFoilings(['s']);
      setEdition(editionCode);
      setError(null);
      setConflict(null);
      setResult(null);
    }
  };

  const toggleFoiling = (code: string) => {
    setFoilings(prev =>
      prev.includes(code) ? prev.filter(f => f !== code) : [...prev, code]
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setConflict(null);

    const res = await bindersClient.createSetBinder(setCode, { foilings, edition });
    setSubmitting(false);

    if (res.success) {
      setResult(res.data);
    } else if (res.existing) {
      setConflict(res.existing);
    } else {
      setError(res.error);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => handleOpenChange(true)}>
        <FolderPlus className="w-4 h-4 mr-2" />
        Add Set to Binder
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add {setName} to a new binder</DialogTitle>
            <DialogDescription>
              Creates the binder &ldquo;{binderName}&rdquo; with 1 copy of each card in
              the set for your selected foilings.
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Binder created</span>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cards added</span>
                  <span className="font-medium text-foreground">
                    {result.summary.added.toLocaleString()}
                  </span>
                </div>
                {result.summary.failed > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-500">
                    <span>Failed to add</span>
                    <span>{result.summary.failed}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/binder/${result.binderId}`}>View Binder</Link>
                </Button>
                <Button onClick={() => handleOpenChange(false)}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-base font-medium text-foreground mb-1">Foiling</legend>
                {FOILING_OPTIONS.map(opt => (
                  <div key={opt.code} className="flex items-center gap-2">
                    <Checkbox
                      id={`set-binder-foiling-${opt.code}`}
                      checked={foilings.includes(opt.code)}
                      onCheckedChange={() => toggleFoiling(opt.code)}
                    />
                    <label
                      htmlFor={`set-binder-foiling-${opt.code}`}
                      className="text-base text-foreground cursor-pointer"
                    >
                      {opt.label}
                    </label>
                  </div>
                ))}
              </fieldset>

              {editionChoices && (
                <fieldset className="space-y-2">
                  <legend className="text-base font-medium text-foreground mb-1">Edition</legend>
                  <div className="flex gap-2" role="radiogroup" aria-label="Edition">
                    {editionChoices.map(choice => (
                      <Button
                        key={choice.code}
                        type="button"
                        size="sm"
                        variant={edition === choice.code ? 'default' : 'outline'}
                        aria-pressed={edition === choice.code}
                        onClick={() => setEdition(choice.code)}
                      >
                        {choice.label}
                      </Button>
                    ))}
                  </div>
                </fieldset>
              )}

              {conflict && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You already have a binder for this set:{' '}
                    <Link
                      href={`/binder/${conflict.binderId}`}
                      className="font-medium underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      {conflict.binderName}
                    </Link>
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting || foilings.length === 0}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {submitting ? 'Creating binder…' : 'Create Binder'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
