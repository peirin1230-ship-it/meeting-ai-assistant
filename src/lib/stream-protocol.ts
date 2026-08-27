// /api/chat のストリーミング応答プロトコル（SSE）。
// サーバー・クライアント双方がこの1ファイルを共有する。
//
// 従来は生テキストを垂れ流していたため、
//  - 応答末尾にトークン使用量を載せられずコスト表示が常に0だった
//  - モデルがコードブロックで囲むとJSONパースに失敗していた
// SSEで型付きイベントを流し、JSON抽出も堅牢化する。

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; usage: TokenUsage }
  | { type: 'error'; message: string };

/** 1イベントを SSE の1フレームに変換する */
export function encodeSSE(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * チャンク境界をまたぐSSEフレームを扱うためのステートフルなパーサを作る。
 * 受け取った文字列断片から、完成したイベントだけを返す。
 */
export function createSSEParser(): (chunk: string) => ChatStreamEvent[] {
  let buffer = '';

  return (chunk: string): ChatStreamEvent[] => {
    buffer += chunk;
    const events: ChatStreamEvent[] = [];

    // フレーム区切りは空行
    let separator = buffer.indexOf('\n\n');
    while (separator !== -1) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      separator = buffer.indexOf('\n\n');

      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          events.push(JSON.parse(payload) as ChatStreamEvent);
        } catch {
          // 壊れたフレームは捨てる（後続のイベントで復帰できる）
        }
      }
    }

    return events;
  };
}

/**
 * JSON文字列リテラルの中に生のまま入った制御文字をエスケープする。
 * モデルがまれに改行をそのまま出力することがあり、JSONとしては不正になるため。
 */
function escapeRawControlChars(text: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      out += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      out += char;
      if (inString) escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      out += char;
      continue;
    }
    if (inString) {
      if (char === '\n') {
        out += '\\n';
        continue;
      }
      if (char === '\r') {
        out += '\\r';
        continue;
      }
      if (char === '\t') {
        out += '\\t';
        continue;
      }
    }
    out += char;
  }

  return out;
}

/** 厳密パース → 制御文字を修復して再パース の順に試す */
function tryParse<T>(candidate: string): T | null {
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // 修復を試す
  }

  const repaired = escapeRawControlChars(candidate);
  if (repaired === candidate) return null;

  try {
    return JSON.parse(repaired) as T;
  } catch {
    return null;
  }
}

/**
 * モデル応答から JSON オブジェクトを取り出す。
 * コードフェンスで囲まれている場合や、前後に説明文が付いている場合にも対応する。
 * 取り出せなければ null。
 */
export function extractJsonObject<T>(text: string): T | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. そのままパースできればそれが一番確実
  const direct = tryParse<T>(trimmed);
  if (direct !== null) return direct;

  // 2. コードフェンスの中身を取り出す
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const inner = tryParse<T>(fenced[1].trim());
    if (inner !== null) return inner;
  }

  // 3. 最初の { から対応する } までを、文字列リテラルを考慮しつつ切り出す
  const start = trimmed.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      if (inString) escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) {
        return tryParse<T>(trimmed.slice(start, i + 1));
      }
    }
  }

  return null;
}
