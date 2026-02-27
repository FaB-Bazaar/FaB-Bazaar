// app/auth/mcp-login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { userService } from '@/lib/services';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  
  console.log('=== MCP LOGIN REQUEST ===');
  console.log('Redirect URI:', redirectUri);
  console.log('State:', state);
  console.log('User Agent:', request.headers.get('user-agent'));
  console.log('All params:', Object.fromEntries(searchParams));
  console.log('========================');

  // Check if user is already authenticated
  const session = await auth();
  
  if (session && session.user?.id) {
    console.log('✅ User already authenticated, generating MCP token');

    try {
      // User is logged in, generate MCP token and redirect back
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
        throw new Error('Failed to update MCP token');
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
      } else {
        console.log('⚠️ No redirect URI provided');
        return NextResponse.json({ 
          access_token: mcpToken,
          message: 'MCP token generated successfully' 
        });
      }
    } catch (error) {
      console.error('❌ Error generating MCP token:', error);
      return NextResponse.json({ 
        error: 'Failed to generate MCP token' 
      }, { status: 500 });
    }
  }

  // User not authenticated, redirect to Discord OAuth
  console.log('🔐 User not authenticated, redirecting to Discord OAuth');
  
  try {
    // Store MCP redirect info for after Discord auth
    const callbackUrl = new URL('/auth/mcp-callback', request.url);
    if (redirectUri) {
      callbackUrl.searchParams.set('redirect_uri', redirectUri);
    }
    if (state) {
      callbackUrl.searchParams.set('state', state);
    }
    
    // Redirect to Discord sign-in
    const discordAuthUrl = new URL('/api/auth/signin/discord', request.url);
    discordAuthUrl.searchParams.set('callbackUrl', callbackUrl.toString());
    
    console.log('🔄 Redirecting to Discord OAuth:', discordAuthUrl.toString());
    return NextResponse.redirect(discordAuthUrl.toString());
  } catch (error) {
    console.error('❌ Error setting up Discord redirect:', error);
    return NextResponse.json({ 
      error: 'Failed to setup authentication' 
    }, { status: 500 });
  }
}
// // app/auth/mcp-login/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route";
// import connectToDatabase from '@/lib/mongodb';
// import User from '@/models/User';
// import crypto from 'crypto';

// export async function GET(request: NextRequest) {
//   const { searchParams } = new URL(request.url);
//   const redirectUri = searchParams.get('redirect_uri');
//   const state = searchParams.get('state');
  
//   console.log('=== MCP LOGIN REQUEST ===');
//   console.log('Redirect URI:', redirectUri);
//   console.log('State:', state);
//   console.log('User Agent:', request.headers.get('user-agent'));
//   console.log('All params:', Object.fromEntries(searchParams));
//   console.log('========================');

//   // Check if user is already authenticated
//   const session = await getServerSession(authOptions);
  
//   if (session && session.user?.id) {
//     console.log('✅ User already authenticated, generating MCP token');
    
//     try {
//       // User is logged in, generate MCP token and redirect back
//       await connectToDatabase();
      
//       // Generate MCP token
//       const mcpToken = `mcp_${crypto.randomBytes(32).toString('hex')}`;
//       const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
//       // Store token in user record
//       await User.findByIdAndUpdate(session.user.id, {
//         mcpToken: mcpToken,
//         mcpTokenExpiry: tokenExpiry
//       });
      
//       console.log('🎫 Generated MCP token for user:', session.user.id);
      
//       // Redirect back to Claude with the token
//       if (redirectUri) {
//         const redirectUrl = new URL(redirectUri);
//         redirectUrl.searchParams.set('access_token', mcpToken);
//         if (state) {
//           redirectUrl.searchParams.set('state', state);
//         }
        
//         console.log('🔄 Redirecting back to Claude:', redirectUrl.toString());
//         return NextResponse.redirect(redirectUrl.toString());
//       } else {
//         console.log('⚠️ No redirect URI provided');
//         return NextResponse.json({ 
//           access_token: mcpToken,
//           message: 'MCP token generated successfully' 
//         });
//       }
//     } catch (error) {
//       console.error('❌ Error generating MCP token:', error);
//       return NextResponse.json({ 
//         error: 'Failed to generate MCP token' 
//       }, { status: 500 });
//     }
//   }

//   // User not authenticated, redirect to Discord OAuth
//   console.log('🔐 User not authenticated, redirecting to Discord OAuth');
  
//   try {
//     // Store MCP redirect info for after Discord auth
//     const callbackUrl = new URL('/auth/mcp-callback', request.url);
//     if (redirectUri) {
//       callbackUrl.searchParams.set('redirect_uri', redirectUri);
//     }
//     if (state) {
//       callbackUrl.searchParams.set('state', state);
//     }
    
//     // Redirect to Discord sign-in
//     const discordAuthUrl = new URL('/api/auth/signin/discord', request.url);
//     discordAuthUrl.searchParams.set('callbackUrl', callbackUrl.toString());
    
//     console.log('🔄 Redirecting to Discord OAuth:', discordAuthUrl.toString());
//     return NextResponse.redirect(discordAuthUrl.toString());
//   } catch (error) {
//     console.error('❌ Error setting up Discord redirect:', error);
//     return NextResponse.json({ 
//       error: 'Failed to setup authentication' 
//     }, { status: 500 });
//   }
// }