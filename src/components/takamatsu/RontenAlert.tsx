'use client';

interface RontenAlertProps {
  message: string;
}

export default function RontenAlert({ message }: RontenAlertProps) {
  return (
    <div className="animate-pulse rounded-lg border-2 border-red-400 bg-red-50 p-3 dark:border-red-600 dark:bg-red-900/20">
      <div className="flex items-center gap-2">
        <span className="text-lg">&#x26A0;</span>
        <span className="text-xs font-bold text-red-600 dark:text-red-400">TASKバカ注意報</span>
      </div>
      <p className="mt-1 text-sm text-red-700 dark:text-red-300">{message}</p>
    </div>
  );
}
