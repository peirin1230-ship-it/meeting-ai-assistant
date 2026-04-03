'use client';

import { useState } from 'react';
import type { AIResponse, RespondentId } from '@/types';
import RosaTsuSakuAPanel from './takamatsu/RosaTsuSakuAPanel';
import ProblemSolvingPanel from './takada/ProblemSolvingPanel';

interface InsightPanelProps {
  response: AIResponse | null;
  respondentId: RespondentId;
  isStreaming: boolean;
  streamText: string;
}

type TabId = 'analysis' | 'summary' | 'actions';

export default function InsightPanel({ response, respondentId, isStreaming, streamText }: InsightPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('analysis');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'analysis', label: respondentId === 'takamatsu' ? 'ロサTス作ア' : 'Where→Why→How' },
    { id: 'summary', label: '要約' },
    { id: 'actions', label: 'アクション' },
  ];

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* タブ */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ストリーミング中の表示 */}
      {isStreaming && (
        <div className="border-b border-gray-200 bg-blue-50 px-4 py-2 dark:border-gray-700 dark:bg-blue-900/20">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-spin rounded-full border border-blue-500 border-t-transparent" />
            <span className="text-xs text-blue-600 dark:text-blue-400">分析中...</span>
          </div>
        </div>
      )}

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'analysis' && (
          respondentId === 'takamatsu' ? (
            <RosaTsuSakuAPanel insight={response?.takamatsu} alerts={response?.alerts} />
          ) : (
            <ProblemSolvingPanel insight={response?.takada} alerts={response?.alerts} />
          )
        )}

        {activeTab === 'summary' && (
          <div className="space-y-4 p-4">
            {!response && !isStreaming && (
              <p className="text-sm text-gray-400">会議が始まると、要約がここに表示されます。</p>
            )}

            {response?.summary && (
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <h4 className="mb-1 text-xs font-bold text-gray-500 dark:text-gray-400">要約</h4>
                <p className="text-sm text-gray-800 dark:text-gray-200">{response.summary}</p>
              </div>
            )}

            {response?.keyTopics && response.keyTopics.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-bold text-gray-500 dark:text-gray-400">主要トピック</h4>
                <div className="flex flex-wrap gap-1.5">
                  {response.keyTopics.map((topic, i) => (
                    <span key={i} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {response?.suggestions && response.suggestions.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-bold text-gray-500 dark:text-gray-400">発言提案</h4>
                <div className="space-y-2">
                  {response.suggestions.map((s, i) => (
                    <div key={i} className="rounded-lg border border-gray-200 p-2.5 dark:border-gray-700">
                      <div className="mb-1 flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          s.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          s.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {s.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {response?.alerts && response.alerts.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-bold text-gray-500 dark:text-gray-400">アラート</h4>
                <div className="space-y-1.5">
                  {response.alerts.map((a, i) => (
                    <div key={i} className="rounded-lg bg-amber-50 p-2.5 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                      {a.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="p-4">
            {(!response?.actionItems || response.actionItems.length === 0) && (
              <p className="text-sm text-gray-400">アクションアイテムが検出されるとここに表示されます。</p>
            )}
            {response?.actionItems && response.actionItems.length > 0 && (
              <div className="space-y-2">
                {response.actionItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.task}</p>
                      <div className="mt-1 flex gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {item.assignee && <span>担当: {item.assignee}</span>}
                        {item.deadline && <span>期限: {item.deadline}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
