'use client';

import { useEffect, useRef } from 'react';

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

/**
 * 録音中に画面ロック／スリープを防ぐ。
 * スマホでは画面が消えると音声認識が停止してしまうため、対面会議では必須。
 * Wake Lock API 非対応（iOS 16.4未満など）の場合は何もしない。
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    const release = () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) {
        void sentinel.release().catch(() => {
          // 既に解除済みなら無視
        });
      }
    };

    const acquire = async () => {
      if (typeof navigator === 'undefined') return;
      const wakeLock = (navigator as WakeLockNavigator).wakeLock;
      if (!wakeLock || sentinelRef.current) return;

      try {
        const sentinel = await wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        // 非対応／ユーザー操作外の取得失敗は無視（録音自体は継続できる）
      }
    };

    // バックグラウンドに入ると Wake Lock は自動解除されるため、復帰時に取り直す
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void acquire();
      } else {
        sentinelRef.current = null;
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      release();
    };
  }, [active]);
}
