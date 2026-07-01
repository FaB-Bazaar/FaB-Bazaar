'use client';

import React from 'react';
import Link from 'next/link';

// Minimal one-line attribution for the full-height search shells (/opt,
// /search), where the global <SiteFooter/> is suppressed. Lives as a shrink-0
// row at the bottom of the shell, so it never adds body height past the
// viewport (the thing that caused scroll-chaining into the old footer). Keeps
// only what's legally load-bearing: the LSS non-affiliation + trademark notice
// (fan-content requirement) and the affiliate-commission disclosure (these
// pages surface priced TCGplayer links).
export function AppShellAttribution() {
  return (
    <footer className="shrink-0 border-t border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-1.5">
      <p className="text-center text-[11px] leading-tight text-gray-400 dark:text-gray-500">
        © {new Date().getFullYear()} FaB Bazaar · Not affiliated with Legend Story Studios — Flesh and Blood™ &amp; set names are LSS trademarks · Some card links earn a commission ·{' '}
        <Link
          href="/privacy-policy"
          className="hover:text-gray-600 dark:hover:text-gray-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
        >
          Privacy
        </Link>
        {' · '}
        <Link
          href="/terms-of-service"
          className="hover:text-gray-600 dark:hover:text-gray-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
        >
          Terms
        </Link>
      </p>
    </footer>
  );
}
