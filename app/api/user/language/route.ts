// POST /api/user/language — set (or clear) the user's preferred Volzar reply
// language (users.preferred_language). Powers the Volzar first-visit language
// nudge; an explicit choice here overrides the country_code → language
// mapping in resolveUserLanguage. '' clears back to auto.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userService } from '@/lib/services';
import { SUPPORTED_LANGUAGES } from '@/app/volzar/ui-strings';

const VALID_CODES = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const language = (body as { language?: unknown })?.language;
  if (typeof language !== 'string' || (language !== '' && !VALID_CODES.has(language))) {
    return NextResponse.json({ success: false, error: 'language must be a supported code or empty' }, { status: 400 });
  }

  const result = await userService.updateProfile(session.user.id, {
    preferredLanguage: language,
  });
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
