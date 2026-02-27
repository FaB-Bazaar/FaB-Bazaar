import DiscordProvider from "next-auth/providers/discord"
import crypto from "crypto"
import type { JWT } from "next-auth/jwt"
import type { Session } from "next-auth"
import { generateMcpToken } from './generateMcpToken';
import { userService } from '@/lib/services';

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "identify email guilds",
        },
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      if (url.startsWith('claude://')) {
        return url;
      }
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      return baseUrl;
    },
    async jwt({ token, user, account, profile }: { token: JWT; user: any; account: any; profile?: any }) {
      console.log('[NextAuth][jwt] Start', { hasAccount: !!account, hasUser: !!user, provider: account?.provider });
      if (account && user) {
        if (account.provider === "discord") {
          try {
            let existingUser = null;

            // Try to find by email hash first
            if (user.email) {
              const emailHash = crypto.createHash("sha256").update(user.email.toLowerCase()).digest("hex");
              const emailResult = await userService.findByEmailHash(emailHash);
              if (emailResult.success && emailResult.data) {
                existingUser = emailResult.data;
              }
              console.log('[NextAuth][jwt] Looked up existing user by emailHash', { email: user.email, emailHash, found: !!existingUser });
            } else {
              console.log('[NextAuth][jwt] No email provided by Discord profile', { profile });
            }

            // If not found by email, try to find by discordId as fallback
            if (!existingUser && profile?.id) {
              const discordResult = await userService.findByDiscordId(profile.id);
              if (discordResult.success && discordResult.data) {
                existingUser = discordResult.data;
              }
              console.log('[NextAuth][jwt] Looked up existing user by discordId', { discordId: profile.id, found: !!existingUser });
            }

            if (existingUser) {
              // Update Discord info if it has changed
              if (existingUser.discordId !== profile?.id || existingUser.discordUsername !== profile?.username) {
                await userService.updateDiscordInfo(existingUser._id, profile?.id, profile?.username);
                console.log('[NextAuth][jwt] Updated existing user with new Discord info', { userId: existingUser._id });
              }

              // Generate and store a new MCP token
              const mcpToken = generateMcpToken();
              const mcpTokenExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days expiry
              await userService.updateMcpToken(existingUser._id, mcpToken, mcpTokenExpiry);

              token.mcpToken = mcpToken;
              token.id = existingUser._id;
              token.username = existingUser.username;
              token.discordUsername = existingUser.discordUsername;
              console.log('[NextAuth][jwt] Returning existing user', { userId: existingUser._id, mcpToken });
            } else {
              console.log('[NextAuth][jwt] Creating new user for Discord profile', { profile });
              try {
                const username = `dc_${profile?.username || Math.random().toString(36).substring(2, 8)}`;
                const mcpToken = generateMcpToken();
                const mcpTokenExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days expiry

                const createResult = await userService.create({
                  username: username,
                  email: user.email,
                  password: crypto.randomBytes(32).toString("hex"),
                  discordUsername: profile?.username,
                });

                if (createResult.success && createResult.data) {
                  // Update the new user with Discord ID and MCP token
                  await userService.updateDiscordInfo(createResult.data._id, profile?.id, profile?.username);
                  await userService.updateMcpToken(createResult.data._id, mcpToken, mcpTokenExpiry);

                  console.log('[NextAuth][jwt] New user created', { userId: createResult.data._id, username: createResult.data.username, mcpToken });
                  token.mcpToken = mcpToken;
                  token.id = createResult.data._id;
                  token.username = createResult.data.username;
                  token.discordUsername = createResult.data.discordUsername;
                  token.isNewUser = true;
                } else {
                  console.error('[NextAuth][jwt] Failed to create user:', createResult.error);
                }
              } catch (err) {
                console.error('[NextAuth][jwt] Error creating new user', err);
              }
            }
          } catch (err) {
            console.error('[NextAuth][jwt] DB or logic error', err);
          }
        }
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token && session.user) {
        // Fetch user from DB to get roles and other fields
        const profileResult = await userService.getProfile(token.id as string);
        const user = profileResult.success ? profileResult.data : null;

        // Explicitly construct session.user without email
        session.user = {
          id: token.id as string,
          name: session.user.name,
          image: session.user.image,
          username: user?.username || (token.username as string),
          discordUsername: user?.discordUsername || (token.discordUsername as string),
          discordId: user?.discordId,
          roles: user?.roles || {},
          country: user?.country,
          city: user?.city,
          state: user?.state
          // Notice: NO email field here
        }
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
} 