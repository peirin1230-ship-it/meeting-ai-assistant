'use client';

import { useCallback, useRef, useState } from 'react';
import type { AIResponse, ChatRequest } from '@/types';
import { createSSEParser, extractJsonObject, type TokenUsage } from '@/lib/stream-protocol';

interface UseClaudeStreamReturn {
  isStreaming: boolean;
  latestResponse: AIResponse | null;
  error: string | null;
  /** 成功時はトークン使用量を返す（コスト表示に使う）。失敗時は null */
  sendRequest: (request: ChatRequest) => Promise<TokenUsage | null>;
  reset: () => void;
}

export function useClaudeStream(): UseClaudeStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [latestResponse, setLatestResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendRequest = useCallback(async (request: ChatRequest): Promise<TokenUsage | null> => {
    // 前のリクエストをキャンセル
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!res.ok) {
        // エラーレスポンスはJSON（{ error: string }）で返る
        let detail = `HTTP ${res.status}`;
        try {
          const errBody = (await res.json()) as { error?: string };
          if (errBody.error) detail = errBody.error;
        } catch {
          // JSONでなければステータスのみ
        }
        throw new Error(detail);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('レスポンスの読み取りに失敗しました');

      const decoder = new TextDecoder();
      const parseSSE = createSSEParser();
      let accumulated = '';
      let usage: TokenUsage | null = null;
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const event of parseSSE(decoder.decode(value, { stream: true }))) {
          if (event.type === 'delta') {
            accumulated += event.text;
          } else if (event.type === 'done') {
            usage = event.usage;
          } else {
            streamError = event.message;
          }
        }
      }

      if (streamError) {
        throw new Error(`AI応答の生成に失敗しました: ${streamError}`);
      }

      // コードブロックで囲まれていても取り出せるようにする
      const parsed = extractJsonObject<AIResponse>(accumulated);
      if (!parsed) {
        setError('AI応答のJSON解析に失敗しました。再試行してください。');
        return null;
      }

      parsed.respondentId = request.respondentId;
      setLatestResponse(parsed);
      return usage;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return null;
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setIsStreaming(false);
    setLatestResponse(null);
    setError(null);
  }, []);

  return { isStreaming, latestResponse, error, sendRequest, reset };
}
