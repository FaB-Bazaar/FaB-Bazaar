// components/scan/PrintingChoice.tsx — pick a printing from short text lines (collector number, language, set,
// foiling, edition, TCG Low price): quick to scan and phone-friendly, no image grid. Used by the /scan name box (after
// a name is picked) and by "Swap printing" on review rows.
"use client";

import { Loader2 } from "lucide-react";
import { orderPrintings, printingLine } from "@/lib/scan/banner/printing-options";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
const PITCH = { 1: "red", 2: "yellow", 3: "blue" } as Record<number, string>;
const PITCH_DOT = { 1: "bg-red-600", 2: "bg-yellow-400", 3: "bg-blue-600" } as Record<number, string>;

interface Props {
  name: string;
  /** null = still loading */
  printings: any[] | null;
  onChoose: (printing: any) => void;
  /** main action next to the list (e.g. "Use the usual one"); focused so Enter takes it */
  primary?: { label: string; onClick: () => void };
  cancelLabel: string;
  onCancel: () => void;
  /** printing currently on the card, marked in the list */
  currentId?: string;
}

export default function PrintingChoice({ name, printings, onChoose, primary, cancelLabel, onCancel, currentId }: Props) {
  return (
    <div className="w-full rounded-md border border-gray-300 p-2 dark:border-gray-600">
      <p className="text-base text-gray-900 dark:text-gray-100">Which printing of <span className="font-medium">{name}</span>?</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {primary && (
          <button type="button" autoFocus onClick={primary.onClick}
            className={`rounded-md bg-gray-900 px-3 py-1.5 text-base font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300 ${FOCUS_RING}`}>{primary.label}</button>
        )}
        <button type="button" autoFocus={!primary} onClick={onCancel}
          className={`rounded-md border border-gray-300 px-3 py-1.5 text-base text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 ${FOCUS_RING}`}>{cancelLabel}</button>
      </div>
      {printings === null ? (
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" aria-hidden />Loading printings…</p>
      ) : printings.length === 0 ? (
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">No printings found.</p>
      ) : (
        <ul aria-label={`Printings of ${name}`} className="mt-2 max-h-72 space-y-1 overflow-y-auto">
          {orderPrintings(printings).map(pr => {
            const line = printingLine(pr);
            const current = pr.printing_id === currentId;
            return (
              <li key={pr.printing_id}>
                <button type="button" data-collector={line.code} onClick={() => onChoose(pr)} aria-current={current || undefined}
                  // phones: details wrap to a second line (truncating hid the foiling/edition that tells same-number
                  // printings apart); wider: one line
                  className={`flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-2 py-1.5 text-left sm:flex-nowrap text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700 ${current ? "border-2 border-blue-600 dark:border-blue-400" : "border-gray-200 dark:border-gray-700"} ${FOCUS_RING}`}>
                  {pr.pitch ? <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${PITCH_DOT[pr.pitch]}`} aria-hidden /> : <span className="inline-block h-2.5 w-2.5 shrink-0" aria-hidden />}
                  {pr.pitch ? <span className="sr-only">{PITCH[pr.pitch]}</span> : null}
                  <span className="font-medium">{line.code}</span>
                  <span className="shrink-0 rounded border border-gray-300 px-1 text-xs font-semibold text-gray-800 dark:border-gray-600 dark:text-gray-200">{line.language}</span>
                  <span className="order-last w-full pl-[18px] text-gray-700 dark:text-gray-300 sm:order-none sm:w-auto sm:min-w-0 sm:flex-1 sm:truncate sm:pl-0">{line.details.join(" · ")}</span>
                  {current && <span className="shrink-0 text-xs font-semibold text-blue-700 dark:text-blue-300">✓ current</span>}
                  <span className="ml-auto shrink-0 font-medium sm:ml-0">{line.price}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
