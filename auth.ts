// auth.ts

import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';
import crypto from 'crypto';
import { authConfig } from './auth.config'; 
import { userService } from '@/lib/services';

// This is the MAIN configuration with SERVER-ONLY logic.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig, // <-- Spread the edge-safe config
  providers: [
    // Define your full provider implementation here
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'identify email guilds',
        },
      },
      checks: ['state'], // Disable PKCE, use only state parameter
    }),
  ],
  callbacks: {
    // All your database logic is safely contained here,
    // as it will only run in the Node.js environment.
    async jwt({ token, account, profile, trigger, session }) {
        if (account && profile && account.provider === 'discord') {
            console.log('[JWT Callback] Discord login detected for:', profile.username);
            let user = null;
            let isNewUser = false;

            // Try to find user by Discord ID
            const userByDiscordResult = await userService.findByDiscordId(profile.id);
            console.log('[JWT Callback] User found by discordId:', userByDiscordResult.success && !!userByDiscordResult.data);

            if (userByDiscordResult.success && userByDiscordResult.data) {
              user = userByDiscordResult.data;
            }

            // If not found and email exists, try by email
            if (!user && profile.email) {
              const userByEmailResult = await userService.findByEmail(profile.email);
              console.log('[JWT Callback] User found by email:', userByEmailResult.success && !!userByEmailResult.data);
              if (userByEmailResult.success && userByEmailResult.data) {
                user = userByEmailResult.data;
              }
            }

            // Build Discord avatar URL
            const avatarUrl = profile.avatar
              ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
              : null;

            if (user) {
              console.log('[JWT Callback] Existing user, updating Discord info');
              console.log('[JWT Callback] User roles from DB:', JSON.stringify(user.roles, null, 2));

              // Update Discord info
              const updateResult = await userService.updateUser(user._id, {
                discordId: profile.id,
                discordUsername: profile.username,
                discordAvatar: avatarUrl,
              });

              if (updateResult.success && updateResult.data) {
                user = updateResult.data;
              }
            } else {
              console.log('[JWT Callback] Creating new user');
              isNewUser = true;

              const createResult = await userService.createUser({
                username: `dc_${profile.username}`,
                email: profile.email,
                password: crypto.randomBytes(32).toString('hex'),
                discordId: profile.id,
                discordUsername: profile.username,
                discordAvatar: avatarUrl,
              });

              if (createResult.success && createResult.data) {
                user = createResult.data;
              }
            }

            if (user) {
              const rolesForToken = {
                ...(user.roles || {}),
                isLocalGamingStore: user.isLocalGamingStore,
                isPatreon: user.isPatreon,
                isShop: user.isShop,
                isTcgSeller: user.isTcgSeller,
              };

              console.log('[JWT Callback] Roles being set in token:', JSON.stringify(rolesForToken, null, 2));

              token.id = user._id;
              token.username = user.username;
              token.discordId = user.discordId;
              token.discordUsername = user.discordUsername;
              token.picture = user.discordAvatar; // Use 'picture' for NextAuth compatibility
              token.country = user.country;
              token.city = user.city;
              token.state = user.state;
              token.roles = rolesForToken;
              if (isNewUser) {
                token.isNewUser = true;
              }
            }
          } else if (token.id && (trigger === 'update' || session)) {
            // Refresh user data when session is updated (e.g., after role changes)
            const userResult = await userService.findById(token.id as string);
            if (userResult.success && userResult.data) {
              const user = userResult.data;
              const rolesForToken = {
                ...(user.roles || {}),
                isLocalGamingStore: user.isLocalGamingStore,
                isPatreon: user.isPatreon,
                isShop: user.isShop,
                isTcgSeller: user.isTcgSeller,
              };
              token.roles = rolesForToken;
              token.username = user.username;
              token.country = user.country;
              token.city = user.city;
              token.state = user.state;
            }
          }
          return token;
    },

    async session({ session, token }) {
        if (session.user) {
            session.user.id = token.id as string;
            session.user.username = token.username as string;
            session.user.discordId = token.discordId as string | undefined;
            session.user.discordUsername = token.discordUsername as string | undefined;
            session.user.image = token.picture as string | undefined; // Set NextAuth's standard image field
            session.user.country = token.country as string | undefined;
            session.user.city = token.city as string | undefined;
            session.user.state = token.state as string | undefined;
            session.user.isNewUser = token.isNewUser as boolean | undefined;
            session.user.roles = token.roles as any;
            session.user.email = undefined;
          }
          return session;
    },
  },
});
