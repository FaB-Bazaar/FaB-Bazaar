/**
 * The /leagues directory — a marquee grid of community-run leagues.
 *
 * Pure presentational. The page-level server component does the
 * leagueService.listLeaguesWithNextEvent call and passes results in.
 */

import React from 'react';
import LeagueCard from './LeagueCard';
import type { LeagueWithNextEventDTO } from '@/lib/services/contracts/ILeagueService';

interface LeaguesDirectoryProps {
  leagues: LeagueWithNextEventDTO[];
}

export default function LeaguesDirectory({ leagues }: LeaguesDirectoryProps) {
  return (
    <div className="container mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">Leagues</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Community-run leagues across formats. Join on Discord, follow events here.
        </p>
      </header>

      {leagues.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
            No leagues yet
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Check back later, or talk to a curator about hosting one.
          </p>
        </div>
      ) : (
        <div
          data-testid="leagues-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {leagues.map(league => (
            <LeagueCard key={league.id} league={league} />
          ))}
        </div>
      )}
    </div>
  );
}
