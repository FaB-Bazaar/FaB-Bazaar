import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { authTokenService } from '@/lib/services';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await authTokenService.getBearerToken(session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    if (result.data) {
      return NextResponse.json(result.data);
    } else {
      return NextResponse.json({
        access_token: null,
        message: 'No valid bearer token found',
      });
    }
  } catch (error) {
    console.error('Error fetching bearer token:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bearer token' },
      { status: 500 }
    );
  }
}