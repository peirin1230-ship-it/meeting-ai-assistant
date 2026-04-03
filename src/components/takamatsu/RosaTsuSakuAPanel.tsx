'use client';

import type { RosaTsuSakuAInsight } from '@/types';
import { ROSA_PHASES, ROSA_COLORS, ROSA_LABELS } from '@/lib/constants';
import RontenCard from './RontenCard';
import SubRontenTree from './SubRontenTree';
import RontenAlert from './RontenAlert';

interface RosaTsuSakuAPanelProps {
  insight: RosaTsuSakuAInsight | null | undefined;
  alerts?: { type: string; message: string }[];
}

export default function RosaTsuSakuAPanel({ insight, alerts }: RosaTsuSakuAPanelProps) {
  const taskBakaAlerts = alerts?.filter((a) => a.type === 'task_baka') ?? [];

  if (!insight) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          会議が始まると、ロサTス作ア分析がここに表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* フローインジケーター */}
      <div className="flex items-center justify-between gap-1">
        {ROSA_PHASES.map((phase, i) => {
          const isActive = phase === insight.currentPhase;
          const color = ROSA_COLORS[phase];
          return (
            <div key={phase} className="flex items-center">
              <div
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                  isActive ? 'scale-110 shadow-md' : 'opacity-50'
                }`}
                style={{
                  backgroundColor: isActive ? color : undefined,
                  color: isActive ? 'white' : color,
                  border: `2px solid ${color}`,
                }}
              >
                <span>{phase}</span>
                <span className="hidden sm:inline">{ROSA_LABELS[phase]}</span>
              </div>
              {i < ROSA_PHASES.length - 1 && (
                <span className="mx-0.5 text-gray-300 dark:text-gray-600">→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* TASKバカ注意報 */}
      {taskBakaAlerts.map((alert, i) => (
        <RontenAlert key={i} message={alert.message} />
      ))}

      {/* 論点カード */}
      <RontenCard ronten={insight.ronten} />

      {/* サブ論点ツリー */}
      {insight.subRonten.length > 0 && (
        <SubRontenTree subRonten={insight.subRonten} tasks={insight.tasks} />
      )}

      {/* スケジュール */}
      {insight.schedule.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
          <h4 className="mb-2 text-xs font-bold" style={{ color: ROSA_COLORS['ス'] }}>
            ス スケジュール
          </h4>
          <ol className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {insight.schedule
              .sort((a, b) => a.order - b.order)
              .map((s) => {
                const task = insight.tasks.find((t) => t.id === s.taskId);
                return (
                  <li key={s.taskId} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-200 text-xs font-bold text-green-800 dark:bg-green-800 dark:text-green-200">
                      {s.order}
                    </span>
                    <div>
                      <span>{task?.content ?? s.taskId}</span>
                      <span className="ml-2 text-xs text-gray-400">{s.reasoning}</span>
                    </div>
                  </li>
                );
              })}
          </ol>
        </div>
      )}

      {/* アウトプット */}
      {insight.output.deliverables.length > 0 && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-900/20">
          <h4 className="mb-2 text-xs font-bold" style={{ color: ROSA_COLORS['ア'] }}>
            ア アウトプット
          </h4>
          <ul className="mb-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {insight.output.deliverables.map((d, i) => (
              <li key={i}>・{d}</li>
            ))}
          </ul>
          {insight.output.nextStep && (
            <p className="text-xs text-purple-600 dark:text-purple-400">
              次のステップ: {insight.output.nextStep}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
