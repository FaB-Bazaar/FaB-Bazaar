import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { userService } from '@/lib/services'
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
    <div className="max-w-[1500px] mx-auto p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-1">Card Facets</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Curated, interpretive &ldquo;what a card does&rdquo; tags. Filter by facets on the left, click a
        card to add or remove tags. These tags are never written by the data pipeline.
      </p>
      <CardFacetsClient />
    </div>
  )
}
