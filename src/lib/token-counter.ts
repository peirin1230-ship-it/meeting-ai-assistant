// 日本語テキストのトークン数を概算する
// 日本語は1文字あたり約1.5トークン（Claude の場合）
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // 日本語文字の割合を判定
  const japaneseChars = text.match(/[\u3000-\u9FFF\uF900-\uFAFF]/g)?.length ?? 0;
  const totalChars = text.length;
  const japaneseRatio = totalChars > 0 ? japaneseChars / totalChars : 0;

  // 日本語は文字数 × 1.5、英語は文字数 / 4
  const japaneseTokens = japaneseChars * 1.5;
  const englishTokens = (totalChars - japaneseChars) / 4;

  return Math.ceil(japaneseTokens + englishTokens);
}

// コスト計算（USD）
// Claude Sonnet 4.6: input $3/MTok, output $15/MTok
export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
}
