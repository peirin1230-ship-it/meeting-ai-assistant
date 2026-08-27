'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useSpeechRecognition, type MicStatus } from '@/hooks/useSpeechRecognition';
import { useWakeLock } from '@/hooks/useWakeLock';
import { isIOS } from '@/lib/browser';

interface AudioCaptureProps {
  isActive: boolean;
  onFinalText: (text: string) => void;
  onInterimText: (text: string) => void;
  onError: (error: string) => void;
  onStatusChange?: (status: MicStatus, hint: string | null) => void;
}

// 親（ユーザータップ起点）から同期的に start/stop を呼ぶための命令的ハンドル
export interface AudioCaptureHandle {
  start: () => void;
  stop: () => void;
}

const AudioCapture = forwardRef<AudioCaptureHandle, AudioCaptureProps>(function AudioCapture(
  { isActive, onFinalText, onInterimText, onError, onStatusChange },
  ref,
) {
  const {
    unsupportedReason,
    status,
    transcript,
    interimTranscript,
    error,
    hint,
    start,
    stop,
  } = useSpeechRecognition('ja-JP');

  const prevTranscriptRef = useRef('');
  const prevInterimRef = useRef('');
  const prevErrorRef = useRef<string | null>(null);

  // 録音中は画面ロックを抑止（スマホで画面が消えると認識が止まるため）
  useWakeLock(isActive && status !== 'error');

  // iOS Safari対策: マイク起動はユーザー操作と同じ同期コンテキストで呼ぶ必要があるため、
  // 親の「開始」ボタンハンドラから直接 start() を呼べるよう公開する。
  useImperativeHandle(ref, () => ({ start, stop }), [start, stop]);

  // 停止はここで制御する。開始はタップ起点でimperativeに行うが、
  // iOS以外はユーザージェスチャー不要なのでフォールバックとしてここでも開始する。
  // （status が 'error' のときは再試行しない。無限リトライを防ぐため）
  useEffect(() => {
    if (!isActive) {
      if (status !== 'idle') stop();
      return;
    }
    if (status === 'idle' && !isIOS()) start();
  }, [isActive, status, start, stop]);

  // 確定テキストの差分を親に通知
  useEffect(() => {
    if (transcript !== prevTranscriptRef.current) {
      const newText = transcript.slice(prevTranscriptRef.current.length);
      prevTranscriptRef.current = transcript;
      if (newText.trim()) {
        onFinalText(newText);
      }
    }
  }, [transcript, onFinalText]);

  // 中間テキストを通知
  useEffect(() => {
    if (interimTranscript !== prevInterimRef.current) {
      prevInterimRef.current = interimTranscript;
      onInterimText(interimTranscript);
    }
  }, [interimTranscript, onInterimText]);

  // マイク状態を親に通知（スマホでの状態表示に使う）
  useEffect(() => {
    onStatusChange?.(status, hint);
  }, [status, hint, onStatusChange]);

  // エラー通知
  // 同じエラーを繰り返し通知しない。親の setError が新しいstateを生み、
  // それが onError の identity を変えて再通知…という無限ループを防ぐため。
  useEffect(() => {
    if (error === prevErrorRef.current) return;
    prevErrorRef.current = error;
    if (error) onError(error);
  }, [error, onError]);

  // 未対応環境では理由と対処法を表示する
  return unsupportedReason ? (
    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
      {unsupportedReason}
    </div>
  ) : null;
});

export default AudioCapture;
