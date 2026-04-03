# Meeting AI Assistant — CLAUDE.md

## プロジェクト概要

リアルタイム会議支援AIアシスタント。会議中の音声をブラウザのWeb Speech APIで認識し、Claude API（Sonnet 4.6）を使って会議中にリアルタイムで示唆・要約・発言提案を提供する。

**ターゲットユーザー:** 日本語のビジネス会議を行う個人・チーム
**利用シーン:** 対面会議（スマホマイク）＋ オンライン会議（PCブラウザ）

---

## 技術スタック

| レイヤー | 技術 | 理由 |
|---------|------|------|
| フレームワーク | Next.js 14+ (App Router) | フロント+APIルート一体、Vercelデプロイ容易 |
| 言語 | TypeScript | 型安全性 |
| スタイリング | Tailwind CSS | 高速開発、レスポンシブ対応 |
| 状態管理 | Zustand | 軽量、リアルタイム更新に適合 |
| AI API | Anthropic Claude API (Sonnet 4.6) | 日本語品質重視 |
| デプロイ | Vercel | Next.js最適、GitHub連携 |
| VCS | GitHub | リポジトリ管理 |

---

## ディレクトリ構成

```
meeting-ai-assistant/
├── CLAUDE.md                    # この仕様書
├── README.md                    # プロジェクト説明
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── .env.local                   # ANTHROPIC_API_KEY（gitignore対象）
├── .env.example                 # 環境変数テンプレート
├── .gitignore
│
├── src/
│   ├── app/
│   │   ├── layout.tsx           # ルートレイアウト（PWA meta含む）
│   │   ├── page.tsx             # メインページ
│   │   ├── globals.css          # Tailwind + カスタムスタイル
│   │   └── api/
│   │       └── chat/
│   │           └── route.ts     # Claude API プロキシ（SSEストリーミング）
│   │
│   ├── components/
│   │   ├── MeetingAssistant.tsx  # メインコンテナコンポーネント
│   │   ├── AudioCapture.tsx     # 音声認識コンポーネント
│   │   ├── TranscriptPanel.tsx  # 文字起こし表示パネル
│   │   ├── InsightPanel.tsx     # AI示唆・要約表示パネル
│   │   ├── ControlBar.tsx       # 操作バー（開始/停止/設定）
│   │   ├── MeetingTypeSelector.tsx # 会議タイプ選択
│   │   └── CostIndicator.tsx    # 使用コスト表示
│   │
│   ├── hooks/
│   │   ├── useSpeechRecognition.ts  # Web Speech API ラッパー
│   │   ├── useClaudeStream.ts       # Claude API SSE接続
│   │   └── useTranscriptBuffer.ts   # 文字バッファ管理
│   │
│   ├── lib/
│   │   ├── claude.ts            # Claude API クライアント
│   │   ├── prompts.ts           # プロンプトテンプレート集
│   │   ├── token-counter.ts     # トークン数推定
│   │   └── constants.ts         # 定数定義
│   │
│   ├── stores/
│   │   └── meeting-store.ts     # Zustand ストア
│   │
│   └── types/
│       └── index.ts             # 型定義
│
└── public/
    ├── manifest.json            # PWAマニフェスト
    └── icons/                   # PWAアイコン
```

---

## コア機能仕様

### 1. 音声認識（AudioCapture）

```typescript
// Web Speech API を使用（ブラウザネイティブ、追加API不要）
// Chrome (Android/Desktop) と Safari (iOS 14.5+) をサポート

interface SpeechRecognitionConfig {
  lang: 'ja-JP' | 'en-US';
  continuous: boolean;      // PCではtrue、iOSではfalse（短セッション繰り返し）
  interimResults: boolean;  // true: リアルタイム中間結果表示
}
```

**重要な実装ポイント:**

- **iOS Safari 対策:** `continuous: true` が不安定なため、認識が停止したら自動で再開するリトライロジックを実装する。`onend` イベントで再起動。
- **HTTPS 必須:** マイク権限はセキュアコンテキストでのみ利用可能。localhost は例外。
- **対面会議モード:** スマホのマイクで集音。画面にはAI応答のみ表示（文字起こしは最小化）。
- **オンライン会議モード:** PCブラウザのマイクまたはシステム音声。文字起こしとAI応答を並列表示。
- **ブラウザ判定:** `webkitSpeechRecognition` (Chrome/Safari) をフォールバックとして使用。

```typescript
// iOS Safari の自動再起動パターン
const startRecognition = () => {
  recognition.start();
  recognition.onend = () => {
    if (isListening) {
      // iOS Safariではcontinuousが途切れるため自動再開
      setTimeout(() => recognition.start(), 100);
    }
  };
};
```

### 2. 文字起こしバッファ管理（useTranscriptBuffer）

```typescript
interface TranscriptBuffer {
  segments: TranscriptSegment[];    // 認識済みテキストセグメント
  currentInterim: string;           // 現在認識中のテキスト
  totalTokenEstimate: number;       // 推定トークン数
}

interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
}
```

**送信トリガー:**
- 一定時間（デフォルト30秒）経過
- 一定文字数（デフォルト300文字）蓄積
- ユーザーが手動で「示唆を求める」ボタンを押した時
- 上記いずれか早い方で発火

### 3. Claude API連携（route.ts + claude.ts）

**APIルート（`/api/chat`）:**

```typescript
// POST /api/chat
// SSE（Server-Sent Events）でストリーミングレスポンス

interface ChatRequest {
  transcript: string;          // 会議の文字起こしテキスト
  meetingType: MeetingType;    // 会議タイプ
  previousContext?: string;    // 前回の要約（コンテキスト継続用）
  requestType: 'summary' | 'suggestion' | 'action_items' | 'auto';
}

type MeetingType = 
  | 'sales'        // 営業商談
  | 'internal'     // 社内ミーティング
  | 'brainstorm'   // ブレインストーミング
  | 'one_on_one'   // 1on1
  | 'review'       // レビュー会議
  | 'general';     // 汎用
```

**Prompt Caching:**
- システムプロンプト（会議タイプ別テンプレート）は `cache_control` を使用してキャッシュ
- 会議中は同じシステムプロンプトを繰り返すため、最大90%のコスト削減効果

```typescript
// Prompt caching の実装
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6-20250514',
  max_tokens: 1024,
  system: [
    {
      type: 'text',
      text: systemPrompt,         // 会議タイプ別プロンプト
      cache_control: { type: 'ephemeral' }  // キャッシュ有効化
    }
  ],
  messages: [
    { role: 'user', content: userMessage }
  ],
  stream: true
});
```

### 4. プロンプトテンプレート（prompts.ts）

各会議タイプに応じたシステムプロンプトを定義。以下の構造で設計：

```typescript
interface MeetingPromptTemplate {
  meetingType: MeetingType;
  systemPrompt: string;
  summaryInstruction: string;
  suggestionInstruction: string;
  actionItemInstruction: string;
}
```

**プロンプト設計方針:**
- ロール: 「あなたは優秀な会議アシスタントです」
- 出力形式: JSON構造で応答（summary, suggestions[], actionItems[], alerts[]）
- 言語: 日本語で応答
- 制約: 簡潔に、箇条書きで、すぐ使える示唆を優先
- コンテキスト: 前回の要約を含めて会議の流れを維持

**応答のJSON構造:**

```typescript
interface AIResponse {
  summary: string;                    // 現時点の会議要約（2-3文）
  suggestions: Suggestion[];          // 発言提案
  actionItems: ActionItem[];          // 抽出されたアクションアイテム
  alerts: Alert[];                    // 注意喚起（論点の抜け漏れ等）
  keyTopics: string[];               // 主要トピック
}

interface Suggestion {
  type: 'question' | 'point' | 'counterargument' | 'clarification';
  text: string;
  priority: 'high' | 'medium' | 'low';
}

interface ActionItem {
  task: string;
  assignee?: string;
  deadline?: string;
}

interface Alert {
  type: 'missing_topic' | 'contradiction' | 'time_warning' | 'decision_needed';
  message: string;
}
```

### 5. UI/UXデザイン

**レイアウト（レスポンシブ）:**

```
┌─────────────────────────────────────┐
│  [制御バー: 開始/停止 | 会議タイプ | 設定]  │
├──────────────┬──────────────────────┤
│  文字起こし   │   AI示唆パネル        │ ← PC: 2カラム
│  パネル       │   - 要約              │
│  (左/上)      │   - 発言提案          │
│              │   - アクションアイテム   │
│              │   - アラート           │
├──────────────┴──────────────────────┤
│  [コスト表示: ≈¥XX | トークン: XXXX]     │
└─────────────────────────────────────┘

スマホ: 1カラム（AI示唆パネルのみ表示、文字起こしは折りたたみ）
```

**スマホ最適化:**
- 対面会議では示唆パネルのみを大きく表示
- 文字起こしはスワイプまたはタブで切替え
- 重要なアラートはバイブレーション通知（`navigator.vibrate`）
- 画面ロック防止（`navigator.wakeLock`）

### 6. コスト管理

```typescript
interface CostTracker {
  sessionInputTokens: number;
  sessionOutputTokens: number;
  sessionCost: number;           // USD
  sessionCostJPY: number;        // JPY概算（固定レート150で計算）
  apiCallCount: number;
}
```

- リアルタイムでトークン使用量とコスト概算を表示
- 1セッション（会議）あたりの上限設定機能
- トークン数はtiktoken互換の推定を使用（日本語: 文字数 × 1.5 で概算）

---

## 環境変数

```env
# .env.local
ANTHROPIC_API_KEY=sk-ant-...          # 必須: Claude APIキー
NEXT_PUBLIC_APP_NAME=Meeting AI        # アプリ名
COST_LIMIT_PER_SESSION=1.00           # 1セッションのコスト上限（USD）
```

---

## 開発コマンド

```bash
# セットアップ
npm install

# 開発サーバー
npm run dev

# ビルド
npm run build

# リント
npm run lint

# 型チェック
npm run type-check
```

---

## 実装順序

### Phase 1: 基盤（1-2日）
1. Next.js プロジェクト初期化 + TypeScript + Tailwind
2. `useSpeechRecognition` フック実装（iOS/Android/PC対応）
3. `AudioCapture` + `TranscriptPanel` コンポーネント
4. 音声認識の動作確認（ブラウザで文字起こしが表示される状態）

### Phase 2: AI連携（1-2日）
5. `/api/chat` APIルート（Claude API proxy + SSE）
6. プロンプトテンプレート（まず`general`タイプから）
7. `useClaudeStream` フック + `InsightPanel`
8. Prompt caching 実装
9. バッファ→API→UI の一連の流れを結合テスト

### Phase 3: 会議支援機能（2-3日）
10. 会議タイプ別プロンプト（sales, internal, brainstorm等）
11. `MeetingTypeSelector` コンポーネント
12. アクションアイテム抽出ロジック
13. コンテキスト継続（前回の要約を次のリクエストに含める）
14. `CostIndicator` コンポーネント

### Phase 4: UX改善（随時）
15. PWA対応（manifest.json, service worker）
16. スマホ向けUI最適化（1カラム、バイブレーション通知）
17. 画面ロック防止（Wake Lock API）
18. 会議履歴のlocalStorage保存
19. ダークモード対応

---

## コーディング規約

- **コンポーネント:** React Server Components をデフォルトに。`'use client'` は状態を持つコンポーネントのみ
- **命名:** PascalCase（コンポーネント）、camelCase（関数・変数）、UPPER_SNAKE_CASE（定数）
- **エラーハンドリング:** API呼び出しは必ず try-catch。ユーザーにはトースト通知で表示
- **型定義:** `any` 禁止。すべての型を `types/index.ts` に集約
- **コメント:** 日本語で記述。複雑なロジックには必ずコメント
- **テスト:** 後回しでOK。まず動くプロトタイプ優先

---

## セキュリティ

- APIキーは `.env.local` に格納、クライアントに露出させない
- `/api/chat` でレート制限を実装（1分あたり最大20リクエスト）
- CORS設定で自ドメインのみ許可
- 会議データはサーバーに保存しない（クライアントサイドのみ）
