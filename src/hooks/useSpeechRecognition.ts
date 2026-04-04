'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionResult {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

// Web Speech API の型定義（ブラウザネイティブ）
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechRecognition(lang: 'ja-JP' | 'en-US' = 'ja-JP'): SpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isListeningRef = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(getSpeechRecognitionConstructor() !== null);
  }, []);

  const cleanup = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setError('お使いのブラウザは音声認識に対応していません。Chrome または Safari をお使いください。');
      return;
    }

    cleanup();

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;

    // iOS Safari では continuous: true が不安定なため、UA で判定
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    recognition.continuous = !isIOS;

    recognition.onstart = () => {
      console.log('[SpeechRecognition] started');
      setIsListening(true);
      isListeningRef.current = true;
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      console.log('[SpeechRecognition] result:', { finalText, interimText });

      if (finalText) {
        setTranscript((prev) => prev + finalText);
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.log('[SpeechRecognition] error:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setError(`音声認識エラー: ${event.error}`);
    };

    // iOS Safari 対策: 認識終了時に自動再開
    recognition.onend = () => {
      console.log('[SpeechRecognition] ended, isListening:', isListeningRef.current);
      if (isListeningRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
            isListeningRef.current = false;
          }
        }, 100);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError('音声認識の開始に失敗しました。マイクの権限を確認してください。');
    }
  }, [lang, cleanup]);

  const stop = useCallback(() => {
    isListeningRef.current = false;
    cleanup();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, [cleanup]);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      cleanup();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [cleanup]);

  return { isListening, isSupported, transcript, interimTranscript, error, start, stop };
}
