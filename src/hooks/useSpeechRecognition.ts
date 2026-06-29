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
  const startWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // start()が実際にマイクを起動できたか（onstart発火）を追跡
  const startedRef = useRef(false);

  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(getSpeechRecognitionConstructor() !== null);
  }, []);

  const cleanup = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (startWatchdogRef.current) {
      clearTimeout(startWatchdogRef.current);
      startWatchdogRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setError('お使いのブラウザは音声認識に対応していません。Chrome または Safari をお使いください。');
      return;
    }

    // 二重start防止: 既に起動中／起動処理中なら何もしない。
    // （iOSではタップ起点のstartとuseEffect起点のstartが二重に走ると
    //   "already started" 例外になり起動に失敗するため）
    if (recognitionRef.current) return;

    cleanup();
    startedRef.current = false;

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;

    // iOS Safari では continuous: true が不安定なため、UA で判定
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    recognition.continuous = !isIOS;

    recognition.onstart = () => {
      // マイク起動成功: 起動失敗ウォッチドッグを解除
      startedRef.current = true;
      if (startWatchdogRef.current) {
        clearTimeout(startWatchdogRef.current);
        startWatchdogRef.current = null;
      }
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


      if (finalText) {
        setTranscript((prev) => prev + finalText);
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // no-speech / aborted は自動再開でリカバリするため無視
      if (event.error === 'no-speech' || event.error === 'aborted') return;

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        // マイク権限が拒否された場合は再開せず明確に通知
        isListeningRef.current = false;
        startedRef.current = true; // 起動ウォッチドッグによる上書きを防ぐ
        if (startWatchdogRef.current) {
          clearTimeout(startWatchdogRef.current);
          startWatchdogRef.current = null;
        }
        setError(
          'マイクの使用が許可されていません。ブラウザの設定でマイクへのアクセスを許可し、HTTPS接続であることを確認してください。',
        );
        return;
      }

      setError(`音声認識エラー: ${event.error}`);
    };

    // iOS Safari 対策: 認識終了時に自動再開
    recognition.onend = () => {

      if (isListeningRef.current) {
        // iOS Safari対策: continuousが途切れるため同一インスタンスを自動再開。
        // （最初のstartがユーザータップ起点なら、onend内のstartは
        //   ジェスチャー無しでも許可される）
        restartTimeoutRef.current = setTimeout(() => {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
            isListeningRef.current = false;
            recognitionRef.current = null;
          }
        }, 100);
      } else {
        setIsListening(false);
        recognitionRef.current = null;
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      // start()が同期的に例外を投げた場合（多重start等）はインスタンスを破棄
      recognitionRef.current = null;
      setError('音声認識の開始に失敗しました。マイクの権限を確認してください。');
      return;
    }

    // 起動ウォッチドッグ: 一定時間 onstart も onerror も来ない場合、
    // iOSなどでマイク起動が黙って拒否された可能性が高いので通知する
    startWatchdogRef.current = setTimeout(() => {
      if (!startedRef.current && isListeningRef.current === false) {
        recognitionRef.current = null;
        setError(
          '音声認識を開始できませんでした。マイクの権限を確認し、もう一度「開始」を押してください。（iPhoneの場合は画面をタップして開始する必要があります）',
        );
      }
    }, 4000);
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
