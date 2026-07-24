// hooks/useCookieBannerInset.ts
"use client";

import { useEffect, useState } from 'react';
import { useCookieConsent } from '@/contexts/CookieConsentContext';

/**
 * Height (px) of the fixed-bottom cookie consent banner, 0 once consent is
 * given. The banner is z-50 and swallows taps on anything rendered beneath
 * it, so fixed bottom-anchored UI (floating action buttons, sheet footers)
 * must add this to its bottom offset while the banner is visible. Same
 * measurement pattern as the volzar composer (app/volzar/VolzarChat.tsx).
 */
export function useCookieBannerInset(): number {
  const { consentGiven } = useCookieConsent();
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (consentGiven) { setInset(0); return; }
    let ro: ResizeObserver | null = null;
    let timer: number | undefined;
    let tries = 0;
    const attach = () => {
      const el = document.querySelector('[data-cookie-banner]');
      if (!el) {
        // banner mounts ~100ms after load; give up quietly if it never shows
        if (tries++ < 20) timer = window.setTimeout(attach, 150);
        return;
      }
      const update = () => setInset(el.getBoundingClientRect().height);
      update();
      ro = new ResizeObserver(update);
      ro.observe(el);
    };
    attach();
    return () => { ro?.disconnect(); window.clearTimeout(timer); };
  }, [consentGiven]);

  return inset;
}
