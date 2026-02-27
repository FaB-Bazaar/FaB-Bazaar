// app/api/mcp/generate-token/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import { userService } from '@/lib/services';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a new MCP token (raw token returned to user, hash stored in DB)
    const rawToken = `mcp_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const mcpTokenExpiry = new Date();
    mcpTokenExpiry.setDate(mcpTokenExpiry.getDate() + 30); // 30 days

    // Store the hash, not the raw token
    const result = await userService.updateMcpToken(
      session.user.id,
      tokenHash,
      mcpTokenExpiry
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      token: rawToken,
      expiresAt: mcpTokenExpiry.toISOString(),
      message: 'MCP token generated successfully. Save this token — it will not be shown again.',
    });
  } catch (error) {
    console.error('Error generating MCP token:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}