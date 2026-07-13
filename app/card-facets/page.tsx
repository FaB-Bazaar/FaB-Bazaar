import { auth } from '@/auth'
import { PublicCardFacetsClient } from './PublicCardFacetsClient'

export const dynamic = 'force-dynamic'

// Community card facets — PUBLIC browse for everyone (signed-out included, so
// shared links and crawlers get the real page), edits gated per-action: voting
// and suggesting require sign-in, enforced by the /api/card-facets/* routes and
// surfaced as inline sign-in prompts in the client.
export default async function CardFacetsPage() {
  const session = await auth()
  const isSignedIn = Boolean(session?.user?.id)

  return (
    <div className="max-w-[1500px] mx-auto p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-1">Card Facets</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Community-curated tags for what cards <em>do</em> — beyond their printed text. Filter by facets
        on the left, click a card to see or vote its tags. A tag needs <strong>2+ voters</strong> to go
        live in search{isSignedIn ? '' : ' — sign in to vote or suggest new tags'}.
      </p>
      <PublicCardFacetsClient isSignedIn={isSignedIn} />
    </div>
  )
}
