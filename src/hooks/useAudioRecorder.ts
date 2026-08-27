'use client';

import { useCallback, useRef, useState } from 'react';
import { appendChunk } from '@/lib/recordings-db';
import { isRecordingSupported } from '@/lib/browser';
import { useClientFlag } from './useClientFlag';

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'error';

export interface UseAudioRecorderReturn {
  status: RecorderStatus;
  error: string | null;
  /** これまでに保存したバイト数（UI表示用） */
  bytesRecorded: number;
  mimeType: string | null;
  isSupported: boolean;
  /** 録音を開始し、録音IDを返す。失敗時は null */
  start: (recordingId: string) => Promise<string | null>;
  /** 録音を停止し、長さ(ms)とサイズを返す */
  stop: () => Promise<{ durationMs: number; sizeBytes: number; mimeType: string } | null>;
}

// チャンクの書き出し間隔。短いほど途中クラッシュに強いが、書き込み回数は増える
const TIMESLICE_MS = 5_000;

// 会議音声には十分な品質で、かつファイルを小さく保つビットレート
const AUDIO_BITS_PER_SECOND = 32_000;

/** この端末で使える音声コンテナを選ぶ（iOS Safari は mp4、Chrome は webm/opus） */
function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  // isTypeSupported が未実装の環境向けフォールバック（ブラウザ既定に任せる）
  return '';
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [bytesRecorded, setBytesRecorded] = useState(0);
  const [mimeType, setMimeType] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const seqRef = useRef(0);
  const startedAtRef = useRef(0);
  const bytesRef = useRef(0);
  const recordingIdRef = useRef<string | null>(null);

  // レンダー中に直接判定すると hydration mismatch になるため専用フックを使う
  const isSupported = useClientFlag(isRecordingSupported);

  const cleanupStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      // マイクを確実に手放す。掴んだままだと音声認識が再開できなくなる
      stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  const start = useCallback(
    async (recordingId: string): Promise<string | null> => {
      if (!isSupported) {
        setStatus('error');
        setError('このブラウザは音声の録音に対応していません。');
        return null;
      }
      if (recorderRef.current) return recordingIdRef.current;

      setStatus('starting');
      setError(null);
      seqRef.current = 0;
      bytesRef.current = 0;
      setBytesRecorded(0);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (e) {
        const name = e instanceof DOMException ? e.name : '';
        setStatus('error');
        setError(
          name === 'NotAllowedError'
            ? 'マイクの使用が許可されていないため録音できません。'
            : 'マイクを取得できなかったため録音を開始できませんでした。',
        );
        return null;
      }

      const type = pickMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(
          stream,
          type ? { mimeType: type, audioBitsPerSecond: AUDIO_BITS_PER_SECOND } : undefined,
        );
      } catch {
        cleanupStream();
        setStatus('error');
        setError('この端末では対応する音声形式が見つかりませんでした。');
        return null;
      }

      streamRef.current = stream;
      recorderRef.current = recorder;
      recordingIdRef.current = recordingId;
      const resolvedType = recorder.mimeType || type || 'audio/webm';
      setMimeType(resolvedType);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (!event.data || event.data.size === 0) return;
        const seq = seqRef.current++;
        bytesRef.current += event.data.size;
        setBytesRecorded(bytesRef.current);
        // 逐次書き出すので、途中で落ちてもここまでは残る
        void appendChunk(recordingId, seq, event.data).catch(() => {
          setError('録音データの保存に失敗しました（端末の空き容量を確認してください）。');
        });
      };

      recorder.onerror = () => {
        setStatus('error');
        setError('録音中にエラーが発生しました。');
      };

      startedAtRef.current = Date.now();
      recorder.start(TIMESLICE_MS);
      setStatus('recording');
      return recordingId;
    },
    [cleanupStream, isSupported],
  );

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    recorderRef.current = null;
    const durationMs = Date.now() - startedAtRef.current;

    // 残りのバッファが ondataavailable で流れきるのを待つ
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      recorder.onstop = done;
      try {
        recorder.stop();
      } catch {
        done();
      }
      // onstop が来ない環境向けの保険
      setTimeout(done, 3_000);
    });

    cleanupStream();
    setStatus('idle');

    return {
      durationMs,
      sizeBytes: bytesRef.current,
      mimeType: recorder.mimeType || mimeType || 'audio/webm',
    };
  }, [cleanupStream, mimeType]);

  return { status, error, bytesRecorded, mimeType, isSupported, start, stop };
}
