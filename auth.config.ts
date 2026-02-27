// auth.config.ts

import type { NextAuthConfig } from 'next-auth';

// This is the EDGE-SAFE configuration.
export const authConfig = {
  trustHost: true, // Required for NextAuth v5
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  providers: [
  ],
} satisfies NextAuthConfig;