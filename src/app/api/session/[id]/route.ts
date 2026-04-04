import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { sessionKey } from '@/lib/session';
import type { SessionData } from '@/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const raw = await getRedis().get<string>(sessionKey(id));

    if (!raw) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    const session: SessionData = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return NextResponse.json(session);
  } catch (error) {
    console.error('Session get error:', error);
    return NextResponse.json(
      { error: 'セッション取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const raw = await getRedis().get<string>(sessionKey(id));

    if (!raw) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    const session: SessionData = typeof raw === 'string' ? JSON.parse(raw) : raw;
    session.isActive = false;

    await getRedis().set(sessionKey(id), JSON.stringify(session), { ex: 300 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Session delete error:', error);
    return NextResponse.json(
      { error: 'セッション終了に失敗しました' },
      { status: 500 }
    );
  }
}
