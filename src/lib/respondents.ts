import type { Respondent } from '@/types';

export const RESPONDENTS: Respondent[] = [
  {
    id: 'takamatsu',
    name: '高松智司',
    methodology: 'ロサTス作ア',
    description: 'BCGコンサル出身。論点→サブ論点→TASK→スケジュール→作業→アウトプットの6ステップで構造化。TASKバカ注意報つき。',
    color: '#E8443A',
  },
  {
    id: 'takada',
    name: '高田貴久',
    methodology: 'Where→Why→How',
    description: '問題解決の壁打ちパートナー。7ステップで問題を特定→原因追究→対策立案。温かく鋭い問いかけで思考を深める。',
    color: '#2563EB',
  },
];

export function getRespondent(id: string): Respondent {
  return RESPONDENTS.find((r) => r.id === id) ?? RESPONDENTS[0];
}
