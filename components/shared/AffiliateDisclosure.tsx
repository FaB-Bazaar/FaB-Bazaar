// components/shared/AffiliateDisclosure.tsx
"use client";

import { useCookieConsent } from '@/contexts/CookieConsentContext';

export function AffiliateDisclosure() {
  const { consentOptions } = useCookieConsent();

  return (
    <div className="bg-white dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center gap-2">
          <img
            src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
            alt="TCGPlayer"
            className="h-4 w-auto flex-shrink-0"
          />
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
            {consentOptions.advertising ? (
              <>
                TCGPlayer links include affiliate tracking to support this site. Adjust in your{' '}
                <button
                  onClick={() => document.dispatchEvent(new Event('openCookiePreferences'))}
                  className="underline hover:text-gray-700 dark:hover:text-gray-200"
                >
                  cookie preferences
                </button>.
              </>
            ) : (
              <>
                Help support this site by enabling affiliate tracking in your{' '}
                <button
                  onClick={() => document.dispatchEvent(new Event('openCookiePreferences'))}
                  className="underline hover:text-gray-700 dark:hover:text-gray-200"
                >
                  cookie preferences
                </button>
                {' '}— small commissions at no extra cost to you.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
