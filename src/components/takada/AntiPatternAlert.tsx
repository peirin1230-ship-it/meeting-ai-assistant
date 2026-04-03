'use client';

interface AntiPatternAlertProps {
  message: string;
}

export default function AntiPatternAlert({ message }: AntiPatternAlertProps) {
  return (
    <div className="animate-pulse rounded-lg border-2 border-amber-400 bg-amber-50 p-3 dark:border-amber-600 dark:bg-amber-900/20">
      <div className="flex items-center gap-2">
        <span className="text-lg">&#x1FA99;</span>
        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">コインの裏返し注意</span>
      </div>
      <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{message}</p>
    </div>
  );
}
