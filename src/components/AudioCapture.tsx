'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface AudioCaptureProps {
  isActive: boolean;
  onFinalText: (text: string) => void;
  onInterimText: (text: string) => void;
  onError: (error: string) => void;
}

// 親（ユーザータップ起点）から同期的に start/stop を呼ぶための命令的ハンドル
export interface AudioCaptureHandle {
  start: () => void;
  stop: () => void;
}

const AudioCapture = forwardRef<AudioCaptureHandle, AudioCaptureProps>(function AudioCapture(
  { isActive, onFinalText, onInterimText, onError },
  ref,
) {
  const { isListening, isSupported, transcript, interimTranscript, error, start, stop } =
    useSpeechRecognition('ja-JP');

  const prevTranscriptRef = useRef('');

  // iOS Safari対策: マイク起動はユーザー操作と同じ同期コンテキストで呼ぶ必要があるため、
  // 親の「開始」ボタンハンドラから直接 start() を呼べるよう公開する。
  useImperativeHandle(ref, () => ({ start, stop }), [start, stop]);

  // 停止の制御（開始はタップ起点でimperativeに行う。startは二重呼び出しガード済みのため
  // 非iOS環境のフォールバックとしてここでも呼ぶ）
  useEffect(() => {
    if (isActive && !isListening) {
      start();
    } else if (!isActive && isListening) {
      stop();
    }
  }, [isActive, isListening, start, stop]);

  // 確定テキストの差分を親に通知
  useEffect(() => {
    if (transcript !== prevTranscriptRef.current) {
      const newText = transcript.slice(prevTranscriptRef.current.length);
      if (newText.trim()) {
        onFinalText(newText);
      }
      prevTranscriptRef.current = transcript;
    }
  }, [transcript, onFinalText]);

  // 中間テキストを通知
  const prevInterimRef = useRef('');
  useEffect(() => {
    if (interimTranscript !== prevInterimRef.current) {
      prevInterimRef.current = interimTranscript;
      onInterimText(interimTranscript);
    }
  }, [interimTranscript, onInterimText]);

  // エラー通知
  useEffect(() => {
    if (error) onError(error);
  }, [error, onError]);

  return !isSupported ? (
    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
      お使いのブラウザは音声認識に対応していません。Chrome または Safari をお使いください。
    </div>
  ) : null;
});

export default AudioCapture;
