import { COST_PER_MTOK_INPUT_USD, COST_PER_MTOK_OUTPUT_USD } from './constants';

// 日本語テキストのトークン数を概算する
// 日本語は1文字あたり約1.5トークン、英数字は約4文字で1トークン
export function estimateTokens(text: string): number {
  if (!text) return 0;

  const japaneseChars = text.match(/[\u3000-\u9FFF\uF900-\uFAFF]/g)?.length ?? 0;
  const japaneseTokens = japaneseChars * 1.5;
  const englishTokens = (text.length - japaneseChars) / 4;

  return Math.ceil(japaneseTokens + englishTokens);
}

// コスト計算（USD）
export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens * COST_PER_MTOK_INPUT_USD + outputTokens * COST_PER_MTOK_OUTPUT_USD) / 1_000_000
  );
}
