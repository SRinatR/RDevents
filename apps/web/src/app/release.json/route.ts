import { NextResponse } from 'next/server';
import { getWebReleasePayload } from '@/lib/release';

export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json(getWebReleasePayload(), {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}