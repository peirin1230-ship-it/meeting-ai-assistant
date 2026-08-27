'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  diagnoseMicrophone,
  getSpeechRecognitionConstructor,
  getUnsupportedReason,
  isIOS,
  type SpeechRecognitionInstance,
} from '@/lib/browser';

export type MicStatus = 'idle' | 'starting' | 'listening' | 'error';

export interface UseSpeechRecognitionReturn {
  /** 実際にマイクが動作している（onstart 済み） */
  isListening: boolean;
  /** 音声認識が利用可能な環境か */
  isSupported: boolean;
  /** 利用できない場合の理由（対処法つき） */
  unsupportedReason: string | null;
  status: MicStatus;
  transcript: string;
  interimTranscript: string;
  /** 復帰不能なエラー（録音は停止している） */
  error: string | null;
  /** 自動復帰する見込みの警告 */
  hint: string | null;
  /** 自動再開した回数（デバッグ・状態表示用） */
  restartCount: number;
  start: () => void;
  stop: () => void;
}

// マイク起動待ちの上限。iOSの権限ダイアログにユーザーが応答する時間を考慮して長めに取る
const START_WATCHDOG_MS = 12_000;
// 認識サービスが onend も onresult も返さずに沈黙した場合に強制再起動するまでの時間
const STALL_TIMEOUT_MS = 45_000;
// onend からの自動再開までの待ち時間
const RESTART_DELAY_MS = 250;
// 連続再開失敗の上限（これを超えたら諦めてユーザーに通知）
const MAX_CONSECUTIVE_FAILURES = 5;

type TimerRef = { current: ReturnType<typeof setTimeout> | null };

function clearTimer(ref: TimerRef): void {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

// 環境依存の判定はレンダー中に変化しないため、購読不要のスナップショットで扱う。
// （useEffect + setState だとSSR後に1フレーム余計に再レンダーが走る）
const subscribeNever = () => () => {};
const serverUnsupportedReason = () => null;

function isInvalidState(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'InvalidStateError';
}

function safeAbort(recognition: SpeechRecognitionInstance | null): void {
  if (!recognition) return;
  try {
    recognition.abort();
  } catch {
    // 既に停止済みなら無視
  }
}

export function useSpeechRecognition(lang: 'ja-JP' | 'en-US' = 'ja-JP'): UseSpeechRecognitionReturn {
  const [status, setStatus] = useState<MicStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [restartCount, setRestartCount] = useState(0);

  // 音声認識が使えない理由（対処法つき）。サーバー側は null を返すので
  // hydration mismatch は起きない。
  const unsupportedReason = useSyncExternalStore(
    subscribeNever,
    getUnsupportedReason,
    serverUnsupportedReason,
  );
  const isSupported = unsupportedReason === null;

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // 世代番号。start() / 致命的エラーのたびに増やし、古いインスタンスから届く
  // イベントを無視する。これがないと「停止→即開始」で古い onend が
  // 新しいインスタンスの参照を消してしまい、二重startで起動不能になる。
  const genRef = useRef(0);
  // ユーザーが「録音中でいたい」と意図しているか
  const wantListeningRef = useRef(false);
  const startedRef = useRef(false);
  const failureCountRef = useRef(0);
  const langRef = useRef(lang);

  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // scheduleRestart は buildRecognition から呼ばれ、buildRecognition は
  // scheduleRestart から呼ばれる相互再帰のため、ref 経由で解決する
  const scheduleRestartRef = useRef<(gen: number) => void>(() => {});

  // 認識インスタンス生成時に参照する言語設定を最新に保つ
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const stopAllTimers = useCallback(() => {
    clearTimer(restartTimerRef);
    clearTimer(watchdogTimerRef);
    clearTimer(stallTimerRef);
  }, []);

  // 復帰不能なエラー: 自動再開を止めてユーザーに通知する
  const failFatal = useCallback(
    (message: string) => {
      wantListeningRef.current = false;
      // 進行中インスタンスのイベントを無効化（onend で idle に上書きされるのを防ぐ）
      genRef.current += 1;
      stopAllTimers();
      const current = recognitionRef.current;
      recognitionRef.current = null;
      safeAbort(current);
      setStatus('error');
      setError(message);
      setInterimTranscript('');
    },
    [stopAllTimers],
  );

  // 認識サービスが無言のまま死ぬケース（Android Chrome で稀に発生）の検知
  const armStallTimer = useCallback((gen: number) => {
    clearTimer(stallTimerRef);
    stallTimerRef.current = setTimeout(() => {
      if (gen !== genRef.current || !wantListeningRef.current) return;
      // abort() すると onend が発火し、自動再開ロジックに乗る
      safeAbort(recognitionRef.current);
    }, STALL_TIMEOUT_MS);
  }, []);

  const buildRecognition = useCallback(
    (gen: number): SpeechRecognitionInstance => {
      const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
      if (!SpeechRecognitionCtor) throw new Error('SpeechRecognition unavailable');

      const recognition = new SpeechRecognitionCtor();
      recognition.lang = langRef.current;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      // iOS Safari は continuous:true が不安定なので、onend ごとに再開する方式にする
      recognition.continuous = !isIOS();

      recognition.onstart = () => {
        if (gen !== genRef.current) return;
        startedRef.current = true;
        failureCountRef.current = 0;
        clearTimer(watchdogTimerRef);
        setStatus('listening');
        setError(null);
        setHint(null);
        armStallTimer(gen);
      };

      recognition.onresult = (event) => {
        if (gen !== genRef.current) return;

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

        if (finalText) setTranscript((prev) => prev + finalText);
        setInterimTranscript(interimText);
        armStallTimer(gen);
      };

      recognition.onerror = (event) => {
        if (gen !== genRef.current) return;

        switch (event.error) {
          case 'no-speech':
          case 'aborted':
            // 無音・中断は onend からの自動再開でリカバリするため無視
            return;

          case 'not-allowed':
          case 'service-not-allowed':
            failFatal(
              isIOS()
                ? 'マイクの使用が許可されていません。「設定 > Safari > マイク」を許可にし、「設定 > 一般 > キーボード > 音声入力」をオンにしてから、ページを再読み込みしてください。'
                : 'マイクの使用が許可されていません。アドレスバーの鍵アイコン（サイト設定）からマイクを「許可」にして、ページを再読み込みしてください。',
            );
            return;

          case 'audio-capture':
            void diagnoseMicrophone().then((detail) => {
              if (gen !== genRef.current) return;
              failFatal(
                detail ??
                  'マイクを取得できませんでした。他のアプリがマイクを使用していないか確認してください。',
              );
            });
            return;

          case 'network':
            // 音声認識はサーバー処理のためオフラインでは動かない。onend で再試行する
            setHint('通信が不安定なため音声認識が中断されました。接続を確認してください（自動で再開します）。');
            return;

          default:
            setHint(`音声認識で問題が発生しました（${event.error}）。自動で再開します。`);
        }
      };

      recognition.onend = () => {
        if (gen !== genRef.current) return;
        clearTimer(stallTimerRef);

        if (!wantListeningRef.current) {
          recognitionRef.current = null;
          setStatus('idle');
          setInterimTranscript('');
          return;
        }

        // iOS/Android ともに認識は短時間で自動終了するため、継続には再開が必須
        scheduleRestartRef.current(gen);
      };

      return recognition;
    },
    [armStallTimer, failFatal],
  );

  const scheduleRestart = useCallback(
    (gen: number) => {
      clearTimer(restartTimerRef);
      // 失敗が続く場合は待ち時間を伸ばしてリトライ嵐を防ぐ
      const delay = RESTART_DELAY_MS * Math.min(failureCountRef.current + 1, 8);

      restartTimerRef.current = setTimeout(() => {
        if (gen !== genRef.current || !wantListeningRef.current) return;

        const current = recognitionRef.current;

        // まず同一インスタンスの再開を試す（iOSではジェスチャー無しでも許可される）
        if (current) {
          try {
            current.start();
            setRestartCount((c) => c + 1);
            armStallTimer(gen);
            return;
          } catch (e) {
            if (isInvalidState(e)) {
              // 既に起動済み。そのまま継続してよい
              armStallTimer(gen);
              return;
            }
            safeAbort(current);
            recognitionRef.current = null;
          }
        }

        // 同一インスタンスで再開できない場合は作り直す
        try {
          const fresh = buildRecognition(gen);
          recognitionRef.current = fresh;
          fresh.start();
          setRestartCount((c) => c + 1);
          armStallTimer(gen);
        } catch {
          failureCountRef.current += 1;
          if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
            failFatal('音声認識を再開できませんでした。もう一度「開始」を押してください。');
            return;
          }
          scheduleRestartRef.current(gen);
        }
      }, delay);
    },
    [armStallTimer, buildRecognition, failFatal],
  );

  useEffect(() => {
    scheduleRestartRef.current = scheduleRestart;
  }, [scheduleRestart]);

  const start = useCallback(() => {
    // 未対応環境は理由を明示して終了
    const reason = getUnsupportedReason();
    if (reason) {
      failFatal(reason);
      return;
    }
    if (!getSpeechRecognitionConstructor()) {
      failFatal('お使いのブラウザは音声認識に対応していません。Chrome または Safari をお使いください。');
      return;
    }

    // 二重start防止（タップ起点の start と useEffect 起点の start が競合しうる）
    if (wantListeningRef.current && recognitionRef.current) return;

    stopAllTimers();

    // 停止しきれていない古いインスタンスを確実に破棄する
    const stale = recognitionRef.current;
    recognitionRef.current = null;
    safeAbort(stale);

    const gen = ++genRef.current;
    wantListeningRef.current = true;
    startedRef.current = false;
    failureCountRef.current = 0;
    setError(null);
    setHint(null);
    setInterimTranscript('');
    setStatus('starting');

    let recognition: SpeechRecognitionInstance;
    try {
      recognition = buildRecognition(gen);
    } catch {
      wantListeningRef.current = false;
      setStatus('error');
      setError('音声認識を初期化できませんでした。ページを再読み込みしてお試しください。');
      return;
    }

    recognitionRef.current = recognition;

    try {
      // iOS Safari 対策: ここはユーザータップと同じ同期コンテキストで呼ばれる必要がある
      recognition.start();
    } catch (e) {
      if (!isInvalidState(e)) {
        recognitionRef.current = null;
        wantListeningRef.current = false;
        setStatus('error');
        setError('音声認識を開始できませんでした。ページを再読み込みして、もう一度お試しください。');
        return;
      }
      // InvalidStateError は既に起動済みの意味なので、そのまま継続する
    }

    // 起動ウォッチドッグ: onstart も onerror も来ない場合に原因を診断する。
    // ここではインスタンスを破棄しない（権限ダイアログ応答待ちの可能性があるため）。
    watchdogTimerRef.current = setTimeout(() => {
      if (gen !== genRef.current || startedRef.current) return;

      setHint('マイクの起動を待っています…（許可を求めるダイアログが出ていたら「許可」を押してください）');

      void diagnoseMicrophone().then((detail) => {
        if (gen !== genRef.current || startedRef.current) return;
        if (detail) {
          failFatal(detail);
        } else {
          setHint(
            'マイクは使用できますが、音声認識サービスに接続できていません。通信環境を確認し、「停止」→「開始」をお試しください。',
          );
        }
      });
    }, START_WATCHDOG_MS);
  }, [buildRecognition, failFatal, stopAllTimers]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    stopAllTimers();

    const current = recognitionRef.current;
    if (current) {
      try {
        // stop() は認識中の最後の確定結果を返してから onend を発火する
        current.stop();
      } catch {
        safeAbort(current);
      }

      // onend が来ない環境向けの保険（同一インスタンスのままなら強制破棄）
      setTimeout(() => {
        if (wantListeningRef.current) return;
        if (recognitionRef.current !== current) return;
        recognitionRef.current = null;
        safeAbort(current);
      }, 2000);
    }

    setStatus('idle');
    setInterimTranscript('');
    setHint(null);
  }, [stopAllTimers]);

  // アプリ復帰時の再開。スマホでは画面ロックやアプリ切替で認識が黙って死ぬ。
  useEffect(() => {
    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState !== 'visible') return;
      if (!wantListeningRef.current) return;
      // 既に生きていれば InvalidStateError で握り潰されるだけなので安全
      scheduleRestartRef.current(genRef.current);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // アンマウント時の後始末
  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      genRef.current += 1;
      clearTimer(restartTimerRef);
      clearTimer(watchdogTimerRef);
      clearTimer(stallTimerRef);
      const current = recognitionRef.current;
      recognitionRef.current = null;
      safeAbort(current);
    };
  }, []);

  return {
    isListening: status === 'listening',
    isSupported,
    unsupportedReason,
    status,
    transcript,
    interimTranscript,
    error,
    hint,
    restartCount,
    start,
    stop,
  };
}
