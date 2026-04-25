import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { userService, bannedCardsService, printingsService } from '@/lib/services'
import { BANNED_FORMATS } from '@/lib/services/contracts/IBannedCardsService'
import { BannedCardsClient, type CardLookup } from './BannedCardsClient'

export default async function BannedCardsAdminPage() {
  const session = await auth()
  const user = session?.user
  if (!user?.id) redirect('/')

  const roleCheck = await userService.hasRole(user.id, 'isSuperAdmin')
  if (!roleCheck.success || !roleCheck.data) redirect('/admin/articles')

  // Preload all formats' entries (including inactive) so the admin view
  // shows the full history.
  const initial = await Promise.all(
    BANNED_FORMATS.map(async format => {
      const res = await bannedCardsService.listByFormat(format, { includeInactive: true })
      return { format, entries: res.success ? res.data : [] }
    }),
  )

  // Enrich with card name + image for at-a-glance management.
  const cardUniqueIds = Array.from(
    new Set(initial.flatMap(b => b.entries.map(e => e.cardUniqueId))),
  )
  const cardLookup: CardLookup = {}
  if (cardUniqueIds.length > 0) {
    const printingsRes = await printingsService.searchPrintings(
      { cardUniqueIds },
      { limit: cardUniqueIds.length * 5 },
    )
    if (printingsRes.success) {
      for (const p of printingsRes.data.printings) {
        if (cardLookup[p.card_unique_id]) continue
        cardLookup[p.card_unique_id] = {
          name: p.name,
          pitch: p.pitch ?? null,
          imageUrl: p.image_url ?? null,
        }
      }
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">Banned Cards</h1>
      <p className="text-muted-foreground mb-8">
        Format-specific banned-card registry. Use &ldquo;Sync from FaB&rdquo; to pull the latest upstream list,
        or toggle individual entries manually.
      </p>
      <BannedCardsClient
        initial={JSON.parse(JSON.stringify(initial))}
        cardLookup={cardLookup}
      />
    </div>
  )
}
