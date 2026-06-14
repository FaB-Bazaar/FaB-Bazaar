// app/api/users/profile/[username]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic';

// In-memory cache for username -> user lookups
const userCache = new Map<string, {
  user: any;
  timestamp: number;
  expiry: number;
}>()

// Cache settings
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const CACHE_CLEANUP_INTERVAL = 60 * 60 * 1000; // Clean up every hour

// Periodic cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userCache.entries()) {
    if (now > value.expiry) {
      userCache.delete(key);
    }
  }
}, CACHE_CLEANUP_INTERVAL);

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function rateLimit(ip: string, limit: number = 10, windowMs: number = 60000): boolean {
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

async function getUserFromCache(username: string): Promise<any | null> {
  const cacheKey = username.toLowerCase();
  const cached = userCache.get(cacheKey);
  
  if (cached && Date.now() < cached.expiry) {
    console.log(`Cache HIT for username: ${username}`);
    return cached.user;
  }
  
  console.log(`Cache MISS for username: ${username}`);
  return null;
}

async function setUserCache(username: string, user: any): Promise<void> {
  const cacheKey = username.toLowerCase();
  const now = Date.now();
  
  userCache.set(cacheKey, {
    user,
    timestamp: now,
    expiry: now + CACHE_DURATION
  });
  
  console.log(`Cached user: ${username}, total cache size: ${userCache.size}`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
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
      
      // Allow local IPs and Docker (0.0.0.0 binding) regardless of NODE_ENV
      const isDevelopmentWithLocalIPs = (
        requestUrl.hostname === '0.0.0.0' ||
        requestUrl.hostname.match(/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.0\.0\.1|localhost)/) !== null ||
        refererUrl.hostname.match(/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.0\.0\.1|localhost)/) !== null
      )
      
      // In production, require exact hostname match
      // In development with local IPs, be more permissive
      if (!isDevelopmentWithLocalIPs && refererUrl.hostname !== requestUrl.hostname) {
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

    // Rate limiting
    if (!rateLimit(ip, 20, 60000)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const { username } = await params

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Username required' },
        { status: 400 }
      )
    }

    // Sanitize username
    const sanitizedUsername = username.trim().toLowerCase()
    if (!/^[a-zA-Z0-9_.\-]+$/.test(sanitizedUsername)) {
      return NextResponse.json(
        { success: false, error: 'Invalid username format' },
        { status: 400 }
      )
    }

    // Try to get user from cache first
    let cachedData = await getUserFromCache(sanitizedUsername);

    if (!cachedData) {
      // Cache miss - fetch from service
      const { userService } = await import('@/lib/services');
      const result = await userService.getUserProfileWithStats(sanitizedUsername);

      if (!result.success || !result.data) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }

      // Transform service result to cache format
      cachedData = {
        _id: result.data._id,
        username: result.data.username,
        discordUsername: result.data.discordUsername,
        discordAvatar: result.data.discordAvatar,
        createdAt: result.data.createdAt,
        binderStats: result.data.binderStats,
        wantsCount: result.data.wantsCount
      };

      // Cache the data for future requests
      await setUserCache(sanitizedUsername, cachedData);
    }

    // Extract data from cache
    const user = {
      _id: cachedData._id,
      username: cachedData.username,
      discordUsername: cachedData.discordUsername,
      discordAvatar: cachedData.discordAvatar,
      createdAt: cachedData.createdAt
    };

    const binderStats = {
      totalBinders: cachedData.binderStats?.public || 0,
      totalCards: 0, // Not currently tracked in stats
      totalValue: 0 // Not currently tracked in stats
    };

    const wantsCount = cachedData.wantsCount || 0
    
    // Further sanitize response data
    const sanitizedUser = {
      _id: user._id.toString(),
      username: user.username,
      discordUsername: user.discordUsername || null,
      city: user.city || null,
      state: user.state || null,
      country: user.country || null,
      createdAt: user.createdAt.toISOString(),
      image: user.discordAvatar || null
    }

    return NextResponse.json(
      { 
        success: true, 
        user: sanitizedUser,
        stats: {
          totalBinders: binderStats.totalBinders,
          totalCards: binderStats.totalCards,
          totalValue: Math.round((binderStats.totalValue || 0) * 100) / 100,
          totalWants: wantsCount
        },
        meta: {
          cached: user !== null, // Indicates if user data came from cache
          cacheSize: userCache.size
        }
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300', // 5 minutes
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY'
        }
      }
    )

  } catch (error) {
    console.error('Profile API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
// // app/api/users/profile/[username]/route.ts
// import { NextRequest, NextResponse } from 'next/server'
// import { headers } from 'next/headers'
// import connectToDatabase from '@/lib/mongodb'
// import mongoose from 'mongoose'

// export const dynamic = 'force-dynamic';

// // In-memory cache for username -> user lookups
// const userCache = new Map<string, {
//   user: any;
//   timestamp: number;
//   expiry: number;
// }>()

// // Cache settings
// const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
// const CACHE_CLEANUP_INTERVAL = 60 * 60 * 1000; // Clean up every hour

// // Periodic cache cleanup
// setInterval(() => {
//   const now = Date.now();
//   for (const [key, value] of userCache.entries()) {
//     if (now > value.expiry) {
//       userCache.delete(key);
//     }
//   }
// }, CACHE_CLEANUP_INTERVAL);

// const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// function rateLimit(ip: string, limit: number = 10, windowMs: number = 60000): boolean {
//   const now = Date.now()
//   const key = ip
//   const record = rateLimitStore.get(key)
  
//   if (!record || now > record.resetTime) {
//     rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
//     return true
//   }
  
//   if (record.count >= limit) {
//     return false
//   }
  
//   record.count++
//   return true
// }

// function isBot(userAgent: string): boolean {
//   const botPatterns = [
//     /bot/i, /crawler/i, /spider/i, /scraper/i,
//     /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
//     /baiduspider/i, /yandexbot/i, /facebookexternalhit/i,
//     /twitterbot/i, /linkedinbot/i, /whatsapp/i,
//     /telegram/i, /skype/i, /slack/i, /discord/i,
//     /curl/i, /wget/i, /python/i, /requests/i,
//     /postman/i, /insomnia/i, /httpie/i
//   ]
//   return botPatterns.some(pattern => pattern.test(userAgent))
// }

// function isValidBrowser(userAgent: string): boolean {
//   const validBrowsers = [
//     /chrome/i, /firefox/i, /safari/i, /edge/i, /opera/i
//   ]
//   return validBrowsers.some(pattern => pattern.test(userAgent))
// }

// async function getUserFromCache(username: string): Promise<any | null> {
//   const cacheKey = username.toLowerCase();
//   const cached = userCache.get(cacheKey);
  
//   if (cached && Date.now() < cached.expiry) {
//     console.log(`Cache HIT for username: ${username}`);
//     return cached.user;
//   }
  
//   console.log(`Cache MISS for username: ${username}`);
//   return null;
// }

// async function setUserCache(username: string, user: any): Promise<void> {
//   const cacheKey = username.toLowerCase();
//   const now = Date.now();
  
//   userCache.set(cacheKey, {
//     user,
//     timestamp: now,
//     expiry: now + CACHE_DURATION
//   });
  
//   console.log(`Cached user: ${username}, total cache size: ${userCache.size}`);
// }

// // export async function GET(
// //   request: NextRequest,
// //   { params }: { params: Promise<{ username: string }> } 
// // ) {
// //   try {
// //     const headersList = await headers()
// //     const userAgent = headersList.get('user-agent') || ''
// //     const referer = headersList.get('referer') || ''
// //     const forwardedFor = headersList.get('x-forwarded-for')
// //     const realIp = headersList.get('x-real-ip')
// //     const ip = forwardedFor?.split(',')[0] || realIp || 'unknown'

// //     // Bot detection
// //     if (isBot(userAgent) || !isValidBrowser(userAgent)) {
// //       return NextResponse.json(
// //         { success: false, error: 'Access denied' },
// //         { status: 403 }
// //       )
// //     }

// //     // Require referer from same domain (prevents direct API access)
// //     const requestUrl = new URL(request.url)
// //     if (referer) {
// //       const refererUrl = new URL(referer)
// //       if (refererUrl.hostname !== requestUrl.hostname) {
// //         return NextResponse.json(
// //           { success: false, error: 'Invalid referer' },
// //           { status: 403 }
// //         )
// //       }
// //     } else {
// //       return NextResponse.json(
// //         { success: false, error: 'Direct access not allowed' },
// //         { status: 403 }
// //       )
// //     }

// export async function GET(
//   request: NextRequest,
//   { params }: { params: Promise<{ username: string }> }
// ) {
//   try {
//     const headersList = await headers()
//     const userAgent = headersList.get('user-agent') || ''
//     const referer = headersList.get('referer') || ''
//     const forwardedFor = headersList.get('x-forwarded-for')
//     const realIp = headersList.get('x-real-ip')
//     const ip = forwardedFor?.split(',')[0] || realIp || 'unknown'

//     // DEBUG: Log the values
//     console.log('DEBUG - User Agent:', userAgent)
//     console.log('DEBUG - Referer:', referer)
//     console.log('DEBUG - IP:', ip)
//     console.log('DEBUG - isBot result:', isBot(userAgent))
//     console.log('DEBUG - isValidBrowser result:', isValidBrowser(userAgent))

//     // Bot detection
//     if (isBot(userAgent) || !isValidBrowser(userAgent)) {
//       console.log('BLOCKED: Bot detection triggered')
//       return NextResponse.json(
//         { success: false, error: 'Access denied' },
//         { status: 403 }
//       )
//     }

//     // Require referer from same domain (prevents direct API access)
//     const requestUrl = new URL(request.url)
//     console.log('DEBUG - Request hostname:', requestUrl.hostname)
    
//     if (referer) {
//       const refererUrl = new URL(referer)
//       console.log('DEBUG - Referer hostname:', refererUrl.hostname)
//       if (refererUrl.hostname !== requestUrl.hostname) {
//         console.log('BLOCKED: Invalid referer hostname')
//         return NextResponse.json(
//           { success: false, error: 'Invalid referer' },
//           { status: 403 }
//         )
//       }
//     } else {
//       console.log('BLOCKED: No referer provided')
//       return NextResponse.json(
//         { success: false, error: 'Direct access not allowed' },
//         { status: 403 }
//       )
//     }

//     // Rate limiting
//     if (!rateLimit(ip, 20, 60000)) {
//       return NextResponse.json(
//         { success: false, error: 'Rate limit exceeded' },
//         { status: 429 }
//       )
//     }

//     const { username } = await params

//     if (!username || typeof username !== 'string') {
//       return NextResponse.json(
//         { success: false, error: 'Username required' },
//         { status: 400 }
//       )
//     }

//     // Sanitize username
//     const sanitizedUsername = username.trim().toLowerCase()
//     if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedUsername)) {
//       return NextResponse.json(
//         { success: false, error: 'Invalid username format' },
//         { status: 400 }
//       )
//     }

//     // Try to get user from cache first
//     let user = await getUserFromCache(sanitizedUsername);

//     if (!user) {
//       // Cache miss - fetch from database
//       await connectToDatabase()
//       const { db } = await connectToDatabase()

//       user = await db.collection('users').findOne(
//         { 
//           username: { 
//             $regex: `^${sanitizedUsername}$`,
//             $options: 'i'
//           } 
//         },
//         {
//           projection: {
//             _id: 1,
//             username: 1,
//             discordUsername: 1,
//             discordId: 1,
//             city: 1,
//             state: 1,
//             country: 1,
//             createdAt: 1,
//             image: 1
//           }
//         }
//       );

//       if (!user) {
//         return NextResponse.json(
//           { success: false, error: 'User not found' },
//           { status: 404 }
//         )
//       }

//       // Cache the user for future requests
//       await setUserCache(sanitizedUsername, user);
//     }

//     // Get aggregated stats from public binders using the new stats structure
//     await connectToDatabase()
//     const { db } = await connectToDatabase()

//     const binderStatsAggregation = await db.collection('binders').aggregate([
//       {
//         $match: {
//           userId: user._id,
//           'visibility.level': 'public',
//           archived: { $ne: true }
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           totalBinders: { $sum: 1 },
//           // Use new totalQuantity field primarily, fallback to old method only if needed
//           totalCards: { 
//             $sum: { 
//               $ifNull: ['$totalQuantity', 0] 
//             } 
//           },
//           // Use new totalValue.tcg_low field primarily, fallback to old total_value only if needed
//           totalValue: { 
//             $sum: { 
//               $ifNull: ['$totalValue.tcg_low', 0] 
//             } 
//           }
//         }
//       }
//     ]).toArray();

//     const binderStats = binderStatsAggregation[0] || { 
//       totalBinders: 0, 
//       totalCards: 0, 
//       totalValue: 0 
//     };

//     // Get wants count
//     const wantsDoc = await db.collection('wantslists').findOne(
//       { userId: user._id },
//       { projection: { cards: 1 } }
//     )
        
//     // If not found, try with ObjectId conversion just in case
//     let wantsDocAlt = null
//     if (!wantsDoc) {
//       try {
//         wantsDocAlt = await db.collection('wantslists').findOne(
//           { userId: new mongoose.Types.ObjectId(user._id) },
//           { projection: { cards: 1 } }
//         )
//       } catch (err) {
//         console.error('❌ Error casting user._id to ObjectId:', err)
//       }
//     }
    
//     const finalDoc = wantsDoc || wantsDocAlt
//     const wantsCount = finalDoc?.cards?.length ?? 0
    
//     // Further sanitize response data
//     const sanitizedUser = {
//       _id: user._id.toString(),
//       username: user.username,
//       discordUsername: user.discordUsername || null,
//       discordId: user.discordId || null,
//       city: user.city || null,
//       state: user.state || null,
//       country: user.country || null,
//       createdAt: user.createdAt.toISOString(),
//       image: user.image || null
//     }

//     return NextResponse.json(
//       { 
//         success: true, 
//         user: sanitizedUser,
//         stats: {
//           totalBinders: binderStats.totalBinders,
//           totalCards: binderStats.totalCards,
//           totalValue: Math.round((binderStats.totalValue || 0) * 100) / 100,
//           totalWants: wantsCount
//         },
//         meta: {
//           cached: user !== null, // Indicates if user data came from cache
//           cacheSize: userCache.size
//         }
//       },
//       { 
//         status: 200,
//         headers: {
//           'Cache-Control': 'public, max-age=300', // 5 minutes
//           'X-Content-Type-Options': 'nosniff',
//           'X-Frame-Options': 'DENY'
//         }
//       }
//     )

//   } catch (error) {
//     console.error('Profile API error:', error)
//     return NextResponse.json(
//       { success: false, error: 'Internal server error' },
//       { status: 500 }
//     )
//   }
// }