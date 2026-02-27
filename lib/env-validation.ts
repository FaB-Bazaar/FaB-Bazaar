/**
 * Validates that all required environment variables are present
 * This should be called early in the application startup
 */
export function validateEnvironmentVariables() {
  const requiredVariables = [
    "MONGODB_URI",
    "JWT_SECRET",
    "NEXT_PUBLIC_SOCKET_URL",
    "DISCORD_INVITE_CODE",
    "DISCORD_GUILD_ID",
    "NEXT_PUBLIC_APP_URL",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "DISCORD_PUBLIC_KEY",
    "DISCORD_BOT_TOKEN",
    "EMAIL_ENCRYPTION_KEY",
    "MONGODB_DB",
    "CRON_SECRET",
  ]

  const missingVariables = requiredVariables.filter(
    (variable) => typeof process.env[variable] === "undefined" || process.env[variable] === "",
  )

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(", ")}\n` +
        "Make sure these are set in your .env file or in your deployment environment.",
    )
  }
}
