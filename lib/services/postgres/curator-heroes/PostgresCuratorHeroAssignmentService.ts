import { db } from '@/lib/postgres/db';
import { curatorHeroAssignments, users } from '@/lib/postgres/schema';
import { eq, and, sql } from 'drizzle-orm';
import { displayUsername } from '@/lib/utils/display-username';
import type {
  ICuratorHeroAssignmentService,
  CuratorHeroAssignmentDTO,
} from '../../contracts/ICuratorHeroAssignmentService';
import type { AsyncResult } from '../../contracts/common';

export class PostgresCuratorHeroAssignmentService implements ICuratorHeroAssignmentService {
  private mapRow(row: { userId: string; heroName: string; metafyProductUrl: string | null; metafyLinkLabel: string | null; username: string | null; displayUsername: string | null; avatarUrl: string | null }): CuratorHeroAssignmentDTO {
    return {
      userId: row.userId,
      heroName: row.heroName,
      metafyProductUrl: row.metafyProductUrl ?? null,
      metafyLinkLabel: row.metafyLinkLabel ?? null,
      username: row.username ?? '',
      displayUsername: displayUsername(row.displayUsername ?? row.username ?? ''),
      avatarUrl: row.avatarUrl ?? null,
    };
  }

  private baseSelect() {
    return db
      .select({
        userId: curatorHeroAssignments.userId,
        heroName: curatorHeroAssignments.heroName,
        metafyProductUrl: curatorHeroAssignments.metafyProductUrl,
        metafyLinkLabel: curatorHeroAssignments.metafyLinkLabel,
        username: users.username,
        displayUsername: users.displayUsername,
        avatarUrl: users.avatarUrl,
      })
      .from(curatorHeroAssignments)
      .leftJoin(users, eq(curatorHeroAssignments.userId, users.id));
  }

  async getAssignmentsForUser(userId: string): AsyncResult<CuratorHeroAssignmentDTO[]> {
    try {
      const rows = await this.baseSelect().where(eq(curatorHeroAssignments.userId, userId));
      return { success: true, data: rows.map(r => this.mapRow(r)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get assignments for user' };
    }
  }

  async getAssignmentsForHero(heroName: string): AsyncResult<CuratorHeroAssignmentDTO[]> {
    try {
      const rows = await this.baseSelect().where(eq(sql`lower(${curatorHeroAssignments.heroName})`, heroName.toLowerCase()));
      return { success: true, data: rows.map(r => this.mapRow(r)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get assignments for hero' };
    }
  }

  async getAllAssignments(): AsyncResult<CuratorHeroAssignmentDTO[]> {
    try {
      const rows = await this.baseSelect().orderBy(users.username, curatorHeroAssignments.heroName);
      return { success: true, data: rows.map(r => this.mapRow(r)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get all assignments' };
    }
  }

  async assign(userId: string, heroName: string, metafyProductUrl?: string | null, metafyLinkLabel?: string | null): AsyncResult<void> {
    try {
      await db.execute(
        sql`INSERT INTO curator_hero_assignments (user_id, hero_name, metafy_product_url, metafy_link_label)
            VALUES (${userId}, ${heroName.toLowerCase()}, ${metafyProductUrl ?? null}, ${metafyLinkLabel ?? null})
            ON CONFLICT (user_id, hero_name) DO UPDATE SET
              metafy_product_url = EXCLUDED.metafy_product_url,
              metafy_link_label = EXCLUDED.metafy_link_label`
      );
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to assign curator to hero' };
    }
  }

  async unassign(userId: string, heroName: string): AsyncResult<void> {
    try {
      await db
        .delete(curatorHeroAssignments)
        .where(
          and(
            eq(curatorHeroAssignments.userId, userId),
            eq(sql`lower(${curatorHeroAssignments.heroName})`, heroName.toLowerCase())
          )
        );
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unassign curator from hero',
      };
    }
  }

  async updateMetafyLink(userId: string, heroName: string, metafyProductUrl: string | null, metafyLinkLabel?: string | null): AsyncResult<void> {
    try {
      const updateData: Partial<typeof curatorHeroAssignments.$inferInsert> = { metafyProductUrl };
      if (metafyLinkLabel !== undefined) updateData.metafyLinkLabel = metafyLinkLabel;
      await db
        .update(curatorHeroAssignments)
        .set(updateData)
        .where(
          and(
            eq(curatorHeroAssignments.userId, userId),
            eq(sql`lower(${curatorHeroAssignments.heroName})`, heroName.toLowerCase())
          )
        );
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update Metafy link' };
    }
  }
}
