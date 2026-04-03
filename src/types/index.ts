// ============================================================
// 回答者（Respondent）
// ============================================================

export type RespondentId = 'takamatsu' | 'takada';

export interface Respondent {
  id: RespondentId;
  name: string;
  methodology: string;
  description: string;
  color: string;
}

// ============================================================
// 会議タイプ
// ============================================================

export type MeetingType =
  | 'sales'
  | 'internal'
  | 'brainstorm'
  | 'one_on_one'
  | 'review'
  | 'general';

// ============================================================
// 音声認識
// ============================================================

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

export interface TranscriptBuffer {
  segments: TranscriptSegment[];
  currentInterim: string;
  totalTokenEstimate: number;
}

// ============================================================
// AI 応答（共通）
// ============================================================

export interface Suggestion {
  type: 'question' | 'point' | 'counterargument' | 'clarification';
  text: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ActionItem {
  task: string;
  assignee?: string;
  deadline?: string;
}

export interface Alert {
  type: 'missing_topic' | 'contradiction' | 'time_warning' | 'decision_needed' | 'task_baka' | 'coin_flip';
  message: string;
}

export interface AIResponse {
  respondentId: RespondentId;
  summary: string;
  suggestions: Suggestion[];
  actionItems: ActionItem[];
  alerts: Alert[];
  keyTopics: string[];
  takamatsu?: RosaTsuSakuAInsight;
  takada?: ProblemSolvingInsight;
}

// ============================================================
// 高松智司 — ロサTス作ア
// ============================================================

export type RosaPhase = 'ロ' | 'サ' | 'T' | 'ス' | '作' | 'ア';

export interface SubRonten {
  id: string;
  question: string;
  status: 'identified' | 'discussed' | 'resolved';
}

export interface RosaTask {
  id: string;
  content: string;
  assignee?: string;
  priority: 'high' | 'medium' | 'low';
  subRontenId: string;
}

export interface RosaTsuSakuAInsight {
  ronten: { question: string; context: string };
  subRonten: SubRonten[];
  tasks: RosaTask[];
  schedule: { taskId: string; order: number; reasoning: string }[];
  currentPhase: RosaPhase;
  output: { deliverables: string[]; nextStep: string };
}

// ============================================================
// 高田貴久 — Where→Why→How 問題解決
// ============================================================

export type ProblemSolvingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ProblemSolvingInsight {
  currentStep: ProblemSolvingStep;
  stepLabel: string;
  where?: { problem: string; evidence: string };
  why?: { rootCauses: string[]; hypothesis: string };
  idealState?: string;
  how?: { countermeasures: string[]; priority: string };
  coachingQuestion: string;
  antiPatternAlert?: string;
}

// ============================================================
// API リクエスト / コスト管理
// ============================================================

export type MeetingPhase = 'early' | 'mid' | 'late';

export interface ChatRequest {
  transcript: string;
  meetingType: MeetingType;
  respondentId: RespondentId;
  previousContext?: string;
  previousInsight?: RosaTsuSakuAInsight | ProblemSolvingInsight;
  requestType: 'summary' | 'suggestion' | 'action_items' | 'auto';
  meetingPhase: MeetingPhase;
}

export interface CostTracker {
  sessionInputTokens: number;
  sessionOutputTokens: number;
  sessionCost: number;
  sessionCostJPY: number;
  apiCallCount: number;
}

// ============================================================
// 音声認識設定
// ============================================================

export interface SpeechRecognitionConfig {
  lang: 'ja-JP' | 'en-US';
  continuous: boolean;
  interimResults: boolean;
}
