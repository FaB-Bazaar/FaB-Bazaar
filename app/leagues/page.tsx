/**
 * /leagues — the community league directory.
 *
 * Server component: fetches public leagues annotated with their next
 * upcoming event via the service layer, hands them to <LeaguesDirectory>
 * for rendering. Private leagues are never surfaced here — they only
 * load by direct URL for users with the right viewer context (handled
 * by the per-league /leagues/[slug] page).
 */

import React from 'react';
import { leagueService } from '@/lib/services';
import LeaguesDirectory from '@/components/leagues/LeaguesDirectory';

export const dynamic = 'force-dynamic';

export default async function LeaguesPage() {
  const result = await leagueService.listLeaguesWithNextEvent({ publicOnly: true });

  if (!result.success) {
    return (
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-2">
          Failed to load leagues
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">{result.error}</p>
      </div>
    );
  }

  return <LeaguesDirectory leagues={result.data} />;
}
