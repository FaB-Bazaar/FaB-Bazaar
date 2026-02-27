import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { authTokenService } from '@/lib/services';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const result = await authTokenService.getMcpToken(
      session.user.id,
      session.user.username,
      session.user.discordUsername
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    if (result.data) {
      return NextResponse.json({
        token: result.data.token,
        expiresAt: result.data.expiresAt,
      });
    } else {
      return NextResponse.json({
        token: null,
        message: 'No valid token found',
      });
    }
  } catch (error) {
    console.error('Error fetching MCP token:', error);
    return NextResponse.json(
      { error: 'Failed to fetch MCP token' },
      { status: 500 }
    );
  }
}
