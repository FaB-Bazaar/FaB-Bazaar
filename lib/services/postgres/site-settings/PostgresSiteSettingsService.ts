import { db } from '@/lib/postgres/db';
import { siteSettings } from '@/lib/postgres/schema';
import { eq } from 'drizzle-orm';
import type { AsyncResult } from '../../contracts/common';

export class PostgresSiteSettingsService {
  async get<T = unknown>(key: string): AsyncResult<T | null> {
    try {
      const rows = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.key, key))
        .limit(1);

      if (rows.length === 0) return { success: true, data: null };
      return { success: true, data: rows[0].value as T };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to get site setting' };
    }
  }

  async set(key: string, value: unknown): AsyncResult<void> {
    try {
      await db
        .insert(siteSettings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { value, updatedAt: new Date() },
        });

      return { success: true, data: undefined };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to set site setting' };
    }
  }
}
