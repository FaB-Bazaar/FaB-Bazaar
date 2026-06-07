import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { userService } from '@/lib/services'
import { FACET_TAGS } from '@/lib/search/card-facets'
import { CardFacetsClient } from './CardFacetsClient'

export default async function CardFacetsAdminPage() {
  const session = await auth()
  const user = session?.user
  if (!user?.id) redirect('/')

  const superAdmin = await userService.hasRole(user.id, 'isSuperAdmin')
  const curator = await userService.hasRole(user.id, 'isCurator')
  const allowed = (superAdmin.success && superAdmin.data) || (curator.success && curator.data)
  if (!allowed) redirect('/admin/articles')

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">Card Facets</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">
        Curated, interpretive &ldquo;what a card does&rdquo; tags. Tag cards by hand, or filter by
        facets to dogfood the search. These tags are never written by the data pipeline.
      </p>
      <CardFacetsClient facetTags={[...FACET_TAGS]} />
    </div>
  )
}
