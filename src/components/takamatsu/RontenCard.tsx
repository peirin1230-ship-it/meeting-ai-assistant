'use client';

import { ROSA_COLORS } from '@/lib/constants';

interface RontenCardProps {
  ronten: { question: string; context: string };
}

export default function RontenCard({ ronten }: RontenCardProps) {
  return (
    <div
      className="rounded-lg border-l-4 bg-red-50 p-4 dark:bg-red-900/10"
      style={{ borderLeftColor: ROSA_COLORS['ロ'] }}
    >
      <h4 className="mb-1 text-xs font-bold" style={{ color: ROSA_COLORS['ロ'] }}>
        ロ 論点
      </h4>
      <p className="text-base font-bold text-gray-900 dark:text-gray-100">
        {ronten.question}
      </p>
      {ronten.context && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{ronten.context}</p>
      )}
    </div>
  );
}
