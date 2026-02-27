// app/auth/mcp-callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { userService } from '@/lib/services';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  
  console.log('=== MCP CALLBACK ===');
  console.log('Redirect URI:', redirectUri);
  console.log('State:', state);
  console.log('User Agent:', request.headers.get('user-agent'));
  console.log('All params:', Object.fromEntries(searchParams));
  console.log('===================');

  // Check if user is authenticated after Discord OAuth
  const session = await auth();
  
  if (!session || !session.user?.id) {
    console.log('❌ Authentication failed after Discord OAuth');
    return NextResponse.redirect(new URL('/auth/error?error=AuthenticationFailed', request.url));
  }

  console.log('✅ User authenticated after Discord OAuth:', session.user.id);

  try {
    // Generate MCP token
    const mcpToken = `mcp_${crypto.randomBytes(32).toString('hex')}`;
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token in user record using service layer
    const updateResult = await userService.updateMcpToken(
      session.user.id,
      mcpToken,
      tokenExpiry
    );

    if (!updateResult.success) {
      console.log('❌ Failed to update user with MCP token');
      return NextResponse.json({
        error: 'Failed to generate MCP token'
      }, { status: 500 });
    }

    console.log('🎫 Generated MCP token for user:', session.user.id);

    // Redirect back to Claude with the token
    if (redirectUri) {
      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set('access_token', mcpToken);
      if (state) {
        redirectUrl.searchParams.set('state', state);
      }
      
      console.log('🔄 Redirecting back to Claude:', redirectUrl.toString());
      return NextResponse.redirect(redirectUrl.toString());
    }

    // Fallback if no redirect URI - show success page
    console.log('⚠️ No redirect URI provided, showing success page');
    const successHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>MCP Authentication Successful</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                 max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          .success { color: #28a745; }
          .token { background: #f8f9fa; padding: 10px; border-radius: 5px; 
                   font-family: monospace; word-break: break-all; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1 class="success">✅ MCP Authentication Successful!</h1>
        <p>Your FabBazaar account has been connected for MCP access.</p>
        <p>You can now return to Claude and use the FabBazaar tools.</p>
        <details>
          <summary>Debug Info</summary>
          <div class="token">Token: ${mcpToken}</div>
          <p>Expires: ${tokenExpiry.toISOString()}</p>
        </details>
      </body>
      </html>
    `;
    
    return new NextResponse(successHtml, {
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    console.error('❌ Error in MCP callback:', error);
    return NextResponse.json({ 
      error: 'Failed to complete MCP authentication',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}