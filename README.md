# Meeting AI Assistant 🎙️

リアルタイム会議支援AIアシスタント。会議中の音声を認識し、Claude AI が示唆・要約・発言提案をリアルタイムで提供します。

## 特徴

- **リアルタイム音声認識** — ブラウザのWeb Speech APIを使用（追加API不要）
- **AI会議支援** — Claude Sonnet 4.6 による高品質な日本語での示唆・要約
- **マルチデバイス** — PC・スマートフォン両対応（PWA）
- **会議タイプ別最適化** — 営業商談、社内MTG、ブレスト等に応じた示唆
- **低コスト** — Prompt Caching により1時間の会議で¥10〜30程度

## セットアップ

### 前提条件
- Node.js 18+
- Anthropic APIキー（[platform.claude.com](https://platform.claude.com) で取得）

### インストール

```bash
git clone https://github.com/YOUR_USERNAME/meeting-ai-assistant.git
cd meeting-ai-assistant
npm install
```

### 環境変数

```bash
cp .env.example .env.local
# .env.local を編集して ANTHROPIC_API_KEY を設定
```

### 開発サーバー起動

```bash
npm run dev
```

`https://localhost:3000` を開く（マイク使用にはHTTPS必須、localhostは例外）

## 使い方

1. ブラウザで開き、会議タイプを選択
2. 「開始」ボタンを押してマイクを許可
3. 会議を進める — AIがリアルタイムで示唆を表示
4. 「停止」ボタンで終了、アクションアイテムを確認

### 対面会議
スマホで開き、テーブルにスマホを置いてマイクで集音。画面にはAI示唆のみ表示。

### オンライン会議
PCブラウザで開き、Zoom/Meet等と並行して使用。文字起こしとAI示唆を同時表示。

## 技術スタック

- **Next.js 14+** (App Router, TypeScript)
- **Tailwind CSS**
- **Claude API** (Sonnet 4.6, Prompt Caching)
- **Web Speech API** (ブラウザネイティブ音声認識)
- **Zustand** (状態管理)

## デプロイ

Vercel へのデプロイ推奨（プライベートリポジトリからデプロイ可能）：

1. [vercel.com](https://vercel.com) でGitHubリポジトリをインポート
2. 環境変数 `ANTHROPIC_API_KEY` を Settings > Environment Variables で設定
3. デプロイ実行

## 注意

個人利用プロジェクトです。リポジトリは非公開（private）で管理してください。
