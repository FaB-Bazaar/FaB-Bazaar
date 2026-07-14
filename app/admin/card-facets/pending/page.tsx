import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { userService } from '@/lib/services'
import { PendingFacetsClient } from './PendingFacetsClient'

export default async function PendingFacetsAdminPage() {
  const session = await auth()
  const user = session?.user
  if (!user?.id) redirect('/')

  const superAdmin = await userService.hasRole(user.id, 'isSuperAdmin')
  const curator = await userService.hasRole(user.id, 'isCurator')
  const allowed = (superAdmin.success && superAdmin.data) || (curator.success && curator.data)
  if (!allowed) redirect('/admin/articles')

  return (
    <div className="max-w-[1000px] mx-auto p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-1">Pending Tag Approvals</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Public tag requests from the community. Approving lets a tag count toward the public
        search threshold; rejecting keeps it as the requester&rsquo;s private tag.
      </p>
      <PendingFacetsClient />
    </div>
  )
}
