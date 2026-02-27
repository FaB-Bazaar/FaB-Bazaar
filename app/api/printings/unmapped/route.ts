// // app/api/printings/unmapped/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { fabPrintingsSearch } from '@/lib/fab-printings-search';

// export async function GET(request: NextRequest) {
//   try {
//     const { searchParams } = new URL(request.url);
    
//     const options = {
//       hasProductId: searchParams.get('hasProductId') === 'true' ? true : undefined,
//       sets: searchParams.get('sets')?.split(',').map(s => s.trim()),
//       limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
//     };
    
//     const result = await fabPrintingsSearch.searchUnpricedPrintings(options);
    
//     return NextResponse.json({
//       success: true,
//       data: result
//     });
    
//   } catch (error) {
//     console.error('Unmapped printings search error:', error);
//     return NextResponse.json({
//       success: false,
//       error: error instanceof Error ? error.message : 'Unknown error'
//     }, { status: 500 });
//   }
// }