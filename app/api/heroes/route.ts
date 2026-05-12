import { NextRequest, NextResponse } from 'next/server';
import { printingsService } from '@/lib/services';
import { HERO_FORMATS, type HeroFormat } from '@/lib/services/contracts/IPrintingsService';

export async function GET(request: NextRequest) {
  const formatParam = new URL(request.url).searchParams.get('format');

  if (formatParam !== null && !HERO_FORMATS.includes(formatParam as HeroFormat)) {
    return NextResponse.json({ error: `Invalid format: ${formatParam}` }, { status: 400 });
  }

  const result = formatParam
    ? await printingsService.listHeroCards({ legalIn: formatParam as HeroFormat })
    : await printingsService.listHeroCards();

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
