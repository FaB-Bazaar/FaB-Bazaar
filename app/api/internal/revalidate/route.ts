import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (req.headers.get('x-api-key') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { tag?: string; tags?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const tags = Array.isArray(body.tags) ? body.tags : body.tag ? [body.tag] : [];
  if (tags.length === 0) {
    return NextResponse.json({ error: 'tag or tags is required' }, { status: 400 });
  }

  for (const tag of tags) {
    revalidateTag(tag);
  }

  return NextResponse.json({ success: true, revalidated: tags });
}
