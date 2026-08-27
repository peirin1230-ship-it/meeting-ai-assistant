'use client';

import type { CostTracker } from '@/types';

interface CostIndicatorProps {
  cost: CostTracker;
}

export default function CostIndicator({ cost }: CostIndicatorProps) {
  const cacheTotal = cost.sessionCacheWriteTokens + cost.sessionCacheReadTokens;
  // キャッシュが効いているほど入力コストが下がる。効いていないと単価10倍になるので可視化する
  const cacheHitRate =
    cacheTotal > 0 ? Math.round((cost.sessionCacheReadTokens / cacheTotal) * 100) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
      <span>
        &#xA5;{cost.sessionCostJPY.toFixed(1)} (${cost.sessionCost.toFixed(3)})
      </span>
      <span>
        {cost.sessionInputTokens.toLocaleString()} + {cost.sessionOutputTokens.toLocaleString()} tokens
      </span>
      {cacheHitRate !== null && (
        <span title="プロンプトキャッシュのヒット率。高いほど入力コストが下がります">
          キャッシュ {cacheHitRate}%
        </span>
      )}
      <span>{cost.apiCallCount} calls</span>
    </div>
  );
}
