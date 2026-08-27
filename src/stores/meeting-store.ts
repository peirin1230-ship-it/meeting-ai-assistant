import { create } from 'zustand';
import type {
  RespondentId,
  MeetingType,
  MeetingPhase,
  AIResponse,
  RosaTsuSakuAInsight,
  ProblemSolvingInsight,
  CostTracker,
  TranscriptSegment,
  DeviceRole,
} from '@/types';
import {
  PHASE_EARLY_MINUTES,
  PHASE_MID_MINUTES,
  COST_PER_MTOK_INPUT_USD,
  COST_PER_MTOK_OUTPUT_USD,
  CACHE_WRITE_MULTIPLIER,
  CACHE_READ_MULTIPLIER,
  JPY_PER_USD,
} from '@/lib/constants';
import type { TokenUsage } from '@/lib/stream-protocol';

interface MeetingState {
  // 会議設定
  respondentId: RespondentId;
  meetingType: MeetingType;
  isActive: boolean;
  startTime: Date | null;

  // 文字起こし
  segments: TranscriptSegment[];
  interimText: string;

  // AI応答
  latestResponse: AIResponse | null;
  responseHistory: AIResponse[];
  isStreaming: boolean;
  error: string | null;

  // ロサTス作ア
  takamatsuInsight: RosaTsuSakuAInsight | null;
  // 高田貴久
  takadaInsight: ProblemSolvingInsight | null;

  // コスト
  cost: CostTracker;

  // セッション同期
  sessionCode: string | null;
  deviceRole: DeviceRole;

  // アクション
  setRespondent: (id: RespondentId) => void;
  setMeetingType: (type: MeetingType) => void;
  startMeeting: () => void;
  stopMeeting: () => void;
  addSegment: (segment: TranscriptSegment) => void;
  setInterimText: (text: string) => void;
  setLatestResponse: (response: AIResponse) => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  updateCost: (usage: TokenUsage) => void;
  getMeetingPhase: () => MeetingPhase;
  getPreviousContext: () => string | undefined;
  setSessionCode: (code: string | null) => void;
  setDeviceRole: (role: DeviceRole) => void;
  reset: () => void;
}

const initialCost: CostTracker = {
  sessionInputTokens: 0,
  sessionOutputTokens: 0,
  sessionCacheWriteTokens: 0,
  sessionCacheReadTokens: 0,
  sessionCost: 0,
  sessionCostJPY: 0,
  apiCallCount: 0,
};

export const useMeetingStore = create<MeetingState>((set, get) => ({
  respondentId: 'takamatsu',
  meetingType: 'general',
  isActive: false,
  startTime: null,
  segments: [],
  interimText: '',
  latestResponse: null,
  responseHistory: [],
  isStreaming: false,
  error: null,
  takamatsuInsight: null,
  takadaInsight: null,
  cost: { ...initialCost },
  sessionCode: null,
  deviceRole: 'standalone',

  setRespondent: (id) => set({ respondentId: id }),
  setMeetingType: (type) => set({ meetingType: type }),

  startMeeting: () =>
    set({
      isActive: true,
      startTime: new Date(),
      segments: [],
      interimText: '',
      latestResponse: null,
      responseHistory: [],
      error: null,
      takamatsuInsight: null,
      takadaInsight: null,
      cost: { ...initialCost },
    }),

  stopMeeting: () => set({ isActive: false }),

  addSegment: (segment) =>
    set((state) => ({ segments: [...state.segments, segment] })),

  // 同じ値での set は新しいstateオブジェクトを生む＝購読側の再レンダーを誘発するため、
  // 変化がないときは state をそのまま返して更新をスキップする
  setInterimText: (text) =>
    set((state) => (state.interimText === text ? state : { interimText: text })),

  setLatestResponse: (response) =>
    set((state) => ({
      latestResponse: response,
      responseHistory: [...state.responseHistory, response],
      takamatsuInsight: response.takamatsu ?? state.takamatsuInsight,
      takadaInsight: response.takada ?? state.takadaInsight,
    })),

  setStreaming: (streaming) =>
    set((state) => (state.isStreaming === streaming ? state : { isStreaming: streaming })),

  setError: (error) => set((state) => (state.error === error ? state : { error })),

  // キャッシュ書き込み(1.25倍)・読み出し(0.1倍)は単価が異なるため個別に計上する
  updateCost: (usage) =>
    set((state) => {
      // デプロイ端境期などでフィールドが欠けてもNaNにしないよう既定値を置く
      const input = state.cost.sessionInputTokens + (usage.inputTokens ?? 0);
      const output = state.cost.sessionOutputTokens + (usage.outputTokens ?? 0);
      const cacheWrite = state.cost.sessionCacheWriteTokens + (usage.cacheCreationTokens ?? 0);
      const cacheRead = state.cost.sessionCacheReadTokens + (usage.cacheReadTokens ?? 0);

      const inputUSD =
        ((input + cacheWrite * CACHE_WRITE_MULTIPLIER + cacheRead * CACHE_READ_MULTIPLIER) *
          COST_PER_MTOK_INPUT_USD) /
        1_000_000;
      const outputUSD = (output * COST_PER_MTOK_OUTPUT_USD) / 1_000_000;
      const costUSD = inputUSD + outputUSD;

      return {
        cost: {
          sessionInputTokens: input,
          sessionOutputTokens: output,
          sessionCacheWriteTokens: cacheWrite,
          sessionCacheReadTokens: cacheRead,
          sessionCost: costUSD,
          sessionCostJPY: costUSD * JPY_PER_USD,
          apiCallCount: state.cost.apiCallCount + 1,
        },
      };
    }),

  getMeetingPhase: () => {
    const { startTime } = get();
    if (!startTime) return 'early';
    const minutes = (Date.now() - startTime.getTime()) / 60_000;
    if (minutes < PHASE_EARLY_MINUTES) return 'early';
    if (minutes < PHASE_MID_MINUTES) return 'mid';
    return 'late';
  },

  getPreviousContext: () => {
    const { latestResponse } = get();
    return latestResponse?.summary ?? undefined;
  },

  setSessionCode: (code) => set({ sessionCode: code }),
  setDeviceRole: (role) => set({ deviceRole: role }),

  reset: () =>
    set({
      isActive: false,
      startTime: null,
      segments: [],
      interimText: '',
      latestResponse: null,
      responseHistory: [],
      isStreaming: false,
      error: null,
      takamatsuInsight: null,
      takadaInsight: null,
      cost: { ...initialCost },
      sessionCode: null,
      deviceRole: 'standalone',
    }),
}));
