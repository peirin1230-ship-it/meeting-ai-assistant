'use client';

import type { MicStatus } from '@/hooks/useSpeechRecognition';

interface MicStatusBarProps {
  status: MicStatus;
  hint: string | null;
  isActive: boolean;
  segmentCount: number;
  interimText: string;
}

const STATUS_LABEL: Record<MicStatus, string> = {
  idle: 'マイク停止中',
  starting: 'マイクを起動しています…',
  listening: '録音中',
  error: 'マイクエラー',
};

const STATUS_DOT: Record<MicStatus, string> = {
  idle: 'bg-gray-300 dark:bg-gray-600',
  starting: 'bg-amber-400 animate-pulse',
  listening: 'bg-red-500 animate-pulse',
  error: 'bg-red-600',
};

const STATUS_TEXT: Record<MicStatus, string> = {
  idle: 'text-gray-500 dark:text-gray-400',
  starting: 'text-amber-600 dark:text-amber-400',
  listening: 'text-red-600 dark:text-red-400',
  error: 'text-red-600 dark:text-red-400',
};

/**
 * マイクの状態を常時表示するバー。
 * スマホでは文字起こしパネルが折りたたまれているため、
 * これがないと「録音できているか」がまったく分からない。
 */
export default function MicStatusBar({
  status,
  hint,
  isActive,
  segmentCount,
  interimText,
}: MicStatusBarProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
        <span className={`text-xs font-semibold ${STATUS_TEXT[status]}`}>
          {STATUS_LABEL[status]}
        </span>

        {isActive && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            認識 {segmentCount} 件
          </span>
        )}

        {status === 'listening' && segmentCount === 0 && !interimText && (
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
            マイクに向かって話してください
          </span>
        )}

        {status === 'starting' && (
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
            許可を求められたら「許可」を選択
          </span>
        )}
      </div>

      {/* 認識中のテキスト = 「今まさに拾えている」ことの証拠になる */}
      {interimText && (
        <p className="mt-1 truncate text-xs italic text-gray-500 dark:text-gray-400">
          {interimText}
        </p>
      )}

      {hint && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{hint}</p>
      )}
    </div>
  );
}
