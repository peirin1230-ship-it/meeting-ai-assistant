import type { RosaPhase, ProblemSolvingStep } from '@/types';

// ロサTス作ア 各ステップのカラー（rosatsusakua-memo 準拠）
export const ROSA_COLORS: Record<RosaPhase, string> = {
  'ロ': '#E8443A',
  'サ': '#E07B2E',
  'T': '#D4A72C',
  'ス': '#6e9e7e',
  '作': '#7090b0',
  'ア': '#8a80b0',
};

export const ROSA_LABELS: Record<RosaPhase, string> = {
  'ロ': '論点',
  'サ': 'サブ論点',
  'T': 'TASK',
  'ス': 'スケジュール',
  '作': '作業',
  'ア': 'アウトプット',
};

export const ROSA_PHASES: RosaPhase[] = ['ロ', 'サ', 'T', 'ス', '作', 'ア'];

// 高田貴久 7ステップ定義
export const PROBLEM_SOLVING_STEPS: {
  step: ProblemSolvingStep;
  label: string;
  labelEn: string;
  description: string;
  emoji: string;
}[] = [
  { step: 1, label: '手順理解', labelEn: 'Process', description: '問題解決の手順を理解する', emoji: '📋' },
  { step: 2, label: '問題特定', labelEn: 'Where', description: '問題がどこにあるか特定する', emoji: '🔍' },
  { step: 3, label: '原因追究', labelEn: 'Why', description: 'なぜその問題が起きているか', emoji: '🔬' },
  { step: 4, label: 'あるべき姿', labelEn: 'Ideal', description: '理想の状態を定義する', emoji: '🎯' },
  { step: 5, label: '対策立案', labelEn: 'How', description: '具体的な対策を立案する', emoji: '💡' },
  { step: 6, label: '実行', labelEn: 'Execute', description: '対策を実行に移す', emoji: '🚀' },
  { step: 7, label: '定着化', labelEn: 'Sustain', description: '結果を評価し定着させる', emoji: '📊' },
];

// 会議タイプ
export const MEETING_TYPES = [
  { id: 'general' as const, label: '汎用', description: '一般的な会議' },
  { id: 'sales' as const, label: '営業商談', description: '顧客との商談・提案' },
  { id: 'internal' as const, label: '社内MTG', description: '社内の定例・報告会議' },
  { id: 'brainstorm' as const, label: 'ブレスト', description: 'アイデア出し・企画会議' },
  { id: 'one_on_one' as const, label: '1on1', description: '上司と部下の1対1面談' },
  { id: 'review' as const, label: 'レビュー', description: '成果物・進捗のレビュー会議' },
];

// バッファ設定
export const BUFFER_SEND_INTERVAL_MS = 30_000;
export const BUFFER_SEND_CHAR_THRESHOLD = 300;

// コスト設定
export const COST_LIMIT_PER_SESSION_USD = 1.0;
export const JPY_PER_USD = 150;

// 会議フェーズ判定（分）
export const PHASE_EARLY_MINUTES = 10;
export const PHASE_MID_MINUTES = 40;
