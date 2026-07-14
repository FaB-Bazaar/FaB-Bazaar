'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Check, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface PendingItem {
  cardUniqueId: string
  tag: string
  userId: string
  username: string
  cardName: string
}

export function PendingFacetsClient() {
  const { toast } = useToast()
  const [items, setItems] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const key = (i: PendingItem) => `${i.cardUniqueId}:${i.tag}:${i.userId}`

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/card-facets/pending')
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.success) setItems(json.data as PendingItem[])
    else toast({ title: 'Failed to load queue', description: json.error ?? `HTTP ${res.status}`, variant: 'destructive' })
    setLoading(false)
  }, [toast])
  useEffect(() => { load() }, [load])

  const review = async (item: PendingItem, action: 'approve' | 'reject') => {
    setBusy(key(item))
    const res = await fetch('/api/admin/card-facets/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardUniqueId: item.cardUniqueId, tag: item.tag, userId: item.userId, action }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (res.ok && json.success) {
      setItems((prev) => prev.filter((p) => key(p) !== key(item)))
      toast({ title: action === 'approve' ? 'Approved' : 'Rejected', description: `${item.cardName} · ${item.tag}` })
    } else {
      toast({ title: 'Action failed', description: json.error ?? `HTTP ${res.status}`, variant: 'destructive' })
    }
  }

  if (loading) {
    return <p className="text-gray-600 dark:text-gray-300 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading queue…</p>
  }
  if (items.length === 0) {
    return <p className="text-gray-600 dark:text-gray-300">Nothing pending. 🎉</p>
  }

  return (
    <ul className="space-y-2" data-testid="pending-queue">
      {items.map((item) => (
        <li
          key={key(item)}
          className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <div className="min-w-0">
            <span className="font-semibold">{item.cardName}</span>
            <span className="mx-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">{item.tag}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">requested by {item.username}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={busy === key(item)}
              onClick={() => review(item, 'approve')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:outline-none"
            >
              <Check className="h-4 w-4" /> Approve
            </button>
            <button
              type="button"
              disabled={busy === key(item)}
              onClick={() => review(item, 'reject')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-semibold bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
            >
              <X className="h-4 w-4" /> Reject
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
