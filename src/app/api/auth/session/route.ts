import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  const session = await decrypt(sessionCookie);

  if (!session) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: session });
}
