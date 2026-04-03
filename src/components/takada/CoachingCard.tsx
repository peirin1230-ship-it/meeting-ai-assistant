'use client';

interface CoachingCardProps {
  question: string;
}

export default function CoachingCard({ question }: CoachingCardProps) {
  if (!question) return null;

  return (
    <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:border-blue-800 dark:from-blue-900/20 dark:to-indigo-900/20">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">&#x1F914;</span>
        <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300">壁打ち質問</h4>
      </div>
      <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{question}</p>
    </div>
  );
}
