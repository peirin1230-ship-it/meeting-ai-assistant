'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  deleteRecording,
  estimateStorage,
  getRecordingBlob,
  listRecordings,
  type RecordingMeta,
} from '@/lib/recordings-db';
import type { RecorderStatus } from '@/hooks/useAudioRecorder';
import { isIOS } from '@/lib/browser';
import { useClientFlag } from '@/hooks/useClientFlag';

interface RecordingsPanelProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  isSupported: boolean;
  status: RecorderStatus;
  bytesRecorded: number;
  error: string | null;
  isMeetingActive: boolean;
  /** 会議終了時などに一覧を更新させるためのカウンタ */
  refreshToken: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 即座に revoke するとダウンロードが始まらない環境があるため少し待つ
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function RecordingsPanel({
  enabled,
  onEnabledChange,
  isSupported,
  status,
  bytesRecorded,
  error,
  isMeetingActive,
  refreshToken,
}: RecordingsPanelProps) {
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  // レンダー中に navigator を見ると hydration mismatch になる
  const iOS = useClientFlag(isIOS);

  const refresh = useCallback(async () => {
    try {
      setRecordings(await listRecordings());
      setStorage(await estimateStorage());
      setListError(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : '保存済み録音を読み込めませんでした');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshToken]);

  const handleDownloadAudio = async (meta: RecordingMeta) => {
    setBusyId(meta.id);
    try {
      const blob = await getRecordingBlob(meta.id, meta.mimeType);
      const stamp = meta.startedAt.slice(0, 19).replace(/[:T]/g, '');
      download(blob, `meeting-${stamp}.${extensionFor(meta.mimeType)}`);
    } catch (e) {
      setListError(e instanceof Error ? e.message : '音声の書き出しに失敗しました');
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadTranscript = (meta: RecordingMeta) => {
    const stamp = meta.startedAt.slice(0, 19).replace(/[:T]/g, '');
    const blob = new Blob([meta.transcript || '(文字起こしなし)'], {
      type: 'text/plain;charset=utf-8',
    });
    download(blob, `meeting-${stamp}.txt`);
  };

  const handleDelete = async (meta: RecordingMeta) => {
    setBusyId(meta.id);
    try {
      await deleteRecording(meta.id);
      await refresh();
    } catch (e) {
      setListError(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!isSupported || isMeetingActive}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <span className="font-medium text-gray-700 dark:text-gray-300">音声も端末に保存する</span>
        {status === 'recording' && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {formatBytes(bytesRecorded)}
          </span>
        )}
      </label>

      {!isSupported && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          このブラウザは録音（MediaRecorder）に対応していません。
        </p>
      )}

      {isSupported && enabled && iOS && !isMeetingActive && (
        <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
          iPhone では音声認識と録音がマイクを取り合うことがあります。文字起こしが止まる場合は
          このチェックを外してください。
        </p>
      )}

      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {listError && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{listError}</p>}

      {recordings.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400">
              保存済み（{recordings.length}件・端末内）
            </h3>
            {storage && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                使用 {formatBytes(storage.usage)} / 空き {formatBytes(storage.quota)}
              </span>
            )}
          </div>

          {recordings.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-gray-200 p-2.5 dark:border-gray-700"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {new Date(r.startedAt).toLocaleString('ja-JP')}
                </span>
                <span>{formatDuration(r.durationMs)}</span>
                <span>{formatBytes(r.sizeBytes)}</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => handleDownloadAudio(r)}
                  disabled={busyId === r.id}
                  className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  {busyId === r.id ? '書き出し中...' : '音声を保存'}
                </button>
                <button
                  onClick={() => handleDownloadTranscript(r)}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  文字起こしを保存
                </button>
                <button
                  onClick={() => handleDelete(r)}
                  disabled={busyId === r.id}
                  className="ml-auto rounded-lg px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
