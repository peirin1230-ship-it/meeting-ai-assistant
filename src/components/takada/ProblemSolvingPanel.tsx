'use client';

import type { ProblemSolvingInsight } from '@/types';
import StepTracker from './StepTracker';
import CoachingCard from './CoachingCard';
import AntiPatternAlert from './AntiPatternAlert';

interface ProblemSolvingPanelProps {
  insight: ProblemSolvingInsight | null | undefined;
  alerts?: { type: string; message: string }[];
}

export default function ProblemSolvingPanel({ insight, alerts }: ProblemSolvingPanelProps) {
  const coinFlipAlerts = alerts?.filter((a) => a.type === 'coin_flip') ?? [];

  if (!insight) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          会議が始まると、Where→Why→How 分析がここに表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* ステップトラッカー */}
      <StepTracker currentStep={insight.currentStep} />

      {/* コインの裏返し注意報 */}
      {coinFlipAlerts.map((alert, i) => (
        <AntiPatternAlert key={i} message={alert.message} />
      ))}
      {insight.antiPatternAlert && (
        <AntiPatternAlert message={insight.antiPatternAlert} />
      )}

      {/* Where: 問題特定 */}
      {insight.where && (
        <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-3 dark:bg-blue-900/10">
          <h4 className="mb-1 text-xs font-bold text-blue-600 dark:text-blue-400">Where 問題特定</h4>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{insight.where.problem}</p>
          {insight.where.evidence && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">根拠: {insight.where.evidence}</p>
          )}
        </div>
      )}

      {/* Why: 原因追究 */}
      {insight.why && (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 dark:bg-amber-900/10">
          <h4 className="mb-1 text-xs font-bold text-amber-600 dark:text-amber-400">Why 原因追究</h4>
          {insight.why.hypothesis && (
            <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              仮説: {insight.why.hypothesis}
            </p>
          )}
          <ul className="space-y-1">
            {insight.why.rootCauses.map((cause, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300">・{cause}</li>
            ))}
          </ul>
        </div>
      )}

      {/* あるべき姿 */}
      {insight.idealState && (
        <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-3 dark:bg-emerald-900/10">
          <h4 className="mb-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">あるべき姿</h4>
          <p className="text-sm text-gray-800 dark:text-gray-200">{insight.idealState}</p>
        </div>
      )}

      {/* How: 対策立案 */}
      {insight.how && (
        <div className="rounded-lg border-l-4 border-purple-500 bg-purple-50 p-3 dark:bg-purple-900/10">
          <h4 className="mb-1 text-xs font-bold text-purple-600 dark:text-purple-400">How 対策立案</h4>
          {insight.how.priority && (
            <p className="mb-1 text-xs text-purple-500">優先度: {insight.how.priority}</p>
          )}
          <ul className="space-y-1">
            {insight.how.countermeasures.map((cm, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300">・{cm}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 壁打ち質問 */}
      <CoachingCard question={insight.coachingQuestion} />
    </div>
  );
}
