import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. 基本動作テスト
    const checks: Record<string, string> = {};
    checks['basic'] = 'ok';

    // 2. 環境変数チェック
    checks['ANTHROPIC_API_KEY'] = process.env.ANTHROPIC_API_KEY ? `set (${process.env.ANTHROPIC_API_KEY.substring(0, 10)}...)` : 'NOT SET';
    checks['UPSTASH_REDIS_REST_URL'] = process.env.UPSTASH_REDIS_REST_URL ? 'set' : 'NOT SET';

    // 3. Anthropic SDK インポートテスト
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic();
      checks['anthropic_sdk'] = `ok (${typeof client})`;
    } catch (e) {
      checks['anthropic_sdk'] = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }

    return NextResponse.json(checks);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
