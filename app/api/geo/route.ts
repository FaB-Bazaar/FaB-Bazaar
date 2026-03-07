import { NextRequest, NextResponse } from 'next/server';
import { locationService } from '@/lib/services';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const countryCode = searchParams.get('countryCode');

  if (countryCode) {
    const result = await locationService.getStates(countryCode);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ success: true, data: result.data });
  }

  const result = await locationService.getCountries();
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data });
}
