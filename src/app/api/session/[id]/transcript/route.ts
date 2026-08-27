import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { sessionKey } from '@/lib/session';
import { SESSION_TTL_SECONDS, MAX_SESSION_SEGMENTS } from '@/lib/constants';
import type { SessionData, SessionSegment } from '@/types';

interface TranscriptUpdate {
  segments?: SessionSegment[];
  interimText?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { segments, interimText } = (await request.json()) as TranscriptUpdate;

    const raw = await getRedis().get<string>(sessionKey(id));
    if (!raw) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    const session: SessionData = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (!session.isActive) {
      return NextResponse.json(
        { error: 'セッションは終了しています' },
        { status: 410 }
      );
    }

    // 新しい確定セグメントを追加
    if (segments && segments.length > 0) {
      session.segments.push(...segments);

      // segmentVersion は「これまでに追加されたセグメントの総数」。
      // viewer 側はこの差分から新着件数を割り出すため、
      // 追加件数ぶん増やさないとセグメントを取りこぼす。
      session.segmentVersion += segments.length;

      // 長時間の会議で値が肥大化して書き込みが失敗しないよう古い分を捨てる。
      // segmentVersion は総数のままなので、viewer の差分計算は壊れない。
      if (session.segments.length > MAX_SESSION_SEGMENTS) {
        session.segments = session.segments.slice(-MAX_SESSION_SEGMENTS);
      }
    }

    // interim テキストを更新
    if (interimText !== undefined) {
      session.interimText = interimText;
      session.interimUpdatedAt = new Date().toISOString();
    }

    await getRedis().set(sessionKey(id), JSON.stringify(session), {
      ex: SESSION_TTL_SECONDS,
    });

    return NextResponse.json({
      ok: true,
      segmentVersion: session.segmentVersion,
    });
  } catch (error) {
    console.error('Transcript update error:', error);
    return NextResponse.json(
      { error: '文字起こし送信に失敗しました' },
      { status: 500 }
    );
  }
}
