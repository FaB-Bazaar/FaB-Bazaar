// app/(og)/api/og/route.tsx
import { ImageResponse } from 'next/og';
import { NextRequest, NextResponse } from 'next/server';

// This line is important. It tells Vercel to run this function on the Edge, which is fast.
export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Get the title and subtitle from the URL, with fallbacks.
  const title = searchParams.get('title') || 'FaB Bazaar';
  const subtitle = searchParams.get('subtitle') || 'The Ultimate Flesh and Blood Companion';

  const imageResponse = new ImageResponse(
    (
      // Use Tailwind CSS to style your image like it's a React component.
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a', // A dark slate background
          color: 'white',
          fontFamily: '"Inter", sans-serif',
          padding: '40px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          {/* You can even include your logo, though it requires loading the image data */}
          <span style={{ fontSize: 30, fontWeight: 700 }}>FaB Bazaar</span>
        </div>
        <h1
          style={{
            fontSize: 60,
            fontWeight: 800,
            textAlign: 'center',
            lineHeight: 1.1,
            padding: '0 50px',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 30,
              color: '#94a3b8', // A lighter slate color
              textAlign: 'center',
              padding: '0 50px',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    ),
    {
      // The standard size for Open Graph images.
      width: 1200,
      height: 630,
    }
  );

  // Add cache headers to reduce OG endpoint invocations
  return new NextResponse(imageResponse.body, {
    headers: {
      'Content-Type': 'image/png',
      // Cache for 24 hours, serve stale content for 48 hours while revalidating
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800',
    },
  });
}