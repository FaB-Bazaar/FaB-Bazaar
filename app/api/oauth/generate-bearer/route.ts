import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { authTokenService } from '@/lib/services';

export async function POST() {
  console.log('🔧 Bearer token generation endpoint hit!');

  try {
    const session = await auth();
    console.log('Session:', !!session, session?.user?.id);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await authTokenService.generateBearerToken(session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Log masked token for security
    console.log(
      'Generated token:',
      result.data.access_token.substring(0, 8) + '...[REDACTED]'
    );
    console.log('Expires at:', result.data.expires_at);

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error generating Bearer token:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate Bearer token',
        details: error.message,
      },
      { status: 500 }
    );
  }
}