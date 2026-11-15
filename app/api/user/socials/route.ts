// POST /api/user/socials — replace the signed-in user's social handles
// (users.social_links). Body: { socials: { nanza?, youtube?, instagram?,
// bluesky?, facebook?, x?, website? } } — a handle, @handle or profile link
// per platform, plus an optional website address; '' or a missing key clears it.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userService } from '@/lib/services';
import { sanitizeSocialLinks } from '@/lib/profile/social-links';
import { invalidatePublicProfile } from '@/lib/profile/public-profile-cache';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sanitized = sanitizeSocialLinks((body as { socials?: unknown })?.socials);
  if (!sanitized.ok) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  const result = await userService.updateProfile(session.user.id, { socialLinks: sanitized.value });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  // The public profile shows these links; don't make the user wait out the cache.
  invalidatePublicProfile((session.user as { username?: string }).username ?? session.user.name);
  return NextResponse.json({ success: true, data: { socials: sanitized.value } });
}
