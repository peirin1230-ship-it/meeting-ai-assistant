import { NextRequest, NextResponse } from 'next/server';
import type { ChatRequest } from '@/types';
import { getSystemPrompt, getUserMessage } from '@/lib/prompts';
import { encodeSSE, type ChatStreamEvent } from '@/lib/stream-protocol';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS, RATE_LIMIT_PER_MINUTE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// ============================================================
// レート制限（IPごと・1分あたり）
// ※サーバーレスではインスタンスごとの best-effort。
//   厳密な制限が必要ならRedis等の共有ストアに移すこと。
// ============================================================

const RATE_WINDOW_MS = 60_000;
const requestLog = new Map<string, number[]>();

function getClientKey(req: NextRequest): string {
  // Vercel等のプロキシ配下では x-forwarded-for の先頭が実クライアント
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;

  // 古いエントリを掃除（Mapが際限なく育つのを防ぐ）
  for (const [k, times] of requestLog) {
    const alive = times.filter((t) => t >= cutoff);
    if (alive.length === 0) requestLog.delete(k);
    else requestLog.set(k, alive);
  }

  const times = requestLog.get(key) ?? [];
  if (times.length >= RATE_LIMIT_PER_MINUTE) return false;

  times.push(now);
  requestLog.set(key, times);
  return true;
}

// ============================================================

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getClientKey(req))) {
    return NextResponse.json(
      { error: 'レート制限に達しました。少し待ってから再試行してください。' },
      { status: 429 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY が設定されていません。環境変数を確認してください。' },
      { status: 500 },
    );
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: 'リクエストの形式が不正です' }, { status: 400 });
  }

  const { transcript, meetingType, respondentId, previousContext, previousInsight, meetingPhase } = body;

  if (!transcript?.trim()) {
    return NextResponse.json({ error: '文字起こしテキストが必要です' }, { status: 400 });
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    const systemPrompt = getSystemPrompt(respondentId ?? 'takamatsu', meetingType ?? 'general');
    const userMessage = getUserMessage(transcript, meetingPhase ?? 'early', previousContext, previousInsight);

    const stream = anthropic.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          // 会議中は同じシステムプロンプトを繰り返すためキャッシュする
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    const encoder = new TextEncoder();
    const send = (controller: ReadableStreamDefaultController, event: ChatStreamEvent) => {
      controller.enqueue(encoder.encode(encodeSSE(event)));
    };

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send(controller, { type: 'delta', text: event.delta.text });
            }
          }

          // 使用量を最後に流す（クライアントのコスト表示に使う）
          const message = await stream.finalMessage();
          send(controller, {
            type: 'done',
            usage: {
              // キャッシュ読み書き分も入力トークンとして計上する
              inputTokens:
                message.usage.input_tokens +
                (message.usage.cache_creation_input_tokens ?? 0) +
                (message.usage.cache_read_input_tokens ?? 0),
              outputTokens: message.usage.output_tokens,
            },
          });
        } catch (err) {
          // ストリーム開始後のエラーはHTTPステータスに乗せられないのでイベントで通知する
          console.error('Chat stream error:', err);
          send(controller, {
            type: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        } finally {
          controller.close();
        }
      },
      cancel() {
        // クライアント切断時にAPI呼び出しも止める
        stream.abort();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // プロキシによるバッファリングを抑止（ストリーミングが効かなくなるため）
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');

    // 具体的なものから順に判定する
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('Chat API auth error:', err);
      return NextResponse.json(
        { error: 'Claude APIキーが無効です。ANTHROPIC_API_KEY を確認してください。' },
        { status: 500 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'Claude API のレート制限に達しました。少し待ってから再試行してください。' },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      console.error('Chat API error:', err);
      return NextResponse.json(
        { error: `Claude API エラー (${err.status}): ${err.message}` },
        { status: 502 },
      );
    }

    console.error('Chat API error:', err);
    return NextResponse.json(
      { error: `AI応答の生成に失敗しました: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
