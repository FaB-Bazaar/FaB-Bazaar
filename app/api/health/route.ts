import { NextResponse } from "next/server"
import { db } from "@/lib/postgres/db"
import { sql } from "drizzle-orm"
import { getReadyRedisClient } from "@/lib/redis"

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
  // getReadyRedisClient waits out a first connect (fresh process) but never a
  // reconnect — so the first probe after a deploy isn't a false "degraded".
  try {
    if (!process.env.REDIS_URL) {
      checks.redis = "not configured"
    } else {
      const redis = await getReadyRedisClient()
      if (!redis) throw new Error("Redis unavailable")
      await redis.ping()
      checks.redis = "ok"
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
