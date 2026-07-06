import { describe, it, expect } from 'vitest'
import { accessibleAdminLinks, ADMIN_LINKS } from './admin-links'

const hrefs = (user: any) => accessibleAdminLinks(user).map((l) => l.href)

describe('accessibleAdminLinks', () => {
  it('returns nothing for a logged-out user', () => {
    expect(accessibleAdminLinks(null)).toEqual([])
  })

  it('returns nothing for a user with no admin roles', () => {
    expect(accessibleAdminLinks({ isSuperAdmin: false, isCurator: false, isContentCreator: false })).toEqual([])
  })

  it('gives a superadmin every admin link', () => {
    expect(accessibleAdminLinks({ isSuperAdmin: true })).toEqual(ADMIN_LINKS)
  })

  it('gives a curator only the curator-managed pages', () => {
    expect(hrefs({ isCurator: true }).sort()).toEqual(['/admin/card-facets', '/admin/curation'])
  })

  it('gives a content creator only Articles', () => {
    expect(hrefs({ isContentCreator: true })).toEqual(['/admin/articles'])
  })

  it('unions roles (curator + content creator)', () => {
    expect(hrefs({ isCurator: true, isContentCreator: true }).sort()).toEqual([
      '/admin/articles',
      '/admin/card-facets',
      '/admin/curation',
    ])
  })

  it('never exposes superadmin-only pages to a curator', () => {
    expect(hrefs({ isCurator: true })).not.toContain('/admin/user-access')
    expect(hrefs({ isCurator: true })).not.toContain('/admin/banned-cards')
  })

  it('does not list Volzar — it moved to /volzar, gated by canUseVolzar', () => {
    expect(ADMIN_LINKS.some((l) => l.href.includes('volzar'))).toBe(false)
    expect(hrefs({ isSuperAdmin: true })).not.toContain('/volzar')
  })
})
