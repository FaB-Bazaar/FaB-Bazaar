import { NextResponse } from 'next/server';
import { userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';
import { getRedisClient } from '@/lib/redis';

const CACHE_KEY = 'browse:all_printings:v2';

export async function POST() {
  const authResult = await authenticateSession();
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const rolesResult = await userService.getRoles(authResult.userId);
  if (!rolesResult.success || !rolesResult.data?.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const redis = getRedisClient();
  if (!redis) {
    return NextResponse.json({ error: 'Redis not available' }, { status: 503 });
  }

  await redis.del(CACHE_KEY);
  return NextResponse.json({ success: true, message: 'Browse cache cleared — next search load will fetch fresh data.' });
}
