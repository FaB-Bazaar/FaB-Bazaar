'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Check, ChevronRight, Loader2, PartyPopper, Square } from 'lucide-react';
import type { CardVaultJob, CardVaultJobAction, ProbeProblem } from '@/lib/import/cardvault-job';
import type { IngestSetSummary } from '@/lib/services/postgres/cardvault/PostgresCardVaultService';

type JobSummary = Omit<CardVaultJob, 'log'>;
type StepState = 'todo' | 'next' | 'running' | 'done' | 'attention' | 'locked';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';
const n = (x: number) => x.toLocaleString();
const plural = (x: number, one: string, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`;

function timeAgo(iso?: string) {
  if (!iso) return '';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Latest job of these actions for a set. Jobs arrive newest first. */
const latest = (jobs: JobSummary[], set: string, actions: CardVaultJobAction[]) =>
  jobs.find((j) => j.set === set && actions.includes(j.action)) ?? null;

export function CardVaultClient() {
  const { toast } = useToast();
  const [sets, setSets] = useState<IngestSetSummary[]>([]);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [cloudflareConfigured, setCloudflareConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [setCode, setSetCode] = useState('');
  const [maxRequests, setMaxRequests] = useState('300');
  const [skipCollectors, setSkipCollectors] = useState('');
  const [live, setLive] = useState<CardVaultJob | null>(null); // the running job, polled
  const [starting, setStarting] = useState(false);
  const [confirmAdd, setConfirmAdd] = useState(false);
  const [, tick] = useState(0); // re-render "x min ago"

  const loadOverview = useCallback(async () => {
    const res = await fetch('/api/admin/cardvault');
    const json = await res.json();
    if (!res.ok) {
      toast({ title: 'Could not load sets', description: json.error, variant: 'destructive' });
      return null;
    }
    setSets(json.data.sets);
    setJobs(json.data.jobs);
    setCloudflareConfigured(json.data.cloudflareConfigured);
    return json.data as { sets: IngestSetSummary[]; jobs: JobSummary[] };
  }, [toast]);

  useEffect(() => {
    (async () => {
      const data = await loadOverview();
      setLoading(false);
      const recent = data?.jobs[0];
      if (recent) setSetCode(recent.set);
      const running = data?.jobs.find((j) => j.status === 'running');
      if (running) setLive({ ...running, log: [] });
    })();
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, [loadOverview]);

  // Poll the running job; when it ends, refresh the set counts + history.
  useEffect(() => {
    if (!live || live.status !== 'running') return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/cardvault/jobs/${live.id}`);
      if (!res.ok) { setLive(null); loadOverview(); return; }
      const job: CardVaultJob = (await res.json()).data;
      setLive(job);
      if (job.status !== 'running') {
        await loadOverview();
        setLive(null);
        if (job.status === 'failed') toast({ title: 'Step failed', description: job.error, variant: 'destructive' });
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [live, loadOverview, toast]);

  const start = async (action: CardVaultJobAction) => {
    if (!setCode) return;
    setStarting(true);
    try {
      const res = await fetch('/api/admin/cardvault/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          set: setCode, action,
          maxRequests: parseInt(maxRequests, 10),
          skipCollectors: skipCollectors.split(/[\s,]+/).filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: 'Could not start', description: json.error, variant: 'destructive' });
        return;
      }
      setLive({ ...json.data, log: json.data.log ?? [] });
      loadOverview();
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    if (live) await fetch(`/api/admin/cardvault/jobs/${live.id}/cancel`, { method: 'POST' });
  };

  const set = useMemo(() => sets.find((s) => s.code === setCode) ?? null, [sets, setCode]);
  const busy = Boolean(live) || starting;
  const runningHere = live && live.set === setCode ? live : null;

  // ── derive each step's state for the selected set ───────────────────────
  const check = setCode ? latest(jobs, setCode, ['preview', 'ingest']) : null;
  const checkDone = check?.status === 'done' ? check : null;
  const plan = checkDone?.result?.plan;
  const added = checkDone?.action === 'ingest' ? checkDone.result?.commit : undefined;
  const imagesJob = setCode ? latest(jobs, setCode, ['images']) : null;
  const probeJob = setCode ? latest(jobs, setCode, ['probe']) : null;
  const probe = probeJob?.status === 'done' ? probeJob.result?.probe : undefined;
  // An image check is stale once something changed after it (an add or an upload).
  const probeFresh = Boolean(probe)
    && (!imagesJob || imagesJob.startedAt < probeJob!.startedAt)
    && (!checkDone || checkDone.action !== 'ingest' || checkDone.startedAt < probeJob!.startedAt);

  const newToAdd = plan && !added ? plan.newPrintings.length : 0;
  const imagesPending = set?.imagesNotOnCloudflare ?? 0;

  const nextStep: 1 | 2 | 3 | 4 | null =
    !checkDone ? 1
      : newToAdd > 0 ? 2
        : imagesPending > 0 && cloudflareConfigured ? 3
          : !probeFresh ? 4
            : null;

  const stateOf = (step: 1 | 2 | 3 | 4, actions: CardVaultJobAction[], done: boolean, attention = false): StepState => {
    if (runningHere && actions.includes(runningHere.action)) return 'running';
    if (attention) return 'attention';
    if (nextStep === step) return 'next';
    return done ? 'done' : 'todo';
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading sets…</div>;
  }

  return (
    <div className="space-y-6">
      {/* ── which set ──────────────────────────────────────────────────── */}
      <section className="rounded-lg border p-4 md:p-6 space-y-3">
        <Label htmlFor="cv-set" className="text-base">Set</Label>
        <select
          id="cv-set"
          value={setCode}
          onChange={(e) => setSetCode(e.target.value)}
          disabled={busy}
          className={`w-full rounded-md border bg-background px-3 py-2 text-base ${focusRing}`}
        >
          <option value="">Choose a set…</option>
          {sets.map((s) => (
            <option key={s.code} value={s.code}>
              {s.displayCode} — {s.name}{s.releaseDate ? ` (${s.releaseDate})` : ' (unannounced)'}
            </option>
          ))}
        </select>
        {set && (
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-base" aria-label="Set summary">
            <li><strong>{n(set.collectorNumbers)}</strong> cards on the site</li>
            <li><strong>{n(set.enPrintings)}</strong> English printings</li>
            <li>
              {imagesPending > 0
                ? <span className="text-yellow-700 dark:text-yellow-400"><AlertTriangle className="inline h-4 w-4 mr-1 -mt-0.5" />{plural(imagesPending, 'image')} still loaded from CardVault</span>
                : <span><Check className="inline h-4 w-4 mr-1 -mt-0.5" />All images on Cloudflare</span>}
            </li>
          </ul>
        )}
        {busy && <p className="text-sm text-muted-foreground">You can switch sets once the current step finishes.</p>}
      </section>

      {set && nextStep === null && !runningHere && (
        <div className="flex items-center gap-3 rounded-lg border border-green-700 p-4 text-base">
          <PartyPopper className="h-5 w-5 shrink-0" />
          <span><strong>{set.displayCode} is up to date.</strong> Nothing new on CardVault, and every image is on Cloudflare and loads.</span>
        </div>
      )}

      {/* ── the four steps ─────────────────────────────────────────────── */}
      {set && (
        <ol className="space-y-3">
          <Step
            n={1} title="Check CardVault for new cards"
            state={stateOf(1, ['preview'], !!checkDone)}
            live={runningHere?.action === 'preview' ? runningHere : null} onStop={stop}
            status={
              check && check.status !== 'done' && check.status !== 'running' && check.action === 'preview' ? <Failed job={check} />
                : added ? <>Up to date — checked {timeAgo(checkDone!.finishedAt)}.</>
                  : plan ? (
                    plan.newPrintings.length
                      ? <><strong>Found {plural(plan.newPrintings.length, 'new printing')}</strong>{plan.newCards.length ? ` (${plural(plan.newCards.length, 'new card')})` : ''} — checked {timeAgo(checkDone!.finishedAt)}.</>
                      : <>Nothing new — the site already has everything CardVault lists. Checked {timeAgo(checkDone!.finishedAt)}.</>
                  ) : <>Looks the set up on CardVault and compares it with the site. Changes nothing.</>
            }
            action={{ label: checkDone ? 'Check again' : 'Check CardVault', onClick: () => start('preview'), disabled: busy }}
          >
            {plan && !added && <PlanDetails job={checkDone!} />}
          </Step>

          <Step
            n={2} title="Add them to the site"
            state={!checkDone ? 'locked' : stateOf(2, ['ingest'], !!added || newToAdd === 0)}
            live={runningHere?.action === 'ingest' ? runningHere : null} onStop={stop}
            status={
              check && check.status !== 'done' && check.status !== 'running' && check.action === 'ingest' ? <Failed job={check} />
                : !checkDone ? <>Check CardVault first.</>
                  : added ? <><strong>Added {plural(added.printingsCreated, 'printing')}</strong>{added.cardsCreated ? ` and ${plural(added.cardsCreated, 'new card')}` : ''} {timeAgo(checkDone.finishedAt)}.</>
                    : newToAdd > 0 ? <>Ready to add <strong>{plural(newToAdd, 'printing')}</strong>. Saves everything in one go and never deletes anything.</>
                      : <>Nothing to add.</>
            }
            action={newToAdd > 0 ? { label: `Add ${plural(newToAdd, 'printing')}`, onClick: () => setConfirmAdd(true), disabled: busy } : undefined}
          />

          <Step
            n={3} title="Put the card images on Cloudflare"
            state={!cloudflareConfigured ? 'attention' : stateOf(3, ['images'], imagesPending === 0)}
            live={runningHere?.action === 'images' ? runningHere : null} onStop={stop}
            status={
              !cloudflareConfigured ? <>Cloudflare isn&apos;t configured on this server, so images can&apos;t be uploaded here.</>
                : imagesJob && imagesJob.status !== 'done' && imagesJob.status !== 'running' ? <Failed job={imagesJob} />
                  : imagesPending > 0 ? (
                    <>
                      {plural(imagesPending, 'image')} still {imagesPending === 1 ? 'loads' : 'load'} from CardVault.
                      {imagesJob?.result?.images?.failed ? ` Last run: ${n(imagesJob.result.images.failed)} failed — trying again usually fixes it.` : ''}
                    </>
                  ) : <>All images are on Cloudflare{imagesJob?.result?.images ? ` (${n(imagesJob.result.images.uploaded)} uploaded ${timeAgo(imagesJob.finishedAt)})` : ''}.</>
            }
            action={imagesPending > 0 && cloudflareConfigured
              ? { label: `Upload ${plural(imagesPending, 'image')}`, onClick: () => start('images'), disabled: busy }
              : undefined}
          >
            {set.imagesMissing > 0 && (
              <p className="text-sm text-muted-foreground">
                {plural(set.imagesMissing, 'printing')} {set.imagesMissing === 1 ? 'has' : 'have'} no image anywhere yet — normal for tokens during
                spoiler season. The nightly update adds the art once it is published.
              </p>
            )}
          </Step>

          <Step
            n={4} title="Make sure every image loads"
            state={stateOf(4, ['probe'], probeFresh && probe!.problems.length === 0, probeFresh && probe!.problems.length > 0)}
            live={runningHere?.action === 'probe' ? runningHere : null} onStop={stop}
            status={
              probeJob && probeJob.status !== 'done' && probeJob.status !== 'running' ? <Failed job={probeJob} />
                : probe ? (
                  probe.problems.length === 0
                    ? <>All {n(probe.probed)} images load — checked {timeAgo(probeJob!.finishedAt)}.</>
                    : <><strong>{plural(probe.problems.length, 'printing')} need{probe.problems.length === 1 ? 's' : ''} attention</strong> — checked {timeAgo(probeJob!.finishedAt)}{probeFresh ? '' : ', before the latest changes'}.</>
                ) : <>Opens every image in the set and lists any that don&apos;t load.</>
            }
            action={{ label: probe ? 'Check again' : 'Check all images', onClick: () => start('probe'), disabled: busy }}
          >
            {probe && probe.problems.length > 0 && <ProbeGroups problems={probe.problems} />}
          </Step>
        </ol>
      )}

      {set && (
        <details className="rounded-lg border p-4">
          <summary className={`cursor-pointer text-base ${focusRing} rounded`}>Advanced options</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2 text-sm">
            <div className="space-y-1">
              <Label htmlFor="cv-max">Max CardVault requests</Label>
              <Input id="cv-max" type="number" min={1} max={1000} value={maxRequests}
                onChange={(e) => setMaxRequests(e.target.value)} disabled={busy} />
              <p className="text-muted-foreground">
                A set&apos;s first check asks CardVault about each card (≈160 requests, ~6 minutes — CardVault wants a
                pause between requests). Later checks reuse saved answers and take seconds.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cv-skip">Skip collector numbers</Label>
              <Input id="cv-skip" placeholder="e.g. FAB400, FAB425" value={skipCollectors}
                onChange={(e) => setSkipCollectors(e.target.value)} disabled={busy} />
              <p className="text-muted-foreground">
                Only for promos CardVault lists without a foil type when the site already has them as foil — adding them
                would create a fake non-foil printing.
              </p>
            </div>
          </div>
        </details>
      )}

      {jobs.length > 0 && (
        <details className="rounded-lg border p-4">
          <summary className={`cursor-pointer text-base ${focusRing} rounded`}>Run history ({jobs.length})</summary>
          <p className="mt-2 text-sm text-muted-foreground">Kept until the next deploy or restart.</p>
          <ul className="mt-2 divide-y">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-medium">{j.set.toUpperCase()}</span>
                <span>{({ preview: 'Checked CardVault', ingest: 'Added to site', images: 'Uploaded images', probe: 'Checked images' } as const)[j.action]}</span>
                <span className={j.status === 'failed' ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}>
                  {j.status === 'done' ? '✓ done' : j.status === 'running' ? 'running…' : j.status}
                </span>
                <span className="text-muted-foreground">{new Date(j.startedAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <AlertDialog open={confirmAdd} onOpenChange={setConfirmAdd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add {plural(newToAdd, 'printing')} to {set?.displayCode}?</AlertDialogTitle>
            <AlertDialogDescription>
              CardVault is checked once more right before saving, so anything it added in the meantime comes along.
              Everything saves together, and nothing already on the site is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => start('ingest')}>Add printings</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── pieces ────────────────────────────────────────────────────────────────

function StepIcon({ n: num, state }: { n: number; state: StepState }) {
  const base = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-base font-bold';
  if (state === 'done') return <span className={`${base} border-green-700 bg-green-700 text-white`} aria-label="Done"><Check className="h-5 w-5" /></span>;
  if (state === 'running') return <span className={`${base} border-blue-500`} aria-label="Running"><Loader2 className="h-5 w-5 animate-spin" /></span>;
  if (state === 'attention') return <span className={`${base} border-yellow-600 text-yellow-700 dark:text-yellow-400`} aria-label="Needs attention"><AlertTriangle className="h-5 w-5" /></span>;
  if (state === 'next') return <span className={`${base} border-blue-500 bg-blue-600 text-white`} aria-label="Next step">{num}</span>;
  return <span className={`${base} border-dashed text-muted-foreground`}>{num}</span>;
}

function Step({ n: num, title, state, status, action, live, onStop, children }: {
  n: number; title: string; state: StepState; status: React.ReactNode;
  action?: { label: string; onClick: () => void; disabled: boolean };
  live: CardVaultJob | null; onStop: () => void; children?: React.ReactNode;
}) {
  const emphasis = state === 'next' || state === 'running' ? 'border-2 border-blue-500' : 'border';
  return (
    <li className={`rounded-lg ${emphasis} p-4 md:p-5 ${state === 'locked' ? 'text-muted-foreground' : ''}`} data-step={num} data-state={state}>
      <div className="flex gap-4">
        <StepIcon n={num} state={state} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold leading-tight">
                {title}
                {state === 'next' && <span className="ml-2 align-middle text-sm font-medium text-blue-700 dark:text-blue-300">← next</span>}
              </h3>
              <p className="text-base">{status}</p>
            </div>
            {live ? (
              <Button variant="outline" onClick={onStop} className={`text-base ${focusRing}`}>
                <Square className="mr-2 h-4 w-4" />Stop
              </Button>
            ) : action && (
              <Button
                onClick={action.onClick}
                disabled={action.disabled}
                variant={state === 'next' ? 'default' : 'outline'}
                className={`text-base ${focusRing}`}
              >
                {action.label}<ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
          {live && <LiveProgress job={live} />}
          {children}
        </div>
      </div>
    </li>
  );
}

function LiveProgress({ job }: { job: CardVaultJob }) {
  const p = job.progress;
  return (
    <div className="space-y-1" aria-live="polite">
      <Progress value={p && p.total > 0 ? (p.done / p.total) * 100 : 3} aria-label={p ? `${p.done} of ${p.total} ${p.label}` : 'Starting'} />
      <p className="text-sm text-muted-foreground">
        {p ? `${n(p.done)} of ${n(p.total)} ${p.label}` : 'Starting…'}
        {(job.action === 'preview' || job.action === 'ingest') && p && p.done < p.total
          ? ' — CardVault asks for a short pause between requests, so a first check takes a few minutes.' : ''}
      </p>
    </div>
  );
}

function Failed({ job }: { job: JobSummary }) {
  return (
    <span className="text-red-700 dark:text-red-400">
      <AlertTriangle className="inline h-4 w-4 mr-1 -mt-0.5" />
      {job.status === 'cancelled' ? 'Stopped before finishing.' : `Didn't finish: ${job.error}.`} Safe to run again.
    </span>
  );
}

function PlanDetails({ job }: { job: JobSummary }) {
  const plan = job.result!.plan!;
  const FOILING: Record<string, string> = { s: 'Non-foil', r: 'Rainbow Foil', c: 'Cold Foil', g: 'Gold Foil' };
  return (
    <div className="space-y-2">
      {plan.retroLinks > 0 && (
        <p className="text-base text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="inline h-4 w-4 mr-1 -mt-0.5" />
          This would attach {plural(plan.retroLinks, 'card back')} to cards already on the site. That&apos;s unusual — worth a
          look before adding.
        </p>
      )}
      {plan.warnings.map((w) => (
        <p key={w} className="text-sm text-yellow-700 dark:text-yellow-400"><AlertTriangle className="inline h-4 w-4 mr-1 -mt-0.5" />{w}</p>
      ))}
      {plan.newPrintings.length > 0 && (
        <details>
          <summary className={`cursor-pointer text-base ${focusRing} rounded`}>See what&apos;s new</summary>
          {plan.newCards.length > 0 && <p className="mt-2 text-sm"><strong>New cards:</strong> {plan.newCards.join(', ')}</p>}
          <div className="mt-2 max-h-80 overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-left"><th className="p-2">Printing</th><th className="p-2">Card</th><th className="p-2">Finish</th></tr>
              </thead>
              <tbody>
                {plan.newPrintings.map((p, i) => (
                  <tr key={`${p.code}-${i}`} className="border-t">
                    <td className="p-2">{p.code ?? p.collector}</td>
                    <td className="p-2">{p.name ?? '—'}{p.back ? ' (back)' : ''}</td>
                    <td className="p-2">{FOILING[p.foiling] ?? p.foiling}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <details>
        <summary className={`cursor-pointer text-sm ${focusRing} rounded`}>Technical details</summary>
        <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-0.5">
          <li>{n(plan.counts.skippedLss + plan.counts.skippedNaturalKey)} printings already on the site were skipped.</li>
          {plan.enrichCount > 0 && <li>Adding also refreshes the text of {plural(plan.enrichCount, 'spoiler card')} from CardVault.</li>}
          {plan.counts.skippedFlag > 0 && <li>{n(plan.counts.skippedFlag)} skipped by the collector-number list in Advanced options.</li>}
          {job.result?.requestsUsed !== undefined && <li>{plural(job.result.requestsUsed, 'CardVault request')} used.</li>}
        </ul>
        <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap">{plan.summary}{'\n\n'}{plan.log.join('\n')}</pre>
      </details>
    </div>
  );
}

function ProbeGroups({ problems }: { problems: ProbeProblem[] }) {
  const groups = [
    { key: 'cardvault', label: 'still load from CardVault', fix: 'Fix: step 3, upload the images.', rows: problems.filter((p) => p.status === 'not on Cloudflare') },
    { key: 'missing', label: 'have no image yet', fix: 'Normal for tokens during spoiler season — the nightly update adds the art once it is published.', rows: problems.filter((p) => p.status === 'no image_url') },
    { key: 'broken', label: "don't load", fix: "Broken links. Uploading again sometimes fixes it; otherwise the art isn't published yet.", rows: problems.filter((p) => p.status !== 'not on Cloudflare' && p.status !== 'no image_url') },
  ].filter((g) => g.rows.length);
  return (
    <ul className="space-y-2">
      {groups.map((g) => (
        <li key={g.key}>
          <details>
            <summary className={`cursor-pointer text-base ${focusRing} rounded`}>
              <strong>{n(g.rows.length)}</strong> {g.label}
            </summary>
            <p className="mt-1 text-sm text-muted-foreground">{g.fix}</p>
            <p className="mt-1 text-sm leading-relaxed">
              {g.rows.map((p, i) => (
                <span key={p.printingId}>
                  {i > 0 && ', '}
                  {p.url
                    ? <a href={p.url} target="_blank" rel="noreferrer" className={`underline ${focusRing}`}>{p.collectorNumber}{p.back ? ' (back)' : ''}</a>
                    : <>{p.collectorNumber}{p.back ? ' (back)' : ''}</>}
                  {g.key === 'broken' ? ` [${p.status}]` : ''}
                </span>
              ))}
            </p>
          </details>
        </li>
      ))}
    </ul>
  );
}
