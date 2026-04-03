'use client';

import type { RespondentId, MeetingType } from '@/types';
import MeetingTypeSelector from './MeetingTypeSelector';
import { getRespondent } from '@/lib/respondents';

interface ControlBarProps {
  isActive: boolean;
  respondentId: RespondentId;
  meetingType: MeetingType;
  onStart: () => void;
  onStop: () => void;
  onMeetingTypeChange: (type: MeetingType) => void;
  onRequestInsight: () => void;
  isStreaming: boolean;
}

export default function ControlBar({
  isActive,
  respondentId,
  meetingType,
  onStart,
  onStop,
  onMeetingTypeChange,
  onRequestInsight,
  isStreaming,
}: ControlBarProps) {
  const respondent = getRespondent(respondentId);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* 開始/停止ボタン */}
      <button
        onClick={isActive ? onStop : onStart}
        className={`rounded-lg px-5 py-2 text-sm font-bold text-white transition-all ${
          isActive
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-green-500 hover:bg-green-600'
        }`}
      >
        {isActive ? '停止' : '開始'}
      </button>

      {/* 会議タイプ選択 */}
      <MeetingTypeSelector
        selected={meetingType}
        onChange={onMeetingTypeChange}
        disabled={isActive}
      />

      {/* 回答者表示 */}
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: respondent.color }} />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {respondent.name}
        </span>
      </div>

      {/* 手動インサイト要求 */}
      {isActive && (
        <button
          onClick={onRequestInsight}
          disabled={isStreaming}
          className="ml-auto rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
        >
          {isStreaming ? '分析中...' : '今すぐ分析'}
        </button>
      )}
    </div>
  );
}
