import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth';
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    await clearSession('admin_session');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Admin logout error", { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
