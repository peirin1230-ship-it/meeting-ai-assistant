'use client';

import type { SubRonten, RosaTask } from '@/types';
import { ROSA_COLORS } from '@/lib/constants';

interface SubRontenTreeProps {
  subRonten: SubRonten[];
  tasks: RosaTask[];
}

const STATUS_BADGE: Record<SubRonten['status'], { label: string; className: string }> = {
  identified: { label: '特定', className: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  discussed: { label: '議論中', className: 'bg-yellow-200 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200' },
  resolved: { label: '解決', className: 'bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-200' },
};

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-400',
};

export default function SubRontenTree({ subRonten, tasks }: SubRontenTreeProps) {
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-900/10">
      <h4 className="mb-3 text-xs font-bold" style={{ color: ROSA_COLORS['サ'] }}>
        サ サブ論点
      </h4>
      <div className="space-y-3">
        {subRonten.map((sr) => {
          const relatedTasks = tasks.filter((t) => t.subRontenId === sr.id);
          const badge = STATUS_BADGE[sr.status];
          return (
            <div key={sr.id} className="relative pl-4">
              {/* ツリーコネクター */}
              <div className="absolute left-0 top-0 h-full w-px bg-orange-300 dark:bg-orange-700" />
              <div className="absolute left-0 top-2.5 h-px w-3 bg-orange-300 dark:bg-orange-700" />

              <div className="flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.className}`}>
                  {badge.label}
                </span>
                <p className="text-sm text-gray-800 dark:text-gray-200">{sr.question}</p>
              </div>

              {/* 関連TASK */}
              {relatedTasks.length > 0 && (
                <div className="ml-4 mt-1.5 space-y-1">
                  {relatedTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] ?? 'bg-gray-400'}`} />
                      <span>{task.content}</span>
                      {task.assignee && (
                        <span className="rounded bg-gray-100 px-1 text-[10px] dark:bg-gray-800">
                          {task.assignee}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
