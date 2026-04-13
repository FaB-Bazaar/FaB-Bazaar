import { curatedListService, curatorHeroAssignmentService } from '@/lib/services';

export async function checkListOwnership(
  userId: string,
  listId: string
): Promise<{ allowed: boolean; error?: string }> {
  const listResult = await curatedListService.getListById(listId);
  if (!listResult.success) {
    return { allowed: false, error: 'List not found' };
  }

  const list = listResult.data;

  if (!list.heroName && !list.className) {
    return { allowed: false, error: 'Only Super Admins can modify general lists' };
  }

  const assignmentsResult = await curatorHeroAssignmentService.getAssignmentsForUser(userId);
  if (!assignmentsResult.success) {
    return { allowed: false, error: 'Failed to verify hero assignments' };
  }

  const assignedHeroes = assignmentsResult.data.map(a => a.heroName.toLowerCase());

  if (list.heroName && assignedHeroes.includes(list.heroName.toLowerCase())) {
    return { allowed: true };
  }

  return { allowed: false, error: 'You are not assigned as curator for this hero' };
}
