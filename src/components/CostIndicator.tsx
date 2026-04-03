'use client';

import type { CostTracker } from '@/types';

interface CostIndicatorProps {
  cost: CostTracker;
}

export default function CostIndicator({ cost }: CostIndicatorProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
      <span>
        &#xA5;{cost.sessionCostJPY.toFixed(1)} (${cost.sessionCost.toFixed(3)})
      </span>
      <span>
        {cost.sessionInputTokens.toLocaleString()} + {cost.sessionOutputTokens.toLocaleString()} tokens
      </span>
      <span>{cost.apiCallCount} calls</span>
    </div>
  );
}
