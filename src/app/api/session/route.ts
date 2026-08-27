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

    // 衝突回避: NX（存在しないときだけ書き込む）で確保できるまでリトライする。
    // get→set の2段階だと、その隙に別リクエストが同じコードを取る可能性がある。
    let code: string | null = null;

    for (let i = 0; i < 5; i++) {
      const candidate = generateSessionCode();
      const session: SessionData = {
        id: candidate,
        createdAt: new Date().toISOString(),
        meetingType,
        respondentId,
        segments: [],
        segmentVersion: 0,
        interimText: '',
        interimUpdatedAt: '',
        isActive: true,
      };

      const stored = await getRedis().set(sessionKey(candidate), JSON.stringify(session), {
        ex: SESSION_TTL_SECONDS,
        nx: true,
      });

      if (stored) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      return NextResponse.json(
        { error: 'セッションコードを発行できませんでした。もう一度お試しください。' },
        { status: 503 },
      );
    }

    return NextResponse.json({ sessionCode: code });
  } catch (error) {
    console.error('Session create error:', error);
    return NextResponse.json(
      { error: 'セッション作成に失敗しました' },
      { status: 500 }
    );
  }
}
