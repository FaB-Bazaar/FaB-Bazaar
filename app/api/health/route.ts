import { NextResponse } from "next/server"
import { db } from "@/lib/postgres/db"
import { sql } from "drizzle-orm"
import { getRedisClient } from "@/lib/redis"

export async function GET() {
  const checks: Record<string, string> = {}
  let healthy = true

  // Check Postgres
  try {
    await db.execute(sql`SELECT 1`)
    checks.postgres = "ok"
  } catch (e) {
    checks.postgres = "error"
    healthy = false
  }

  // Check Redis
  try {
    const redis = getRedisClient()
    if (redis) {
      await redis.ping()
      checks.redis = "ok"
    } else {
      checks.redis = "not configured"
    }
  } catch (e) {
    checks.redis = "error"
    healthy = false
  }

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks },
    { status: healthy ? 200 : 503 }
  )
}
