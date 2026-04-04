import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, string> = {};

  // 1. prompts のインポート
  try {
    const { getSystemPrompt, getUserMessage } = await import('@/lib/prompts');
    const sp = getSystemPrompt('takamatsu', 'general');
    checks['prompts'] = `ok (${sp.length} chars)`;
    const um = getUserMessage('テスト', 'early');
    checks['userMessage'] = `ok (${um.length} chars)`;
  } catch (e) {
    checks['prompts'] = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 2. Anthropic SDK + 実際のAPI呼び出し
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Hi, reply with just "ok"' }],
    });
    checks['anthropic_api'] = `ok (${msg.content[0].type})`;
  } catch (e) {
    checks['anthropic_api'] = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(checks);
}
