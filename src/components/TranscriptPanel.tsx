'use client';

import { useEffect, useRef } from 'react';
import type { TranscriptSegment } from '@/types';

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  interimText: string;
  isListening: boolean;
}

export default function TranscriptPanel({ segments, interimText, isListening }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, interimText]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">文字起こし</h2>
        {isListening && (
          <span className="flex items-center gap-1.5 text-xs text-red-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            録音中
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {segments.length === 0 && !interimText && (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            会議を開始すると、ここに文字起こしが表示されます。
          </p>
        )}

        {segments.map((seg) => (
          <div key={seg.id} className="group">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {seg.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <p className="text-sm text-gray-800 dark:text-gray-200">{seg.text}</p>
          </div>
        ))}

        {interimText && (
          <div className="group">
            <p className="text-sm text-gray-400 italic dark:text-gray-500">{interimText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
