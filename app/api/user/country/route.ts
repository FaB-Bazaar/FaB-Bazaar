// POST /api/user/country — set (or clear) the user's self-set home country.
// Powers the Volzar first-visit country nudge; the code drives localized
// suggested prompts and Volzar's reply language.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userService } from '@/lib/services';

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

  const country = (body as { country?: unknown })?.country;
  // '' clears the country; otherwise strictly an ISO2 alpha code.
  if (typeof country !== 'string' || (country !== '' && !/^[A-Za-z]{2}$/.test(country))) {
    return NextResponse.json({ success: false, error: 'country must be an ISO2 code or empty' }, { status: 400 });
  }

  const result = await userService.updateProfile(session.user.id, {
    country: country === '' ? '' : country.toUpperCase(),
  });
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
