import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth';

export async function POST() {
  try {
    await clearSession('admin_session');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
