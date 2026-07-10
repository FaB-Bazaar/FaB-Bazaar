import Link from 'next/link';
import { Heart, Link2, LogIn, Sparkles } from 'lucide-react';

// Shown to signed-in users WITHOUT Volzar access instead of a silent bounce
// to the home page: explains what the feature is, who gets it, and the two
// paths in (become a supporter, or link an existing Metafy account so the
// tier can be verified). Lapsed supporters land here after the lazy
// re-verify downgrades them — the copy has to make "why did I lose this?"
// answerable without a support ticket.
//
// signedOut: shown to anonymous visitors (instead of an instant login
// redirect) so link crawlers get real HTML with the Volzar OG tags and
// humans see what the feature is before signing in. The sign-in CTA keeps
// callbackUrl so a shared /volzar link still survives the login round-trip.
export function AccessGate({ signedOut = false }: { signedOut?: boolean } = {}) {
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
          Volzar is a supporter perk
        </h1>
        <p className="text-base text-gray-700 dark:text-gray-300">
          Volzar — the hosted AI chat for your binders, decks, and trades — is
          available to paid Metafy supporters of FaB Bazaar.
        </p>
      </div>
      {signedOut ? (
        <>
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
        </>
      ) : (
        <>
          <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/metafy"
              className={`inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-base font-medium text-white hover:bg-violet-700 ${focusRing}`}
            >
              <Heart className="h-4 w-4" aria-hidden="true" /> Support on Metafy
            </Link>
            <Link
              href="/profile/connected-accounts"
              className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-base font-medium text-gray-800 hover:bg-muted dark:text-gray-200 ${focusRing}`}
            >
              <Link2 className="h-4 w-4" aria-hidden="true" /> Link your Metafy account
            </Link>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Already a supporter? Linking your Metafy account lets us verify your
            tier — access updates the next time you open this page. If your
            subscription lapsed, renewing it restores access the same way.
          </p>
        </>
      )}
    </div>
  );
}
