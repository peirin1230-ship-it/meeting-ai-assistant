'use client';

import { useState } from 'react';
import type { DeviceRole } from '@/types';

interface SessionBarProps {
  deviceRole: DeviceRole;
  sessionCode: string | null;
  isConnected: boolean;
  onCreateSession: () => Promise<void>;
  onJoinSession: (code: string) => Promise<void>;
  onLeaveSession: () => void;
  disabled: boolean;
}

export default function SessionBar({
  deviceRole,
  sessionCode,
  isConnected,
  onCreateSession,
  onJoinSession,
  onLeaveSession,
  disabled,
}: SessionBarProps) {
  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      await onCreateSession();
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (joinCode.length < 6) return;
    setIsLoading(true);
    try {
      await onJoinSession(joinCode.toUpperCase());
      setShowJoinInput(false);
      setJoinCode('');
    } finally {
      setIsLoading(false);
    }
  };

  // セッション参加中の表示
  if (sessionCode && isConnected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
            {deviceRole === 'phone' ? 'スマホ（音声送信中）' : 'PC（分析表示中）'}
          </span>
        </div>

        <div className="rounded-lg bg-white px-3 py-1 font-mono text-lg font-bold tracking-widest text-blue-800 dark:bg-gray-800 dark:text-blue-200">
          {sessionCode}
        </div>

        <button
          onClick={onLeaveSession}
          className="ml-auto rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          切断
        </button>
      </div>
    );
  }

  // コード入力モード
  if (showJoinInput) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <input
          type="text"
          maxLength={6}
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="6桁コード"
          className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 font-mono text-center text-lg tracking-widest dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          autoFocus
        />
        <button
          onClick={handleJoin}
          disabled={joinCode.length < 6 || isLoading}
          className="rounded-lg bg-blue-500 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? '接続中...' : '参加'}
        </button>
        <button
          onClick={() => { setShowJoinInput(false); setJoinCode(''); }}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
        >
          戻る
        </button>
      </div>
    );
  }

  // デフォルト: 選択ボタン表示
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <span className="text-xs text-gray-500 dark:text-gray-400">デバイス連携:</span>
      <button
        onClick={handleCreate}
        disabled={disabled || isLoading}
        className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-50 disabled:opacity-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
      >
        {isLoading ? '作成中...' : 'スマホで音声送信'}
      </button>
      <button
        onClick={() => setShowJoinInput(true)}
        disabled={disabled}
        className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
      >
        PCで分析表示
      </button>
    </div>
  );
}
