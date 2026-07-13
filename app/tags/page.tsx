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
      <h1 className="text-3xl font-bold mb-1">Tags</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Tag what a card actually does, not just what&apos;s printed on it. Your tags show up for
        everyone in search and in{' '}
        <a href="/volzar" className="underline hover:text-gray-900 dark:hover:text-white">Volzar</a>.
        Filter by tag on the left, or click any card to vote on its tags. A tag goes live once
        two people vote for it{isSignedIn ? '.' : '. Sign in to vote or suggest tags.'}
      </p>
      <PublicCardFacetsClient isSignedIn={isSignedIn} />
    </div>
  )
}
