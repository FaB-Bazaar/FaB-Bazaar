/**
 * League directory tile.
 *
 * Shown on /leagues. Surfaces the four pieces of context a player needs
 * to decide whether to follow a league: name, format, cadence (the
 * free-text scheduleSummary), and the next event they could join. Plus
 * a Discord CTA when the organizer published an invite.
 *
 * Pure presentational — no data fetching, no client-side state.
 */

import React from 'react';
import Link from 'next/link';
import { Calendar, ExternalLink, Lock } from 'lucide-react';
import type { LeagueWithNextEventDTO } from '@/lib/services/contracts/ILeagueService';

interface LeagueCardProps {
  league: LeagueWithNextEventDTO;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1';

function formatEventDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function LeagueCard({ league }: LeagueCardProps) {
  return (
    <article className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {league.bannerUrl && (
        <img
          src={league.bannerUrl}
          alt={league.name}
          className="w-full h-32 object-cover"
        />
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            <Link
              href={`/leagues/${league.slug}`}
              className={`hover:text-blue-600 dark:hover:text-blue-400 rounded ${focusRing}`}
            >
              {league.name}
            </Link>
          </h2>
          {!league.public && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full flex-shrink-0"
              title="This league is unlisted"
            >
              <Lock className="h-3 w-3" aria-hidden="true" />
              Private
            </span>
          )}
        </div>

        {league.format && (
          <div className="inline-flex items-center text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded">
            {league.format}
          </div>
        )}

        {league.scheduleSummary && (
          <p className="text-sm text-gray-700 dark:text-gray-300">{league.scheduleSummary}</p>
        )}

        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
          <Calendar className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {league.nextEvent ? (
            <span className="truncate">
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {league.nextEvent.name}
              </span>
              <span className="mx-1.5 text-gray-400" aria-hidden="true">·</span>
              {formatEventDate(league.nextEvent.scheduledFor)}
            </span>
          ) : (
            <span className="italic">No upcoming event</span>
          )}
        </div>

        {league.discordInviteUrl && (
          <a
            href={league.discordInviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 rounded ${focusRing}`}
          >
            Join Discord
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}
