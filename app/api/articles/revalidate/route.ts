// app/api/articles/revalidate/route.ts/

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

// We'll use a POST request for this action
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET_TOKEN;
  
  // Get the secret from the request header for better security
  const requestSecret = request.headers.get('x-revalidate-secret');
  
  // Get the path to revalidate from the request body
  const body = await request.json();
  const path = body.path;

  if (requestSecret !== secret) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  if (!path) {
    return NextResponse.json({ message: 'Path to revalidate is required' }, { status: 400 });
  }

  try {
    revalidatePath(path);
    console.log(`Revalidated path: ${path}`);
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    console.error(`Error revalidating path: ${path}`, err);
    return NextResponse.json({ message: 'Error revalidating', error: (err as Error).message }, { status: 500 });
  }
}