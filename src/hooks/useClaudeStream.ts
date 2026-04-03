'use client';

import { useCallback, useRef, useState } from 'react';
import type { AIResponse, ChatRequest } from '@/types';

interface UseClaudeStreamReturn {
  isStreaming: boolean;
  streamText: string;
  latestResponse: AIResponse | null;
  error: string | null;
  sendRequest: (request: ChatRequest) => Promise<void>;
  reset: () => void;
}

export function useClaudeStream(): UseClaudeStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [latestResponse, setLatestResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendRequest = useCallback(async (request: ChatRequest) => {
    // 前のリクエストをキャンセル
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setStreamText('');
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API エラー ${res.status}: ${errText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('レスポンスの読み取りに失敗しました');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setStreamText(accumulated);
      }

      // JSONパース
      try {
        const parsed = JSON.parse(accumulated) as AIResponse;
        parsed.respondentId = request.respondentId;
        setLatestResponse(parsed);
      } catch {
        setError('AI応答のJSON解析に失敗しました。再試行してください。');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setIsStreaming(false);
    setStreamText('');
    setLatestResponse(null);
    setError(null);
  }, []);

  return { isStreaming, streamText, latestResponse, error, sendRequest, reset };
}
