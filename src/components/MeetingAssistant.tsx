'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMeetingStore } from '@/stores/meeting-store';
import { useTranscriptBuffer } from '@/hooks/useTranscriptBuffer';
import { useClaudeStream } from '@/hooks/useClaudeStream';
import type { ChatRequest, TranscriptSegment } from '@/types';
import AudioCapture from './AudioCapture';
import TranscriptPanel from './TranscriptPanel';
import InsightPanel from './InsightPanel';
import ControlBar from './ControlBar';
import CostIndicator from './CostIndicator';
import RespondentSelector from './RespondentSelector';

let segmentId = 0;

export default function MeetingAssistant() {
  const store = useMeetingStore();
  const buffer = useTranscriptBuffer();
  const claude = useClaudeStream();
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // API呼び出し
  const requestAnalysis = useCallback(
    async (text?: string) => {
      const transcript = text ?? buffer.flush();
      if (!transcript.trim()) return;

      const request: ChatRequest = {
        transcript,
        meetingType: store.meetingType,
        respondentId: store.respondentId,
        previousContext: store.getPreviousContext(),
        previousInsight:
          store.respondentId === 'takamatsu'
            ? store.takamatsuInsight ?? undefined
            : store.takadaInsight ?? undefined,
        requestType: 'auto',
        meetingPhase: store.getMeetingPhase(),
      };

      store.setStreaming(true);
      await claude.sendRequest(request);
      store.setStreaming(false);
    },
    [buffer, claude, store],
  );

  // claude応答の反映
  useEffect(() => {
    if (claude.latestResponse) {
      store.setLatestResponse(claude.latestResponse);
    }
  }, [claude.latestResponse, store]);

  useEffect(() => {
    if (claude.error) {
      store.setError(claude.error);
    }
  }, [claude.error, store]);

  // 定期チェック: バッファが閾値を超えたらAPI呼び出し
  useEffect(() => {
    if (store.isActive) {
      checkIntervalRef.current = setInterval(() => {
        if (buffer.shouldSend() && !claude.isStreaming) {
          requestAnalysis();
        }
      }, 5000);
    }
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [store.isActive, buffer, claude.isStreaming, requestAnalysis]);

  // 音声認識からのテキスト受信
  const handleFinalText = useCallback(
    (text: string) => {
      const segment: TranscriptSegment = {
        id: `seg-${++segmentId}`,
        text: text.trim(),
        timestamp: new Date(),
        isFinal: true,
      };
      store.addSegment(segment);
      buffer.addFinalText(text);
    },
    [store, buffer],
  );

  const handleInterimText = useCallback(
    (text: string) => {
      store.setInterimText(text);
    },
    [store],
  );

  const handleError = useCallback(
    (error: string) => {
      store.setError(error);
    },
    [store],
  );

  const handleStart = useCallback(() => {
    store.startMeeting();
    buffer.reset();
    claude.reset();
    segmentId = 0;
  }, [store, buffer, claude]);

  const handleStop = useCallback(() => {
    store.stopMeeting();
  }, [store]);

  const handleRequestInsight = useCallback(() => {
    const text = buffer.flush();
    if (text.trim()) {
      requestAnalysis(text);
    }
  }, [buffer, requestAnalysis]);

  return (
    <div className="flex h-screen flex-col gap-3 p-3">
      {/* 回答者選択（会議開始前のみ） */}
      {!store.isActive && (
        <RespondentSelector
          selected={store.respondentId}
          onChange={store.setRespondent}
          disabled={store.isActive}
        />
      )}

      {/* 操作バー */}
      <ControlBar
        isActive={store.isActive}
        respondentId={store.respondentId}
        meetingType={store.meetingType}
        onStart={handleStart}
        onStop={handleStop}
        onMeetingTypeChange={store.setMeetingType}
        onRequestInsight={handleRequestInsight}
        isStreaming={store.isStreaming}
      />

      {/* エラー表示 */}
      {store.error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {store.error}
          <button
            onClick={() => store.setError(null)}
            className="ml-2 text-xs underline"
          >
            閉じる
          </button>
        </div>
      )}

      {/* メインコンテンツ: 2カラム(PC) / 1カラム(スマホ) */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        {/* 文字起こしパネル */}
        <div className="hidden w-1/2 md:block">
          <TranscriptPanel
            segments={store.segments}
            interimText={store.interimText}
            isListening={store.isActive}
          />
        </div>

        {/* AI示唆パネル */}
        <div className="w-full md:w-1/2">
          <InsightPanel
            response={store.latestResponse}
            respondentId={store.respondentId}
            isStreaming={store.isStreaming}
            streamText={claude.streamText}
          />
        </div>
      </div>

      {/* コスト表示 */}
      <CostIndicator cost={store.cost} />

      {/* 音声キャプチャ（非表示コンポーネント） */}
      <AudioCapture
        isActive={store.isActive}
        onFinalText={handleFinalText}
        onInterimText={handleInterimText}
        onError={handleError}
      />
    </div>
  );
}
