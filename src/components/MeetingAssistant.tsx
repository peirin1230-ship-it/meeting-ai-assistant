'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMeetingStore } from '@/stores/meeting-store';
import { useTranscriptBuffer } from '@/hooks/useTranscriptBuffer';
import { useClaudeStream } from '@/hooks/useClaudeStream';
import { useSessionSync } from '@/hooks/useSessionSync';
import type { ChatRequest, TranscriptSegment, SessionSegment, RespondentId } from '@/types';
import type { MicStatus } from '@/hooks/useSpeechRecognition';
import { BUFFER_SEND_INTERVAL_MS, BUFFER_SEND_CHAR_THRESHOLD } from '@/lib/constants';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { saveMeta } from '@/lib/recordings-db';
import AudioCapture, { type AudioCaptureHandle } from './AudioCapture';
import MicStatusBar from './MicStatusBar';
import RecordingsPanel from './RecordingsPanel';
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
  const shouldSend = buffer.shouldSend;
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interimPushRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingSegmentsRef = useRef<SessionSegment[]>([]);
  const audioCaptureRef = useRef<AudioCaptureHandle>(null);
  const analysisGenerationRef = useRef(0);

  // マイクの状態（スマホでは文字起こしパネルが隠れるため、常時表示に使う）
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [micHint, setMicHint] = useState<string | null>(null);

  // スマホ用: AI示唆／文字起こしの表示切替
  const [mobileTab, setMobileTab] = useState<'insight' | 'transcript'>('insight');

  // 音声の端末内保存
  const recorder = useAudioRecorder();
  const [saveAudio, setSaveAudio] = useState(false);
  const [recordingsToken, setRecordingsToken] = useState(0);
  const recordingIdRef = useRef<string | null>(null);
  const recordingStartedAtRef = useRef<string | null>(null);

  // viewer用: リモートセグメントの蓄積バッファ
  const viewerBufferRef = useRef('');

  // セッション同期フック
  const session = useSessionSync({
    onRemoteSegments: (newSegments) => {
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
  // 注: useMeetingStore() が返すオブジェクトは更新のたびに identity が変わるため、
  //     依存に入れると毎レンダーで関数が作り直され、タイマーが張り直されてしまう。
  //     そのため store の読み取りは getState() で行い、依存を安定させる。
  const flushBuffer = buffer.flush;
  const sendRequest = claude.sendRequest;

  const requestAnalysis = useCallback(
    async (text?: string) => {
      const transcript = text ?? flushBuffer();
      if (!transcript.trim()) return;

      const state = useMeetingStore.getState();
      const request: ChatRequest = {
        transcript,
        meetingType: state.meetingType,
        respondentId: state.respondentId,
        previousContext: state.getPreviousContext(),
        previousInsight:
          state.respondentId === 'takamatsu'
            ? state.takamatsuInsight ?? undefined
            : state.takadaInsight ?? undefined,
        requestType: 'auto',
        meetingPhase: state.getMeetingPhase(),
      };

      // 後発のリクエストが走っている場合に、先発の完了で
      // 「分析中」表示を消してしまわないよう世代番号で判定する
      const generation = ++analysisGenerationRef.current;

      state.setStreaming(true);
      const usage = await sendRequest(request);

      if (usage) {
        // 実際のトークン使用量でコスト表示を更新する
        useMeetingStore.getState().updateCost(usage);
      }

      if (generation === analysisGenerationRef.current) {
        useMeetingStore.getState().setStreaming(false);
      }
    },
    [flushBuffer, sendRequest],
  );

  // claude応答の反映（storeを依存に入れると無限ループになるため除外）
  useEffect(() => {
    if (claude.latestResponse) {
      useMeetingStore.getState().setLatestResponse(claude.latestResponse);
    }
  }, [claude.latestResponse]);

  useEffect(() => {
    if (claude.error) {
      useMeetingStore.getState().setError(claude.error);
    }
  }, [claude.error]);

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
        if (text.length >= BUFFER_SEND_CHAR_THRESHOLD && !claude.isStreaming) {
          viewerBufferRef.current = '';
          requestAnalysis(text);
        }
      }, 5000);
    } else {
      // standaloneモード: 既存ロジック
      checkIntervalRef.current = setInterval(() => {
        if (shouldSend() && !claude.isStreaming) {
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
  }, [store.isActive, store.deviceRole, shouldSend, claude.isStreaming, requestAnalysis]);

  // viewerモード: 一定時間経過でも分析実行（文字数が足りなくても）
  useEffect(() => {
    if (!store.isActive || store.deviceRole !== 'viewer') return;

    const timer = setInterval(() => {
      const text = viewerBufferRef.current;
      if (text.trim() && !claude.isStreaming) {
        viewerBufferRef.current = '';
        requestAnalysis(text);
      }
    }, BUFFER_SEND_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [store.isActive, store.deviceRole, claude.isStreaming, requestAnalysis]);

  // phoneモード: 2秒ごとにinterimテキストをRedisに送信
  // interimText を依存に入れると発話のたびにタイマーが張り直され、
  // 2秒間隔が一度も満了しなくなるため、タイマー内で最新値を読む
  const pushTranscript = session.pushTranscript;
  useEffect(() => {
    if (!store.isActive || store.deviceRole !== 'phone') return;

    interimPushRef.current = setInterval(() => {
      // pending確定セグメントがあれば送信
      const segments = pendingSegmentsRef.current;
      const interimText = useMeetingStore.getState().interimText;

      if (segments.length > 0 || interimText) {
        pushTranscript(segments.length > 0 ? segments : undefined, interimText);
        pendingSegmentsRef.current = [];
      }
    }, 2000);

    return () => {
      if (interimPushRef.current) {
        clearInterval(interimPushRef.current);
        interimPushRef.current = null;
      }
    };
  }, [store.isActive, store.deviceRole, pushTranscript]);

  // 音声認識からのテキスト受信
  // これらのコールバックは AudioCapture の useEffect 依存に入るため、
  // 必ず identity を安定させること。store をそのまま依存にすると
  // 「setError → storeの新オブジェクト → コールバック再生成 → effect再実行
  //   → setError」の無限レンダーループになり、タップした瞬間に画面が落ちる。
  const addFinalTextToBuffer = buffer.addFinalText;

  const handleFinalText = useCallback(
    (text: string) => {
      const segment: TranscriptSegment = {
        id: `seg-${++segmentId}`,
        text: text.trim(),
        timestamp: new Date(),
        isFinal: true,
      };
      const state = useMeetingStore.getState();
      state.addSegment(segment);
      addFinalTextToBuffer(text);

      // phoneモード: 確定セグメントを送信キューに追加
      if (state.deviceRole === 'phone') {
        pendingSegmentsRef.current.push({
          id: segment.id,
          text: segment.text,
          timestamp: segment.timestamp.toISOString(),
          isFinal: true,
        });
      }
    },
    [addFinalTextToBuffer],
  );

  const handleInterimText = useCallback((text: string) => {
    useMeetingStore.getState().setInterimText(text);
  }, []);

  const handleError = useCallback((error: string) => {
    useMeetingStore.getState().setError(error);
  }, []);

  const handleMicStatusChange = useCallback((status: MicStatus, hint: string | null) => {
    setMicStatus(status);
    setMicHint(hint);
  }, []);

  const handleStart = useCallback(() => {
    const isViewerRole = store.deviceRole === 'viewer';

    // iOS Safari対策: マイク起動はタップと同じ同期コンテキストで、かつ
    // できるだけ早い段階で呼ぶ必要があるため、state更新より先に実行する
    if (!isViewerRole) {
      audioCaptureRef.current?.start();
    }

    store.startMeeting();
    buffer.reset();
    claude.reset();
    segmentId = 0;
    viewerBufferRef.current = '';
    pendingSegmentsRef.current = [];
    setMobileTab('insight');

    // viewerモード: ポーリング開始
    if (isViewerRole) {
      session.startPolling();
    }

    // 音声保存が有効なら録音も開始する。
    // getUserMedia は非同期なので、必ず音声認識の start() より後に呼ぶ
    // （iOS ではタップと同じ同期コンテキストでの start() が必須のため）
    if (!isViewerRole && saveAudio && recorder.isSupported) {
      const id = `rec-${Date.now()}`;
      recordingIdRef.current = id;
      recordingStartedAtRef.current = new Date().toISOString();
      void recorder.start(id);
    }
  }, [store, buffer, claude, session, saveAudio, recorder]);

  const handleStop = useCallback(() => {
    // 文字起こしは stopMeeting より先に取得する（stopMeeting 後も残るが順序を明確にする）
    const state = useMeetingStore.getState();
    const transcriptText = state.segments
      .map((seg) => `[${seg.timestamp.toLocaleTimeString('ja-JP')}] ${seg.text}`)
      .join('\n');

    store.stopMeeting();
    audioCaptureRef.current?.stop();

    // 録音を締めて端末内に保存する
    const recordingId = recordingIdRef.current;
    if (recordingId) {
      recordingIdRef.current = null;
      void recorder.stop().then(async (result) => {
        if (!result || result.sizeBytes === 0) return;
        await saveMeta({
          id: recordingId,
          startedAt: recordingStartedAtRef.current ?? new Date().toISOString(),
          durationMs: result.durationMs,
          mimeType: result.mimeType,
          sizeBytes: result.sizeBytes,
          transcript: transcriptText,
          meetingType: state.meetingType,
          respondentId: state.respondentId,
        });
        setRecordingsToken((t) => t + 1);
      });
    }
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
  }, [store, session, recorder]);

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

  // 回答者切り替え（会議中は文脈を引き継いで再分析）
  const handleRespondentChange = useCallback(
    (id: RespondentId) => {
      store.setRespondent(id);
      if (store.isActive && store.segments.length > 0) {
        const allText = store.segments.map((s) => s.text).join(' ');
        requestAnalysis(allText);
      }
    },
    [store, requestAnalysis],
  );

  const isViewer = store.deviceRole === 'viewer';
  const isPhone = store.deviceRole === 'phone';

  return (
    <div className="flex h-dvh flex-col gap-3 p-3">
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

      {/* 回答者選択（viewerモードでは非表示） */}
      {!isViewer && (
        <RespondentSelector
          selected={store.respondentId}
          onChange={handleRespondentChange}
          disabled={false}
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

      {/* マイク状態（viewerは音声を拾わないので非表示） */}
      {!isViewer && (
        <MicStatusBar
          status={micStatus}
          hint={micHint}
          isActive={store.isActive}
          segmentCount={store.segments.length}
          interimText={store.interimText}
        />
      )}

      {/* 音声の端末内保存（viewerは音声を扱わないので非表示） */}
      {!isViewer && (
        <RecordingsPanel
          enabled={saveAudio}
          onEnabledChange={setSaveAudio}
          isSupported={recorder.isSupported}
          status={recorder.status}
          bytesRecorded={recorder.bytesRecorded}
          error={recorder.error}
          isMeetingActive={store.isActive}
          refreshToken={recordingsToken}
        />
      )}

      {/* スマホ用タブ切替（PCは2カラム表示のため不要） */}
      {!isPhone && (
        <div className="flex gap-2 md:hidden">
          <button
            onClick={() => setMobileTab('insight')}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              mobileTab === 'insight'
                ? 'bg-blue-500 text-white'
                : 'border border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
            }`}
          >
            AI示唆
          </button>
          <button
            onClick={() => setMobileTab('transcript')}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              mobileTab === 'transcript'
                ? 'bg-blue-500 text-white'
                : 'border border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
            }`}
          >
            文字起こし{store.segments.length > 0 ? ` (${store.segments.length})` : ''}
          </button>
        </div>
      )}

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
                  <div className="mb-2 text-4xl">{micStatus === 'listening' ? '🎙️' : '⏳'}</div>
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                    {micStatus === 'listening'
                      ? '音声を送信中...'
                      : micStatus === 'error'
                        ? 'マイクを起動できませんでした'
                        : 'マイクを起動しています...'}
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
            {/* 文字起こしパネル（スマホではタブで切替、PCは常時表示） */}
            <div
              className={`w-full md:block md:w-1/2 ${
                mobileTab === 'transcript' ? 'block' : 'hidden'
              }`}
            >
              <TranscriptPanel
                segments={store.segments}
                interimText={store.interimText}
                isListening={micStatus === 'listening'}
              />
            </div>

            {/* AI示唆パネル */}
            <div
              className={`w-full md:block md:w-1/2 ${
                mobileTab === 'insight' ? 'block' : 'hidden'
              }`}
            >
              <InsightPanel
                response={store.latestResponse}
                respondentId={store.respondentId}
                isStreaming={store.isStreaming}
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
          ref={audioCaptureRef}
          isActive={store.isActive}
          onFinalText={handleFinalText}
          onInterimText={handleInterimText}
          onError={handleError}
          onStatusChange={handleMicStatusChange}
        />
      )}
    </div>
  );
}
