// app/change-history/page.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, ChevronDown, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import type { ChangeHistoryEntry } from "@/lib/services/postgres/binder/inventory-history"

// Dates arrive as ISO strings over JSON
type Entry = Omit<ChangeHistoryEntry, "createdAt"> & { createdAt: string }

const PITCH_DOT: Record<number, string> = { 1: "bg-red-500", 2: "bg-yellow-400", 3: "bg-blue-500" }

function BinderLink({ binder }: { binder: Entry["sourceBinder"] }) {
  if (!binder) return <span className="italic text-muted-foreground">(deleted binder)</span>
  return (
    <Link href={`/binder/${binder.id}`} className="font-medium hover:underline">
      {binder.name}
    </Link>
  )
}

function HistoryEntry({ entry }: { entry: Entry }) {
  const [open, setOpen] = useState(false)
  const when = new Date(entry.createdAt)

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <time dateTime={entry.createdAt} className="text-sm text-muted-foreground">
          {when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </time>
        <span className="flex flex-wrap items-center gap-2">
          <BinderLink binder={entry.sourceBinder} />
          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-label="to" />
          <BinderLink binder={entry.targetBinder} />
        </span>
        <span className="text-sm text-muted-foreground">
          {entry.totalQuantity} {entry.totalQuantity === 1 ? "card" : "cards"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide cards" : "Show cards"}
          <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {open && (
        <ul className="mt-3 divide-y border-t text-sm">
          {entry.items.map((item, i) => (
            <li key={`${item.printingId}-${item.condition}-${item.language}-${i}`} className="flex items-center gap-3 py-2">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="h-12 w-auto rounded" loading="lazy" />
              ) : (
                <div className="h-12 w-[34px] rounded bg-muted" />
              )}
              <span className="font-medium tabular-nums">{item.quantity}×</span>
              {item.pitch && PITCH_DOT[item.pitch] && (
                <span className={`h-2.5 w-2.5 rounded-full ${PITCH_DOT[item.pitch]}`} aria-label={`pitch ${item.pitch}`} />
              )}
              <span>{item.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {[item.collectorNumber, item.condition, item.language].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default function ChangeHistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetch("/api/change-history")
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok || !body.success) throw new Error(body.error || "Failed to load change history")
        setEntries(body.data)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load change history"))
  }, [user])

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <History className="h-6 w-6" aria-hidden="true" />
        Change history
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cards you moved between your binders in the last 30 days.
      </p>

      <div className="mt-6">
        {authLoading ? null : !user ? (
          <p>
            <Link href="/auth/login?callbackUrl=/change-history" className="underline">
              Sign in
            </Link>{" "}
            to see your change history.
          </p>
        ) : error ? (
          <p role="alert" className="text-destructive">{error}</p>
        ) : entries === null ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground">No changes in the last 30 days.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <HistoryEntry key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
