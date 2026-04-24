/**
 * GA4 Data API CLI — ad-hoc analytics reports from the terminal.
 *
 * One-time setup:
 *   1. GCP project (no billing account — do NOT link one)
 *   2. Enable "Google Analytics Data API" on the project
 *   3. IAM → Service Accounts → create → download JSON key
 *   4. GA4 Admin → Property access management → add the service-account email as Viewer
 *   5. Store JSON outside the repo (e.g. ~/.config/fab-bazaar/ga-sa.json)
 *   6. In .env.local set:
 *        GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/ga-sa.json
 *        GA_PROPERTY_ID=123456789       (numeric, from Admin → Property details)
 *
 * Commands:
 *   npm run ga:events  [--days N] [--format json]
 *   npm run ga:pages   [--days N] [--format json]
 *   npm run ga:sources [--date YYYY-MM-DD] [--format json]
 *   npm run ga:spike   <YYYY-MM-DD> [--format json]
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';

type Flags = { days?: number; date?: string; format?: 'text' | 'json'; positional: string[] };

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { format: 'text', positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--days') flags.days = Number(argv[++i]);
    else if (a === '--date') flags.date = argv[++i];
    else if (a === '--format') flags.format = argv[++i] as 'text' | 'json';
    else flags.positional.push(a);
  }
  return flags;
}

function yesterdayIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function assertEnv(): { propertyId: string } {
  const propertyId = process.env.GA_PROPERTY_ID;
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!propertyId) {
    console.error('❌ GA_PROPERTY_ID is not set in .env.local.');
    console.error('   Find it at GA Admin → Property details → "Property ID" (numeric, e.g. 123456789).');
    console.error('   Note: this is NOT the same as NEXT_PUBLIC_GA_ID (which starts with "G-").');
    process.exit(1);
  }
  if (propertyId.startsWith('G-')) {
    console.error(`❌ GA_PROPERTY_ID looks like a measurement ID ("${propertyId}").`);
    console.error('   The Data API needs the numeric Property ID from Admin → Property details.');
    process.exit(1);
  }
  if (!creds) {
    console.error('❌ GOOGLE_APPLICATION_CREDENTIALS is not set in .env.local.');
    console.error('   Point it at the absolute path of your service-account JSON key.');
    process.exit(1);
  }
  return { propertyId };
}

function printTable(headers: string[], widths: number[], rows: string[][]) {
  const line = '─'.repeat(widths.reduce((a, b) => a + b, 0));
  console.log(line);
  console.log(headers.map((h, i) => h.padEnd(widths[i])).join(''));
  console.log(line);
  for (const row of rows) {
    console.log(row.map((c, i) => String(c).padEnd(widths[i])).join(''));
  }
  console.log(line);
}

async function runEvents(client: BetaAnalyticsDataClient, propertyId: string, flags: Flags) {
  const days = flags.days ?? 28;
  const [resp] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }, { name: 'eventCountPerUser' }],
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
  });
  if (flags.format === 'json') return console.log(JSON.stringify(resp, null, 2));

  console.log(`\n📊 Events — last ${days} days\n`);
  const rows = (resp.rows ?? []).map((r) => [
    r.dimensionValues?.[0]?.value ?? '',
    Number(r.metricValues?.[0]?.value ?? 0).toLocaleString(),
    Number(r.metricValues?.[1]?.value ?? 0).toLocaleString(),
    Number(r.metricValues?.[2]?.value ?? 0).toFixed(2),
  ]);
  printTable(['Event'.padEnd(30), 'Count', 'Users', 'Per user'], [30, 14, 10, 10], rows);
}

async function runPages(client: BetaAnalyticsDataClient, propertyId: string, flags: Flags) {
  const days = flags.days ?? 28;
  const [resp] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'averageSessionDuration' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 25,
  });
  if (flags.format === 'json') return console.log(JSON.stringify(resp, null, 2));

  console.log(`\n📄 Top pages — last ${days} days\n`);
  const rows = (resp.rows ?? []).map((r) => [
    (r.dimensionValues?.[0]?.value ?? '').slice(0, 59),
    Number(r.metricValues?.[0]?.value ?? 0).toLocaleString(),
    Number(r.metricValues?.[1]?.value ?? 0).toLocaleString(),
    `${Number(r.metricValues?.[2]?.value ?? 0).toFixed(0)}s`,
  ]);
  printTable(['Path', 'Views', 'Users', 'Avg sess'], [60, 10, 10, 10], rows);
}

async function runSources(client: BetaAnalyticsDataClient, propertyId: string, flags: Flags) {
  const date = flags.date ?? yesterdayIso();
  const [resp] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'sessionSourceMedium' }],
    metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  });
  if (flags.format === 'json') return console.log(JSON.stringify(resp, null, 2));

  console.log(`\n🌐 Traffic sources — ${date}\n`);
  const rows = (resp.rows ?? []).map((r) => [
    (r.dimensionValues?.[0]?.value ?? '').slice(0, 39),
    Number(r.metricValues?.[0]?.value ?? 0).toLocaleString(),
    Number(r.metricValues?.[1]?.value ?? 0).toLocaleString(),
    Number(r.metricValues?.[2]?.value ?? 0).toLocaleString(),
  ]);
  printTable(['Source / Medium', 'Sessions', 'Views', 'Users'], [40, 10, 10, 10], rows);
}

async function runSpike(client: BetaAnalyticsDataClient, propertyId: string, flags: Flags) {
  const date = flags.positional[0];
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error('❌ Usage: npm run ga:spike <YYYY-MM-DD>');
    process.exit(1);
  }

  const [sources] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'sessionSourceMedium' }],
    metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  });

  const [landing] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'landingPagePlusQueryString' }],
    metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 15,
  });

  const [hourly] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'hour' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'sessions' }],
    orderBys: [{ dimension: { dimensionName: 'hour' }, desc: false }],
  });

  if (flags.format === 'json') {
    return console.log(JSON.stringify({ sources, landing, hourly }, null, 2));
  }

  console.log(`\n🔍 Spike investigation — ${date}\n`);

  console.log('\n🌐 Sources');
  const srcRows = (sources.rows ?? []).map((r) => [
    (r.dimensionValues?.[0]?.value ?? '').slice(0, 39),
    Number(r.metricValues?.[0]?.value ?? 0).toLocaleString(),
    Number(r.metricValues?.[1]?.value ?? 0).toLocaleString(),
    Number(r.metricValues?.[2]?.value ?? 0).toLocaleString(),
  ]);
  printTable(['Source / Medium', 'Sessions', 'Views', 'Users'], [40, 10, 10, 10], srcRows);

  console.log('\n📄 Landing pages');
  const landRows = (landing.rows ?? []).map((r) => [
    (r.dimensionValues?.[0]?.value ?? '').slice(0, 59),
    Number(r.metricValues?.[0]?.value ?? 0).toLocaleString(),
    Number(r.metricValues?.[1]?.value ?? 0).toLocaleString(),
  ]);
  printTable(['Landing page', 'Sessions', 'Views'], [60, 10, 10], landRows);

  console.log('\n⏰ Hourly distribution (UTC)');
  const hourRows = (hourly.rows ?? []).map((r) => [
    `${(r.dimensionValues?.[0]?.value ?? '').padStart(2, '0')}:00`,
    Number(r.metricValues?.[0]?.value ?? 0).toLocaleString(),
    Number(r.metricValues?.[1]?.value ?? 0).toLocaleString(),
  ]);
  printTable(['Hour', 'Views', 'Sessions'], [10, 10, 10], hourRows);
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const flags = parseFlags(rest);

  if (!command) {
    console.error('Usage: tsx scripts/ga-report.ts <events|pages|sources|spike> [flags]');
    process.exit(1);
  }

  const { propertyId } = assertEnv();
  const client = new BetaAnalyticsDataClient();

  switch (command) {
    case 'events':  return runEvents(client, propertyId, flags);
    case 'pages':   return runPages(client, propertyId, flags);
    case 'sources': return runSources(client, propertyId, flags);
    case 'spike':   return runSpike(client, propertyId, flags);
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ GA report failed:', err?.message ?? err);
    process.exit(1);
  });
