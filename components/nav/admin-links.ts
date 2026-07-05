/**
 * Admin navigation links + per-role access logic, kept as pure data so the
 * gating can be unit-tested independently of the navbar. Each link's `roles`
 * lists the roles that grant access (OR semantics) — mirror the access gate on
 * the corresponding app/admin/<page> server component when adding entries.
 */

export type AdminRoleKey = 'superAdmin' | 'curator' | 'contentCreator'

export interface AdminRoleFlags {
  isSuperAdmin?: boolean
  isCurator?: boolean
  isContentCreator?: boolean
}

export interface AdminLink {
  href: string
  label: string
  /** Any one of these roles grants access. */
  roles: readonly AdminRoleKey[]
}

export const ADMIN_LINKS: readonly AdminLink[] = [
  { href: '/admin/fabby-chat', label: 'Fabby Chat', roles: ['superAdmin'] },
  { href: '/admin/articles', label: 'Articles', roles: ['superAdmin', 'contentCreator'] },
  { href: '/admin/card-facets', label: 'Card Facets', roles: ['superAdmin', 'curator'] },
  { href: '/admin/curation', label: 'Curation', roles: ['superAdmin', 'curator'] },
  { href: '/admin/banned-cards', label: 'Banned Cards', roles: ['superAdmin'] },
  { href: '/admin/heroes', label: 'Heroes', roles: ['superAdmin'] },
  { href: '/admin/sets', label: 'Set Order', roles: ['superAdmin'] },
  { href: '/admin/locations', label: 'Locations & Events', roles: ['superAdmin'] },
  { href: '/admin/image-uploads', label: 'Image Uploads', roles: ['superAdmin'] },
  { href: '/admin/user-access', label: 'User Access', roles: ['superAdmin'] },
]

function hasRole(user: AdminRoleFlags | null, role: AdminRoleKey): boolean {
  if (!user) return false
  switch (role) {
    case 'superAdmin':
      return !!user.isSuperAdmin
    case 'curator':
      return !!user.isCurator
    case 'contentCreator':
      return !!user.isContentCreator
    default:
      return false
  }
}

/** Admin links the given user is allowed to open (empty → hide the menu). */
export function accessibleAdminLinks(user: AdminRoleFlags | null): AdminLink[] {
  return ADMIN_LINKS.filter((link) => link.roles.some((r) => hasRole(user, r)))
}
