'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CookieSettingsButton } from '@/components/cookie/cookie-settings-button';

// Full-height "app shell" routes own the viewport with an internal scroll pane
// (`h-[calc(100vh-64px)]` + `overflow-hidden`). The marketing footer doesn't
// belong there: rendering it adds body height past the viewport, which lets the
// results pane's scroll chain into the window and drop the user into the footer
// mid-search. Suppress it on those routes so the page stays exactly one screen.
const APP_SHELL_ROUTES = ['/opt', '/search', '/admin/fabby-chat'];

export function SiteFooter() {
  const pathname = usePathname();
  if (APP_SHELL_ROUTES.includes(pathname)) return null;

  return (
    <footer className="bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">

          {/* Column 1: Brand & Disclaimer */}
          <div className="col-span-1 lg:col-span-2">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">FaB Bazaar</h3>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              The ultimate fan-made trading platform for the Flesh and Blood TCG community.
              Find cards, manage your collection, and connect with local traders.
            </p>
          </div>

          {/* Column 2: Navigate */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Navigate</h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href="/collection" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
                  Collection
                </Link>
              </li>
              <li>
                <Link href="/browse" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
                  Bulk Import
                </Link>
              </li>
              <li>
                <Link href="/decks" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
                  Decks
                </Link>
              </li>
              <li>
                <Link href="/guides" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
                  Articles
                </Link>
              </li>
              <li>
                <Link
                  href="https://github.com/FaB-Bazaar/FaB-Bazaar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors"
                >
                  Source Code
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Resources</h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href="/terms-of-service" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
                  About
                </Link>
              </li>
              {/* The CookieSettingsButton is a component, not a link */}
              <li>
                <CookieSettingsButton />
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar for Copyright */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            &copy; {new Date().getFullYear()} FaB Bazaar is in no way affiliated with Legend Story Studios. Legend Story Studios®, Flesh and Blood™, and set names are trademarks of Legend Story Studios. Flesh and Blood characters, cards, logos, and art are property of Legend Story Studios.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Some card links may earn us a commission at no extra cost to you.
          </p>
        </div>
      </div>
    </footer>
  );
}
