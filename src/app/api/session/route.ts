import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { generateSessionCode, sessionKey } from '@/lib/session';
import { SESSION_TTL_SECONDS } from '@/lib/constants';
import type { SessionData, MeetingType, RespondentId } from '@/types';

export async function POST(request: Request) {
  try {
    const { meetingType, respondentId } = (await request.json()) as {
      meetingType: MeetingType;
      respondentId: RespondentId;
    };

    // 衝突回避: 最大3回リトライ
    let code = '';
    for (let i = 0; i < 3; i++) {
      code = generateSessionCode();
      const existing = await getRedis().get(sessionKey(code));
      if (!existing) break;
    }

    const session: SessionData = {
      id: code,
      createdAt: new Date().toISOString(),
      meetingType,
      respondentId,
      segments: [],
      segmentVersion: 0,
      interimText: '',
      interimUpdatedAt: '',
      isActive: true,
    };

    await getRedis().set(sessionKey(code), JSON.stringify(session), {
      ex: SESSION_TTL_SECONDS,
    });

    return NextResponse.json({ sessionCode: code });
  } catch (error) {
    console.error('Session create error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'セッション作成に失敗しました', detail: message },
      { status: 500 }
    );
  }
}
