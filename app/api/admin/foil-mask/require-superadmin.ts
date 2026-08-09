import { userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

/**
 * Session + superadmin gate shared by every foil-mask admin route.
 * Returns the caller's id, or the status to respond with.
 */
export async function requireSuperAdmin() {
  const authResult = await authenticateSession();
  if (!authResult.success || !authResult.userId) {
    return { error: 'Unauthorized', status: 401 } as const;
  }
  const rolesResult = await userService.getRoles(authResult.userId);
  if (!rolesResult.success || !rolesResult.data?.isSuperAdmin) {
    return { error: 'Forbidden', status: 403 } as const;
  }
  return { userId: authResult.userId } as const;
}
