'use client';

import { useCookieConsent } from '@/contexts/CookieConsentContext';

export const AffiliateDisclosure = () => {
  const { consentOptions, openPreferences } = useCookieConsent();
  
  return (
    <div className="container mx-auto px-4 mt-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
        <div className="block md:flex md:items-start md:gap-2">
          <img
            src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
            alt="TCGPlayer"
            className="h-5 w-auto mb-2 md:mb-0 md:mt-0.5 md:flex-shrink-0"
          />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {consentOptions.advertising ? (
              <>
                TCGPlayer links on this page include affiliate tracking to help support this site.
                You can adjust this in your <button
                  onClick={openPreferences}
                  className="underline hover:text-blue-900 dark:hover:text-blue-100"
                >
                  cookie preferences
                </button>.
              </>
            ) : (
              <>
                Help support this site by enabling affiliate tracking in your <button
                  onClick={openPreferences}
                  className="underline hover:text-blue-900 dark:hover:text-blue-100"
                >
                  cookie preferences
                </button>. This allows us to earn a small commission from TCGPlayer purchases at no extra cost to you.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};