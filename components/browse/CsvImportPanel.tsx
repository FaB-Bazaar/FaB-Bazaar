"use client";

// Print-code CSV upload for /browse (partner exports, e.g. Nanza). The file
// format is the contract in lib/import/print-code.ts; the catalog of codes is
// GET /api/printings/catalog.
import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, FileSpreadsheet, Heart, Loader2, X } from "lucide-react";
import type { PrintCodeImportRow } from "@/lib/client/csv-import-client";

interface CsvImportPanelProps {
  signedIn: boolean;
  loading: boolean;
  isImporting: boolean;
  issues: { rows: PrintCodeImportRow[]; parseErrors: string[] } | null;
  wantsCount: number;
  onUpload: (file: File) => void;
  onAddWants: () => void;
  onDismissIssues: () => void;
}

const MAX_LISTED = 50;

export default function CsvImportPanel({
  signedIn, loading, isImporting, issues, wantsCount, onUpload, onAddWants, onDismissIssues,
}: CsvImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const issueLines = issues
    ? [
        ...issues.parseErrors,
        ...issues.rows.map(r =>
          `Row ${r.line} (${r.printCode}): ${r.reason ?? (r.status === 'unresolved' ? 'not found' : 'check this one')}` +
          (r.status === 'not_sure' ? ' It is left unstaged below.' : ''),
        ),
      ]
    : [];

  return (
    <div className="mb-8 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          data-testid="csv-import-input"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!signedIn || loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <FileSpreadsheet className="mr-2 h-4 w-4" />}
          {loading ? "Reading CSV..." : "Upload CSV"}
        </Button>
        {wantsCount > 0 && (
          <Button type="button" variant="outline" disabled={isImporting} onClick={onAddWants}>
            <Heart className="mr-2 h-4 w-4" />
            Add {wantsCount} wanted card{wantsCount === 1 ? "" : "s"} from the CSV to wants
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
        {signedIn ? "" : "Sign in to upload a CSV. "}
        One row per printing, with columns <code>print_code</code> (required), <code>name</code>, <code>quantity</code>,{" "}
        <code>condition</code>, <code>for_trade</code> and <code>wants_quantity</code>. Matched cards are staged below, ready to
        add to a binder.{" "}
        <a
          href="/api/printings/catalog"
          className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Download the print-code list
        </a>
        .
      </p>

      {issueLines.length > 0 && (
        <Alert className="mt-4" data-testid="csv-import-issues">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            {issueLines.length} row{issueLines.length === 1 ? "" : "s"} need a look
            <button
              type="button"
              aria-label="Dismiss"
              onClick={onDismissIssues}
              className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <X className="h-4 w-4" />
            </button>
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {issueLines.slice(0, MAX_LISTED).map((line, i) => <li key={i}>{line}</li>)}
            </ul>
            {issueLines.length > MAX_LISTED && (
              <p className="mt-1 text-sm">…and {issueLines.length - MAX_LISTED} more.</p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
