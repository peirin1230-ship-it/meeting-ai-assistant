'use client';

import type { MeetingType } from '@/types';
import { MEETING_TYPES } from '@/lib/constants';

interface MeetingTypeSelectorProps {
  selected: MeetingType;
  onChange: (type: MeetingType) => void;
  disabled?: boolean;
}

export default function MeetingTypeSelector({ selected, onChange, disabled }: MeetingTypeSelectorProps) {
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value as MeetingType)}
      disabled={disabled}
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 disabled:opacity-50"
    >
      {MEETING_TYPES.map((mt) => (
        <option key={mt.id} value={mt.id}>
          {mt.label}
        </option>
      ))}
    </select>
  );
}
