'use client';

import { useEffect, useRef } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface AudioCaptureProps {
  isActive: boolean;
  onFinalText: (text: string) => void;
  onInterimText: (text: string) => void;
  onError: (error: string) => void;
}

export default function AudioCapture({
  isActive,
  onFinalText,
  onInterimText,
  onError,
}: AudioCaptureProps) {
  const { isListening, isSupported, transcript, interimTranscript, error, start, stop } =
    useSpeechRecognition('ja-JP');

  const prevTranscriptRef = useRef('');

  // 開始/停止の制御
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
  useEffect(() => {
    onInterimText(interimTranscript);
  }, [interimTranscript, onInterimText]);

  // エラー通知
  useEffect(() => {
    if (error) onError(error);
  }, [error, onError]);

  if (!isSupported) {
    return (
      <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
        お使いのブラウザは音声認識に対応していません。Chrome または Safari をお使いください。
      </div>
    );
  }

  return null;
}
