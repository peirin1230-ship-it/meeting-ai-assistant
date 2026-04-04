'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMeetingStore } from '@/stores/meeting-store';
import { useTranscriptBuffer } from '@/hooks/useTranscriptBuffer';
import { useClaudeStream } from '@/hooks/useClaudeStream';
import { useSessionSync } from '@/hooks/useSessionSync';
import type { ChatRequest, TranscriptSegment, SessionSegment } from '@/types';
import AudioCapture from './AudioCapture';
import TranscriptPanel from './TranscriptPanel';
import InsightPanel from './InsightPanel';
import ControlBar from './ControlBar';
import CostIndicator from './CostIndicator';
import RespondentSelector from './RespondentSelector';
import SessionBar from './SessionBar';

let segmentId = 0;

export default function MeetingAssistant() {
  const store = useMeetingStore();
  const buffer = useTranscriptBuffer();
  const claude = useClaudeStream();
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interimPushRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingSegmentsRef = useRef<SessionSegment[]>([]);

  // viewer用: リモートセグメントの蓄積バッファ
  const viewerBufferRef = useRef('');

  // セッション同期フック
  const session = useSessionSync({
    onRemoteSegments: (newSegments, _allSegments) => {
      if (store.deviceRole !== 'viewer') return;
      // リモートセグメントをストアに追加
      for (const seg of newSegments) {
        store.addSegment({
          id: seg.id,
          text: seg.text,
          timestamp: new Date(seg.timestamp),
          isFinal: seg.isFinal,
        });
        // viewer用バッファに蓄積（Claude分析トリガー用）
        viewerBufferRef.current += seg.text;
      }
    },
    onRemoteInterim: (interimText) => {
      if (store.deviceRole !== 'viewer') return;
      store.setInterimText(interimText);
    },
    onSessionEnded: () => {
      store.setError('セッションが終了しました');
      store.stopMeeting();
      store.setSessionCode(null);
      store.setDeviceRole('standalone');
    },
    onError: (error) => {
      store.setError(error);
    },
  });

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
    if (!store.isActive) return;

    if (store.deviceRole === 'phone') {
      // phoneモード: Claude分析しない、バッファチェック不要
      return;
    }

    if (store.deviceRole === 'viewer') {
      // viewerモード: リモートセグメントが溜まったらClaude分析
      checkIntervalRef.current = setInterval(() => {
        const text = viewerBufferRef.current;
        if (text.length >= 300 && !claude.isStreaming) {
          viewerBufferRef.current = '';
          requestAnalysis(text);
        }
      }, 5000);
    } else {
      // standaloneモード: 既存ロジック
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
  }, [store.isActive, store.deviceRole, buffer, claude.isStreaming, requestAnalysis]);

  // viewerモード: 30秒経過でも分析実行（文字数が足りなくても）
  useEffect(() => {
    if (!store.isActive || store.deviceRole !== 'viewer') return;

    const timer = setInterval(() => {
      const text = viewerBufferRef.current;
      if (text.trim() && !claude.isStreaming) {
        viewerBufferRef.current = '';
        requestAnalysis(text);
      }
    }, 30_000);

    return () => clearInterval(timer);
  }, [store.isActive, store.deviceRole, claude.isStreaming, requestAnalysis]);

  // phoneモード: 2秒ごとにinterimテキストをRedisに送信
  useEffect(() => {
    if (!store.isActive || store.deviceRole !== 'phone') return;

    interimPushRef.current = setInterval(() => {
      // pending確定セグメントがあれば送信
      const segments = pendingSegmentsRef.current;
      const interimText = store.interimText;

      if (segments.length > 0 || interimText) {
        session.pushTranscript(
          segments.length > 0 ? segments : undefined,
          interimText,
        );
        pendingSegmentsRef.current = [];
      }
    }, 2000);

    return () => {
      if (interimPushRef.current) {
        clearInterval(interimPushRef.current);
        interimPushRef.current = null;
      }
    };
  }, [store.isActive, store.deviceRole, store.interimText, session]);

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

      // phoneモード: 確定セグメントを送信キューに追加
      if (store.deviceRole === 'phone') {
        pendingSegmentsRef.current.push({
          id: segment.id,
          text: segment.text,
          timestamp: segment.timestamp.toISOString(),
          isFinal: true,
        });
      }
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
    viewerBufferRef.current = '';
    pendingSegmentsRef.current = [];

    // viewerモード: ポーリング開始
    if (store.deviceRole === 'viewer') {
      session.startPolling();
    }
  }, [store, buffer, claude, session]);

  const handleStop = useCallback(() => {
    store.stopMeeting();
    if (store.deviceRole === 'phone') {
      // 残りのpendingセグメントを送信
      if (pendingSegmentsRef.current.length > 0) {
        session.pushTranscript(pendingSegmentsRef.current);
        pendingSegmentsRef.current = [];
      }
    }
    if (store.deviceRole !== 'standalone') {
      session.stopPolling();
    }
  }, [store, session]);

  const handleRequestInsight = useCallback(() => {
    if (store.deviceRole === 'viewer') {
      const text = viewerBufferRef.current;
      if (text.trim()) {
        viewerBufferRef.current = '';
        requestAnalysis(text);
      }
    } else {
      const text = buffer.flush();
      if (text.trim()) {
        requestAnalysis(text);
      }
    }
  }, [buffer, requestAnalysis, store.deviceRole]);

  // セッション作成（phoneモード）
  const handleCreateSession = useCallback(async () => {
    const code = await session.createSession(store.meetingType, store.respondentId);
    if (code) {
      store.setSessionCode(code);
      store.setDeviceRole('phone');
    }
  }, [session, store]);

  // セッション参加（viewerモード）
  const handleJoinSession = useCallback(async (code: string) => {
    const data = await session.joinSession(code);
    if (data) {
      store.setSessionCode(code);
      store.setDeviceRole('viewer');
      store.setRespondent(data.respondentId);
      store.setMeetingType(data.meetingType);

      // 既存セグメントを復元
      for (const seg of data.segments) {
        store.addSegment({
          id: seg.id,
          text: seg.text,
          timestamp: new Date(seg.timestamp),
          isFinal: seg.isFinal,
        });
      }
      if (data.interimText) {
        store.setInterimText(data.interimText);
      }
    }
  }, [session, store]);

  // セッション離脱
  const handleLeaveSession = useCallback(() => {
    session.endSession();
    store.setSessionCode(null);
    store.setDeviceRole('standalone');
    store.stopMeeting();
  }, [session, store]);

  const isViewer = store.deviceRole === 'viewer';
  const isPhone = store.deviceRole === 'phone';

  return (
    <div className="flex h-screen flex-col gap-3 p-3">
      {/* セッションバー */}
      <SessionBar
        deviceRole={store.deviceRole}
        sessionCode={store.sessionCode}
        isConnected={session.isConnected}
        onCreateSession={handleCreateSession}
        onJoinSession={handleJoinSession}
        onLeaveSession={handleLeaveSession}
        disabled={store.isActive}
      />

      {/* 回答者選択（会議開始前のみ、viewerモードでは非表示） */}
      {!store.isActive && !isViewer && (
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

      {/* メインコンテンツ */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        {/* phoneモード: 文字起こしステータスのみ表示 */}
        {isPhone ? (
          <div className="flex w-full flex-col items-center justify-center gap-4">
            <div className="text-center">
              {store.isActive ? (
                <>
                  <div className="mb-2 text-4xl">🎙️</div>
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                    音声を送信中...
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    セグメント: {store.segments.length}件
                  </p>
                  {store.interimText && (
                    <p className="mt-2 max-w-sm text-sm italic text-gray-400 dark:text-gray-500">
                      {store.interimText}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    「開始」を押して音声キャプチャを開始してください
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    PCでコード <span className="font-mono font-bold">{store.sessionCode}</span> を入力して分析画面を表示
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 文字起こしパネル (PC/standaloneのみ) */}
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
          </>
        )}
      </div>

      {/* コスト表示（phoneモードでは非表示） */}
      {!isPhone && <CostIndicator cost={store.cost} />}

      {/* 音声キャプチャ（viewerモードでは非表示） */}
      {!isViewer && (
        <AudioCapture
          isActive={store.isActive}
          onFinalText={handleFinalText}
          onInterimText={handleInterimText}
          onError={handleError}
        />
      )}
    </div>
  );
}
