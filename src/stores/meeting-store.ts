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
import { PHASE_EARLY_MINUTES, PHASE_MID_MINUTES } from '@/lib/constants';

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
  updateCost: (inputTokens: number, outputTokens: number) => void;
  getMeetingPhase: () => MeetingPhase;
  getPreviousContext: () => string | undefined;
  setSessionCode: (code: string | null) => void;
  setDeviceRole: (role: DeviceRole) => void;
  reset: () => void;
}

const initialCost: CostTracker = {
  sessionInputTokens: 0,
  sessionOutputTokens: 0,
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

  setInterimText: (text) => set({ interimText: text }),

  setLatestResponse: (response) =>
    set((state) => ({
      latestResponse: response,
      responseHistory: [...state.responseHistory, response],
      takamatsuInsight: response.takamatsu ?? state.takamatsuInsight,
      takadaInsight: response.takada ?? state.takadaInsight,
    })),

  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setError: (error) => set({ error }),

  updateCost: (inputTokens, outputTokens) =>
    set((state) => {
      const newInput = state.cost.sessionInputTokens + inputTokens;
      const newOutput = state.cost.sessionOutputTokens + outputTokens;
      const costUSD = (newInput * 3 + newOutput * 15) / 1_000_000;
      return {
        cost: {
          sessionInputTokens: newInput,
          sessionOutputTokens: newOutput,
          sessionCost: costUSD,
          sessionCostJPY: costUSD * 150,
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
