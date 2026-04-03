import type { AIResponse, ChatRequest } from '@/types';
import { getSystemPrompt, getUserMessage } from './prompts';

export async function streamChatResponse(
  request: ChatRequest,
  onChunk: (text: string) => void,
  onComplete: (response: AIResponse) => void,
  onError: (error: string) => void,
): Promise<void> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errorText = await res.text();
      onError(`API エラー: ${res.status} ${errorText}`);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError('レスポンスの読み取りに失敗しました');
      return;
    }

    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      accumulated += chunk;
      onChunk(accumulated);
    }

    // 完了時にJSONをパース
    try {
      const parsed = JSON.parse(accumulated) as AIResponse;
      parsed.respondentId = request.respondentId;
      onComplete(parsed);
    } catch {
      onError('AI応答のJSON解析に失敗しました');
    }
  } catch (err) {
    onError(`通信エラー: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// サーバーサイド用: システムプロンプト生成のre-export
export { getSystemPrompt, getUserMessage };
