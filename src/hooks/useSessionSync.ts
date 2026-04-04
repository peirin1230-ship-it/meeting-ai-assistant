'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SESSION_POLL_INTERVAL_MS } from '@/lib/constants';
import type { SessionData, SessionSegment, MeetingType, RespondentId } from '@/types';

interface UseSessionSyncOptions {
  onRemoteSegments?: (newSegments: SessionSegment[], allSegments: SessionSegment[]) => void;
  onRemoteInterim?: (interimText: string) => void;
  onSessionEnded?: () => void;
  onError?: (error: string) => void;
}

interface UseSessionSyncReturn {
  createSession: (meetingType: MeetingType, respondentId: RespondentId) => Promise<string | null>;
  joinSession: (code: string) => Promise<SessionData | null>;
  pushTranscript: (segments?: SessionSegment[], interimText?: string) => Promise<void>;
  endSession: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  isPolling: boolean;
  isConnected: boolean;
  sessionData: SessionData | null;
}

export function useSessionSync(options: UseSessionSyncOptions = {}): UseSessionSyncReturn {
  const [isPolling, setIsPolling] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  const sessionCodeRef = useRef<string | null>(null);
  const lastVersionRef = useRef(0);
  const lastInterimRef = useRef('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const createSession = useCallback(
    async (meetingType: MeetingType, respondentId: RespondentId): Promise<string | null> => {
      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingType, respondentId }),
        });
        if (!res.ok) throw new Error('セッション作成失敗');
        const { sessionCode } = await res.json();
        sessionCodeRef.current = sessionCode;
        setIsConnected(true);
        return sessionCode;
      } catch (e) {
        optionsRef.current.onError?.(e instanceof Error ? e.message : 'セッション作成失敗');
        return null;
      }
    },
    []
  );

  const joinSession = useCallback(async (code: string): Promise<SessionData | null> => {
    try {
      const upperCode = code.toUpperCase();
      const res = await fetch(`/api/session/${upperCode}`);
      if (!res.ok) {
        optionsRef.current.onError?.(
          res.status === 404 ? 'セッションが見つかりません' : 'セッション取得失敗'
        );
        return null;
      }
      const data: SessionData = await res.json();
      sessionCodeRef.current = upperCode;
      lastVersionRef.current = data.segmentVersion;
      lastInterimRef.current = data.interimText;
      setSessionData(data);
      setIsConnected(true);
      return data;
    } catch (e) {
      optionsRef.current.onError?.(e instanceof Error ? e.message : 'セッション参加失敗');
      return null;
    }
  }, []);

  const pushTranscript = useCallback(
    async (segments?: SessionSegment[], interimText?: string): Promise<void> => {
      const code = sessionCodeRef.current;
      if (!code) return;
      try {
        const res = await fetch(`/api/session/${code}/transcript`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segments, interimText }),
        });
        if (!res.ok && res.status === 410) {
          optionsRef.current.onSessionEnded?.();
        }
      } catch {
        // ネットワークエラーは次回リトライ
      }
    },
    []
  );

  const endSession = useCallback(async (): Promise<void> => {
    const code = sessionCodeRef.current;
    if (!code) return;
    try {
      await fetch(`/api/session/${code}`, { method: 'DELETE' });
    } catch {
      // ベストエフォート
    }
    stopPolling();
    sessionCodeRef.current = null;
    setIsConnected(false);
    setSessionData(null);
  }, []);

  const poll = useCallback(async () => {
    const code = sessionCodeRef.current;
    if (!code) return;

    try {
      const res = await fetch(`/api/session/${code}`);
      if (!res.ok) {
        if (res.status === 404) {
          optionsRef.current.onSessionEnded?.();
          stopPolling();
        }
        return;
      }
      const data: SessionData = await res.json();

      if (!data.isActive) {
        optionsRef.current.onSessionEnded?.();
        stopPolling();
        return;
      }

      setSessionData(data);

      // 新しい確定セグメントがあるか
      if (data.segmentVersion > lastVersionRef.current) {
        const newSegments = data.segments.slice(
          // 前回のバージョンで何個あったか推定（差分取得）
          lastVersionRef.current > 0
            ? data.segments.length - (data.segmentVersion - lastVersionRef.current)
            : 0
        );
        lastVersionRef.current = data.segmentVersion;
        optionsRef.current.onRemoteSegments?.(newSegments, data.segments);
      }

      // interimテキストの変更
      if (data.interimText !== lastInterimRef.current) {
        lastInterimRef.current = data.interimText;
        optionsRef.current.onRemoteInterim?.(data.interimText);
      }
    } catch {
      // ネットワークエラーは次回リトライ
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    setIsPolling(true);
    // 即座に1回ポーリング
    poll();
    pollingRef.current = setInterval(poll, SESSION_POLL_INTERVAL_MS);
  }, [poll]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    createSession,
    joinSession,
    pushTranscript,
    endSession,
    isPolling,
    isConnected,
    sessionData,
    startPolling,
    stopPolling,
  };
}
