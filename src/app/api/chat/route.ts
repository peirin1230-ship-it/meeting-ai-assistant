import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { ChatRequest } from '@/types';
import { getSystemPrompt, getUserMessage } from '@/lib/prompts';

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic();
  }
  return _anthropic;
}

// レート制限: 1分あたり20リクエスト
const requestTimes: number[] = [];
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(): boolean {
  const now = Date.now();
  while (requestTimes.length > 0 && requestTimes[0] < now - RATE_WINDOW_MS) {
    requestTimes.shift();
  }
  if (requestTimes.length >= RATE_LIMIT) return false;
  requestTimes.push(now);
  return true;
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit()) {
    return NextResponse.json({ error: 'レート制限に達しました。少し待ってから再試行してください。' }, { status: 429 });
  }

  try {
    const body = (await req.json()) as ChatRequest;
    const { transcript, meetingType, respondentId, previousContext, previousInsight, meetingPhase } = body;

    if (!transcript?.trim()) {
      return NextResponse.json({ error: '文字起こしテキストが必要です' }, { status: 400 });
    }

    const systemPrompt = getSystemPrompt(respondentId ?? 'takamatsu', meetingType ?? 'general');
    const userMessage = getUserMessage(transcript, meetingPhase ?? 'early', previousContext, previousInsight);

    const stream = await getAnthropic().messages.stream({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    // SSEストリーミングレスポンス
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json(
      { error: `AI応答の生成に失敗しました: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
