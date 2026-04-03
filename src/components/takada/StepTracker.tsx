'use client';

import type { ProblemSolvingStep } from '@/types';
import { PROBLEM_SOLVING_STEPS } from '@/lib/constants';

interface StepTrackerProps {
  currentStep: ProblemSolvingStep;
}

export default function StepTracker({ currentStep }: StepTrackerProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {PROBLEM_SOLVING_STEPS.map((step) => {
        const isCompleted = step.step < currentStep;
        const isCurrent = step.step === currentStep;
        return (
          <div
            key={step.step}
            className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
              isCurrent
                ? 'bg-blue-600 text-white shadow-md'
                : isCompleted
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
            }`}
          >
            {isCompleted ? (
              <span>&#x2713;</span>
            ) : (
              <span>{step.emoji}</span>
            )}
            <span className="hidden sm:inline">{step.labelEn}</span>
          </div>
        );
      })}
    </div>
  );
}
