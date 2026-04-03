'use client';

import type { RespondentId } from '@/types';
import { RESPONDENTS } from '@/lib/respondents';

interface RespondentSelectorProps {
  selected: RespondentId;
  onChange: (id: RespondentId) => void;
  disabled?: boolean;
}

export default function RespondentSelector({ selected, onChange, disabled }: RespondentSelectorProps) {
  return (
    <div className="flex gap-3">
      {RESPONDENTS.map((r) => {
        const isSelected = r.id === selected;
        return (
          <button
            key={r.id}
            onClick={() => onChange(r.id)}
            disabled={disabled}
            className={`flex-1 rounded-xl border-2 p-4 text-left transition-all ${
              isSelected
                ? 'border-current shadow-lg'
                : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            style={isSelected ? { borderColor: r.color, color: r.color } : undefined}
          >
            <div className="mb-1 flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: r.color }}
              />
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{r.name}</span>
            </div>
            <p className="mb-1 text-xs font-medium" style={isSelected ? { color: r.color } : undefined}>
              {r.methodology}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{r.description}</p>
          </button>
        );
      })}
    </div>
  );
}
