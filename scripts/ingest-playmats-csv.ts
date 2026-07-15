/**
 * Ingest a community playmat CSV into the collectibles catalog via the
 * admin API (superadmin-gated), so the same script works against local dev
 * AND production.
 *
 * CSV shape (header row required): Art / Name, Release Year, Original Source
 *
 * Behavior:
 *   - Blank names are skipped; exact duplicate (name, year) rows are deduped
 *     (first occurrence wins; a warning is printed if their sources differ).
 *   - Years like "2025?" ingest as 2025 with "(year uncertain)" appended to
 *     the source. Blank years ingest as null.
 *   - Idempotent: entries already in the target catalog (same name + year,
 *     case-insensitive) are skipped, so re-runs only add what's missing.
 *   - DRY-RUN by default — pass --apply to write.
 *
 * Usage:
 *   npx tsx scripts/ingest-playmats-csv.ts <csv-path>            # dry-run
 *   npx tsx scripts/ingest-playmats-csv.ts <csv-path> --apply
 *
 * Env:
 *   COLLECTIBLES_BASE_URL  target app (default http://localhost:3000)
 *   COLLECTIBLES_COOKIE    session cookie header value (local dev)
 *   COLLECTIBLES_BEARER    bearer token (MCP/OAuth superadmin — for prod)
 */

const CSV_PATH = process.argv[2];
const APPLY = process.argv.includes('--apply');
const BASE_URL = process.env.COLLECTIBLES_BASE_URL ?? 'http://localhost:3000';

if (!CSV_PATH) {
  console.error('Usage: npx tsx scripts/ingest-playmats-csv.ts <csv-path> [--apply]');
  process.exit(1);
}

function authHeaders(): Record<string, string> {
  if (process.env.COLLECTIBLES_BEARER) {
    return { Authorization: `Bearer ${process.env.COLLECTIBLES_BEARER}` };
  }
  if (process.env.COLLECTIBLES_COOKIE) {
    return { Cookie: process.env.COLLECTIBLES_COOKIE };
  }
  console.error('Set COLLECTIBLES_COOKIE or COLLECTIBLES_BEARER for auth.');
  process.exit(1);
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

interface Entry { name: string; year: number | null; source: string | null }

async function main() {
  const fs = await import('fs');
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const [header, ...rows] = parseCSV(raw);
  if (!/name/i.test(header[0] ?? '')) {
    console.error(`Unexpected header: ${JSON.stringify(header)} — expected "Art / Name, Release Year, Original Source"`);
    process.exit(1);
  }

  // ── normalize ──────────────────────────────────────────────────────────
  const entries: Entry[] = [];
  let skippedBlank = 0;
  for (const r of rows) {
    const name = (r[0] ?? '').trim();
    if (!name) { skippedBlank++; continue; }
    const yearRaw = (r[1] ?? '').trim();
    const yearMatch = yearRaw.match(/(\d{4})/);
    const year = yearMatch ? Number(yearMatch[1]) : null;
    const uncertain = yearRaw.includes('?');
    let source = (r[2] ?? '').trim() || null;
    if (uncertain) source = source ? `${source} (year uncertain)` : '(year uncertain)';
    entries.push({ name, year, source });
  }

  // ── dedupe within the CSV ──────────────────────────────────────────────
  const byKey = new Map<string, Entry>();
  let dupes = 0;
  for (const e of entries) {
    const key = `${e.name.toLowerCase()}|${e.year ?? ''}`;
    const prior = byKey.get(key);
    if (prior) {
      dupes++;
      if (prior.source !== e.source) {
        console.warn(`⚠ duplicate with differing source, keeping first: "${e.name}" (${e.year})\n    kept:    ${prior.source}\n    dropped: ${e.source}`);
      }
      continue;
    }
    byKey.set(key, e);
  }

  // ── skip entries already in the target catalog ─────────────────────────
  const listRes = await fetch(`${BASE_URL}/api/collectibles?kind=playmat`);
  const listBody = await listRes.json();
  if (!listRes.ok || !listBody.success) {
    console.error(`Failed to list existing catalog: ${listBody.error ?? listRes.status}`);
    process.exit(1);
  }
  const existing = new Set<string>(
    listBody.data.map((c: { name: string; year: number | null }) => `${c.name.toLowerCase()}|${c.year ?? ''}`),
  );
  const toCreate = Array.from(byKey.values()).filter(
    (e) => !existing.has(`${e.name.toLowerCase()}|${e.year ?? ''}`),
  );

  console.log(`\nTarget: ${BASE_URL}`);
  console.log(`CSV rows: ${rows.length} | blank skipped: ${skippedBlank} | in-file dupes dropped: ${dupes}`);
  console.log(`Unique entries: ${byKey.size} | already in catalog: ${byKey.size - toCreate.length} | to create: ${toCreate.length}`);

  if (!APPLY) {
    console.log('\nDRY RUN — first 10 that would be created:');
    for (const e of toCreate.slice(0, 10)) console.log(`  ${e.name} (${e.year ?? 'year unknown'}) — ${e.source ?? 'no source'}`);
    console.log('\nRe-run with --apply to write.');
    return;
  }

  const headers = { 'Content-Type': 'application/json', ...authHeaders() };
  let created = 0;
  const failures: string[] = [];
  for (const e of toCreate) {
    const res = await fetch(`${BASE_URL}/api/admin/collectibles`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ kind: 'playmat', name: e.name, year: e.year ?? undefined, source: e.source ?? undefined }),
    });
    const body = await res.json();
    if (res.ok && body.success) created++;
    else failures.push(`${e.name} (${e.year}): ${body.error ?? res.status}`);
  }

  console.log(`\nCreated: ${created}/${toCreate.length}`);
  if (failures.length) {
    console.log(`Failures (${failures.length}):`);
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
