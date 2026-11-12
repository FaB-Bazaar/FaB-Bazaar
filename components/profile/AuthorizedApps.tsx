"use client"

// "Apps with access" on Profile → Connected accounts: every app the user has
// allowed to act for them through the OAuth consent screen, what each may do,
// and a button to remove that access.
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface AuthorizedApp {
  client_id: string
  name: string
  site: string | null
  full_access: boolean
  permissions: string[]
  authorized_at: string
}

export function AuthorizedApps() {
  const [apps, setApps] = useState<AuthorizedApp[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/user/authorized-apps")
      if (!response.ok) throw new Error(String(response.status))
      const body = await response.json()
      setApps(body.data ?? [])
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (app: AuthorizedApp) => {
    setRemoving(app.client_id)
    try {
      const response = await fetch(`/api/user/authorized-apps/${encodeURIComponent(app.client_id)}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error(String(response.status))
      setApps(current => (current ?? []).filter(a => a.client_id !== app.client_id))
      toast.success(`${app.name} no longer has access`)
    } catch {
      toast.error(`Could not remove access for ${app.name}`)
    } finally {
      setRemoving(null)
    }
  }

  return (
    <Card data-testid="authorized-apps">
      <CardContent className="pt-5 space-y-4">
        <div>
          <h2 className="text-sm font-medium">Apps with access</h2>
          <p className="text-sm text-muted-foreground">
            Apps you have allowed to use your FaB Bazaar account. Removing one signs it out at once.
          </p>
        </div>

        {failed && (
          <p className="text-sm text-red-700 dark:text-red-400" role="alert">
            Could not load your connected apps.{" "}
            <button type="button" className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={load}>
              Try again
            </button>
          </p>
        )}

        {!failed && apps === null && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!failed && apps !== null && apps.length === 0 && (
          <p className="text-sm text-muted-foreground">No apps have access to your account.</p>
        )}

        {!failed && apps !== null && apps.length > 0 && (
          <ul className="divide-y">
            {apps.map(app => (
              <li key={app.client_id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">
                    {app.name}
                    {app.site && <span className="font-normal text-muted-foreground"> · {app.site}</span>}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {app.permissions.map(line => (
                      <li
                        key={line}
                        className={
                          app.full_access
                            ? "text-sm text-amber-800 dark:text-amber-300"
                            : "text-sm text-muted-foreground"
                        }
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Allowed {new Date(app.authorized_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0"
                  disabled={removing === app.client_id}
                  onClick={() => remove(app)}
                  aria-label={`Remove access for ${app.name}`}
                >
                  {removing === app.client_id ? "Removing…" : "Remove access"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
