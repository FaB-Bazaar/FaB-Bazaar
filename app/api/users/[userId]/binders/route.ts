// app/api/users/[userId]/binders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { isDevelopmentWithLocalIPs } from '@/lib/security'
import { binderService } from '@/lib/services'

export const dynamic = 'force-dynamic';

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function rateLimit(ip: string, limit: number = 30, windowMs: number = 60000): boolean {
  const now = Date.now()
  const key = ip
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

function isBot(userAgent: string): boolean {
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
    /baiduspider/i, /yandexbot/i, /facebookexternalhit/i,
    /twitterbot/i, /linkedinbot/i, /whatsapp/i,
    /telegram/i, /skype/i, /slack/i, /discord/i,
    /curl/i, /wget/i, /python/i, /requests/i,
    /postman/i, /insomnia/i, /httpie/i
  ]
  return botPatterns.some(pattern => pattern.test(userAgent))
}

function isValidBrowser(userAgent: string): boolean {
  const validBrowsers = [
    /chrome/i, /firefox/i, /safari/i, /edge/i, /opera/i
  ]
  return validBrowsers.some(pattern => pattern.test(userAgent))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || ''
    const referer = headersList.get('referer') || ''
    const forwardedFor = headersList.get('x-forwarded-for')
    const realIp = headersList.get('x-real-ip')
    const ip = forwardedFor?.split(',')[0] || realIp || 'unknown'

    // Bot detection
    if (isBot(userAgent) || !isValidBrowser(userAgent)) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Require referer from same domain (prevents direct API access)
    const requestUrl = new URL(request.url)
    if (referer) {
      const refererUrl = new URL(referer)

      if (!isDevelopmentWithLocalIPs(requestUrl, refererUrl) && refererUrl.hostname !== requestUrl.hostname) {
        return NextResponse.json(
          { success: false, error: 'Invalid referer' },
          { status: 403 }
        )
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Direct access not allowed' },
        { status: 403 }
      )
    }

    // Rate limiting - slightly higher for binder data
    if (!rateLimit(ip, 30, 60000)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const { userId } = await params
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('includeStats') === 'true'
    const includeShowcase = searchParams.get('includeShowcase') === 'true'

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      )
    }

    // Use service layer for all cases (with or without stats/showcase)
    let binders;

    if (includeStats || includeShowcase) {
      // Use getUserBindersWithStats for full data including stats and showcaseCards
      const result = await binderService.getUserBindersWithStats(userId);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to fetch binders' },
          { status: 500 }
        );
      }

      // Filter to only public binders (service returns all binders including private/unlisted)
      binders = result.data.filter(
        (b) => b.isPublic && b.visibility?.level === 'public'
      );
    } else {
      // Use listBinders for simple case without stats
      const result = await binderService.listBinders(
        {
          userId,
          isPublic: true,
          archived: false,
        },
        {
          sort: { updatedAt: -1 },
        }
      );

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to fetch binders' },
          { status: 500 }
        );
      }

      binders = result.data;
    }

    // Format response based on includeStats/includeShowcase flags
    const formattedBinders = binders.map((binder) => {
      const formatted: any = {
        _id: binder._id,
        name: binder.name,
        description: binder.description || null,
        tags: binder.tags || [],
        slug: binder.slug || null,
        isOnHand: binder.isOnHand || false,
        visibility: binder.visibility || { level: 'public' },
        isPublic: binder.isPublic !== false,
        updatedAt: binder.updatedAt,
      };

      if (includeStats && 'stats' in binder && binder.stats) {
        const stats = binder.stats;
        formatted.totalQuantity = stats.totalQuantity || 0;
        formatted.quantityForTrade = stats.quantityForTrade || 0;
        formatted.quantityNotForTrade = stats.quantityNotForTrade || 0;
        // This endpoint is anonymous + cached, so there is no "owner viewer":
        // hideValue strips value aggregates unconditionally. Owners see values
        // through the authenticated /api/binders surfaces.
        if (!(binder as any).hideValue) {
          formatted.totalValue = stats.totalValue || {
            tcg_market: 0,
            tcg_low: 0,
            tcg_mid: 0,
            tcg_high: 0,
          };
          formatted.valueForTrade = stats.valueForTrade || {
            tcg_market: 0,
            tcg_low: 0,
            tcg_mid: 0,
            tcg_high: 0,
          };
          formatted.valueNotForTrade = stats.valueNotForTrade || {
            tcg_market: 0,
            tcg_low: 0,
            tcg_mid: 0,
            tcg_high: 0,
          };
          formatted.total_value = stats.totalValue?.tcg_low || 0;
        }
        formatted.rarityCounts = stats.rarityCounts || {};
        formatted.rarityCountsForTrade = stats.rarityCountsForTrade || {};
        formatted.rarityCountsNotForTrade = stats.rarityCountsNotForTrade || {};
        formatted.cardCount = stats.totalQuantity || 0;
        formatted.totalCards = stats.totalQuantity || 0;
      }

      if (includeShowcase && 'showcaseCards' in binder && binder.showcaseCards) {
        formatted.showcaseCards = binder.showcaseCards;
      }

      return formatted;
    })

    return NextResponse.json(
      {
        success: true,
        binders: formattedBinders,
        meta: {
          count: formattedBinders.length,
          includeStats,
          includeShowcase,
          userId: userId
        }
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY'
        }
      }
    )

  } catch (error) {
    console.error('User binders API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
