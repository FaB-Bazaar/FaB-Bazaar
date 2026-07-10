import Link from 'next/link';
import { Heart, LogIn, Sparkles } from 'lucide-react';

// Signed-out gate: shown to anonymous visitors (instead of an instant login
// redirect) so link crawlers get real HTML with the Volzar OG tags and humans
// see what the feature is before signing in. The sign-in CTA keeps callbackUrl
// so a shared /volzar link survives the login round-trip.
//
// Volzar is standard for every signed-in account (2026-07) — there is no
// supporter gate anymore, so this renders ONLY for signed-out visitors.
// Usage limits: lib/ai/tiers.ts.
export function AccessGate() {
  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/volzar-icon.png"
        alt=""
        aria-hidden="true"
        className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
      />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          <Sparkles className="mr-1.5 inline h-5 w-5 text-violet-500 dark:text-violet-400" aria-hidden="true" />
          Meet Volzar
        </h1>
        <p className="text-base text-gray-700 dark:text-gray-300">
          Volzar is FaB Bazaar&apos;s AI assistant: search cards, drill into
          your binders and decks, compare your collection to the Decks to
          Beat, and get trade help — free with every FaB Bazaar account.
        </p>
      </div>
      <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row">
        <Link
          href="/auth/login?callbackUrl=%2Fvolzar"
          className={`inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-base font-medium text-white hover:bg-violet-700 ${focusRing}`}
        >
          <LogIn className="h-4 w-4" aria-hidden="true" /> Sign in to chat
        </Link>
        <Link
          href="/metafy"
          className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-base font-medium text-gray-800 hover:bg-muted dark:text-gray-200 ${focusRing}`}
        >
          <Heart className="h-4 w-4" aria-hidden="true" /> Support on Metafy
        </Link>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Sign in with your FaB Bazaar account to start chatting — you&apos;ll
        come right back here.
      </p>
    </div>
  );
}
