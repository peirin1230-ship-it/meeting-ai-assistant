import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, string> = {};

  const models = [
    'claude-sonnet-4-5-20250514',
    'claude-sonnet-4-6-20250514',
    'claude-4-sonnet-20250514',
    'claude-sonnet-4-20250514',
  ];

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();

  for (const model of models) {
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'say ok' }],
      });
      checks[model] = `OK (${msg.model})`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      checks[model] = msg.includes('not_found') ? 'NOT FOUND' : `ERROR: ${msg.substring(0, 80)}`;
    }
  }

  return NextResponse.json(checks);
}
