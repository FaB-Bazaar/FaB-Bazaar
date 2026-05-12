import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { userService, printingsService } from '@/lib/services'
import { HeroLegalityClient } from './HeroLegalityClient'

export default async function HeroLegalityAdminPage() {
  const session = await auth()
  const user = session?.user
  if (!user?.id) redirect('/')

  const roleCheck = await userService.hasRole(user.id, 'isSuperAdmin')
  if (!roleCheck.success || !roleCheck.data) redirect('/admin/articles')

  const res = await printingsService.listHeroCards()
  const heroes = res.success ? res.data : []

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">Hero Format Legality</h1>
      <p className="text-muted-foreground mb-8">
        Toggle which formats each hero is legal in. Changes write directly to the <code>cards</code> table.
      </p>
      <HeroLegalityClient initial={heroes} />
    </div>
  )
}
