/**
 * Utility functions for client-side cryptography
 * These functions can be used on both client and server
 */

import crypto from "crypto"

/**
 * Hashes a password using SHA-256 with a consistent implementation
 * This ensures the actual password is never sent over the network
 * and that the same hash is generated regardless of environment
 *
 * @param password The user's plain text password
 * @returns A hex string of the hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  // Use the NEXT_PUBLIC_ prefixed environment variable for client access
  const salt = process.env.NEXT_PUBLIC_CLIENT_HASH_SALT
  if (!salt) {
    throw new Error("NEXT_PUBLIC_CLIENT_HASH_SALT is not defined")
  }

  // Combine the password with the salt
  const passwordWithSalt = `${password}:${salt}`

  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    // Browser environment - use Web Crypto API
    const encoder = new TextEncoder()
    const data = encoder.encode(passwordWithSalt)
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    // Ensure lowercase hex output
    return hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toLowerCase()
  } else if (typeof process !== "undefined" && crypto?.createHash) {
    // Node.js environment (should ideally not be called from client code, but good for testing/consistency)
    const hash = crypto.createHash("sha256")
    hash.update(passwordWithSalt)
    return hash.digest("hex").toLowerCase() // Ensure lowercase
  } else {
    // Indicate failure clearly if neither environment is suitable or Web Crypto is missing/disabled
    console.error("Crypto API not available. Cannot hash password securely on the client.")
    throw new Error("Secure hashing not available in this environment.")
  }
}

/**
 * A wrapper around hashPassword that handles potential errors
 */
export async function hashPasswordSafely(password: string): Promise<string> {
  try {
    return await hashPassword(password)
  } catch (error) {
    console.error("Error hashing password:", error)
    return "" // Or some other suitable fallback value
  }
}
