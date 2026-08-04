"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IMPORT_URL_GUIDE } from "@/lib/deck/import-url-guide";

/**
 * The URL-import integration spec, rendered as copyable raw markdown — the
 * copy target is meant to be pasted into an LLM or a ticket, so the source
 * text beats HTML. One spec covers both /decks/import and the /browse binder
 * prefill; rendered collapsed on working pages, open on landing states.
 */
export default function IntegrationGuide({ defaultOpen }: { defaultOpen: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(IMPORT_URL_GUIDE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <details
      open={defaultOpen}
      className="rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
    >
      <summary className="cursor-pointer select-none px-4 py-3 text-base font-semibold text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-lg">
        Integration guide — build links to this page
      </summary>
      <div className="px-4 pb-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            The full URL spec in markdown — paste it into your LLM or hand it to a developer.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="flex-shrink-0"
          >
            {copied ? (
              <><Check className="h-4 w-4 mr-1.5" aria-hidden="true" />Copied</>
            ) : (
              <><Copy className="h-4 w-4 mr-1.5" aria-hidden="true" />Copy guide</>
            )}
          </Button>
        </div>
        <pre className="text-xs leading-relaxed text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-3 max-h-96 overflow-auto whitespace-pre-wrap">
          {IMPORT_URL_GUIDE}
        </pre>
      </div>
    </details>
  );
}
