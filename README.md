# Meeting AI Assistant

> **[アプリを開く](https://meeting-ai-assistant-liart.vercel.app/)**

リアルタイム会議支援AIアシスタント。会議中の音声を認識し、選択した回答者のフレームワークでAIがリアルタイムに分析・示唆・発言提案を提供します。

## 特徴

- **リアルタイム音声認識** — ブラウザのWeb Speech APIを使用（追加API不要）
- **回答者選択** — 2つの思考フレームワークから選択可能
- **AI会議支援** — Claude Sonnet 4.6 による高品質な日本語分析
- **マルチデバイス** — PC・スマートフォン両対応
- **低コスト** — Prompt Caching により1時間の会議で約10〜30円

## 回答者

| 回答者 | フレームワーク | 特徴 |
|--------|--------------|------|
| **高松智司** | ロサTス作ア | 論点→サブ論点→TASK→スケジュール→作業→アウトプットの6ステップで構造化。TASKバカ注意報つき |
| **高田貴久** | Where→Why→How | 7ステップ問題解決。温かく鋭い壁打ち質問で思考を深める。コインの裏返し注意報つき |

## セットアップ

### 前提条件

- Node.js 18+
- Anthropic APIキー（[console.anthropic.com](https://console.anthropic.com) で取得）

### インストール

```bash
git clone https://github.com/peirin1230-ship-it/meeting-ai-assistant.git
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

ブラウザで `http://localhost:3000` を開く（マイク使用にはHTTPS必須、localhostは例外）

## 使い方

1. ブラウザで開き、**回答者**（高松智司 or 高田貴久）を選択
2. **会議タイプ**（営業商談、社内MTG、ブレスト等）を選択
3. 「開始」ボタンを押してマイクを許可
4. 会議を進める — AIがリアルタイムでフレームワークに基づく分析を表示
5. 「今すぐ分析」ボタンで手動でもインサイトを取得可能
6. 「停止」ボタンで終了、アクションアイテムを確認

### 対面会議

スマホで開き、テーブルにスマホを置いてマイクで集音。画面にはAI分析のみ表示。

### オンライン会議

PCブラウザで開き、Zoom/Meet等と並行して使用。文字起こしとAI分析を同時表示。

## Claude Code スキル

会議後の深堀り分析用に `/meeting` スキルも利用可能です。

```
/meeting 高松 会議のテキストをここに貼り付け...
/meeting 高田 ./meeting-notes.txt
```

## 技術スタック

- **Next.js 14+** (App Router, TypeScript)
- **Tailwind CSS**
- **Claude API** (Sonnet 4.6, Prompt Caching)
- **Web Speech API** (ブラウザネイティブ音声認識)
- **Zustand** (状態管理)

## デプロイ

Vercel へのデプロイ推奨：

1. [vercel.com](https://vercel.com) でGitHubリポジトリをインポート
2. 環境変数 `ANTHROPIC_API_KEY` を Settings > Environment Variables で設定
3. デプロイ実行
