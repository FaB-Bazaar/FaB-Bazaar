// types/next-auth.d.ts

import type { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

// Define a single, comprehensive structure for all roles and statuses
interface UserRoles {
  isAdmin?: boolean
  isSuperAdmin?: boolean
  isContentCreator?: boolean
  canManageLocations?: boolean
  canImportCardCollections?: boolean
  // Add the previously missing top-level booleans here
  isLocalGamingStore?: boolean
  isMetafySupporter?: boolean
  isCurator?: boolean
  isShop?: boolean
  isTcgSeller?: boolean
  metafySupporterTier?: 'free' | 'paid'
  volzarAccess?: boolean
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken` */
  interface JWT {
    id: string
    username: string
    discordId?: string
    discordUsername?: string
    picture?: string
    isNewUser?: boolean
    roles?: UserRoles // Uses the new comprehensive interface
  }
}

declare module "next-auth" {
  /** Returned by `useSession`, `getSession`, etc. */
  interface Session {
    user: {
      id: string
      username: string
      discordId?: string
      discordUsername?: string
      isNewUser?: boolean
      roles?: UserRoles // Uses the new comprehensive interface
    } & DefaultSession["user"]
  }

  interface User {
    username?: string
    discordId?: string
    discordUsername?: string
  }
}

// import type { DefaultSession } from "next-auth"

// declare module "next-auth" {
//   /**
//    * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
//    */
//   interface Session {
//     user: {
//       /** The user's id */
//       id: string
//       /** The user's username */
//       username?: string
//       /** The user's Discord ID */
//       discordId?: string
//       /** The user's Discord username */
//       discordUsername?: string
//       roles?: {
//         isAdmin?: boolean
//         canManageLocations?: boolean
//       }
//     } & DefaultSession["user"]
//   }

//   interface User {
//     username?: string
//     discordId?: string
//     discordUsername?: string
//   }
// }

// declare module "next-auth/jwt" {
//   /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
//   interface JWT {
//     /** The user's id */
//     id?: string
//     /** The user's username */
//     username?: string
//     /** The user's Discord ID */
//     discordId?: string
//     /** The user's Discord username */
//     discordUsername?: string
//   }
// }
