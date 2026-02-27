// lib/session.ts
import { auth } from "@/auth"; // Import from your new central auth.ts file

/**
 * A robust, unified wrapper to get the session in any server-side context.
 * This function can be safely used in Server Components, API Routes, and Server Actions.
 */
export async function getSession() {
  try {
    const session = await auth(); // This is the new, reliable way to get the session.
    
    if (!session?.user) {
      return null;
    }

    // Transform the official session object into the simplified shape
    // that the rest of your application expects. This ensures backward compatibility.
    return {
      userId: session.user.id,
      username: session.user.username,
      discordUsername: session.user.discordUsername,
      roles: session.user.roles, // Pass along the roles
    };

  } catch (error) {
    console.error("Error getting session in lib/session.ts:", error);
    // In case of an error (e.g., during auth() initialization), return null.
    return null;
  }
}

// Legacy functions removed - use NextAuth instead:
// - createSession() - removed, was no-op
// - deleteSession() - removed, use signOut from @/auth
// - encrypt() - removed, was no-op
// - decrypt() - removed, was no-op
// - getUserFromRequest() - removed, use auth() from @/auth
