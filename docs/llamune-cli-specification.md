# Llamune CLI版 仕様書

Node.js + Commander.js + readline による CLI アプリケーションの実装仕様

**ステータス**: ✅ Phase 1 完了  
**バージョン**: 0.1.0  
**最終更新**: 2025-11-15

---

## 目次

1. [概要](#概要)
2. [実装済み機能](#実装済み機能)
3. [コマンド設計](#コマンド設計)
4. [チャット特殊コマンド](#チャット特殊コマンド)
5. [データ構造](#データ構造)
6. [技術アーキテクチャ](#技術アーキテクチャ)
7. [開発完了タスク](#開発完了タスク)

---

## 概要

### Phase 1: CLI版 MVP（✅ 完了）

**目的:**
複数LLMの比較・活用の価値を検証する最小限の機能を実装

**実装期間:**
2025-12 ~ 2026-01（7週間）

**実装スコープ:**
```
✅ 実装済み機能:
├─ CLI インターフェース（llamune / llmn コマンド）
├─ モデル管理（ダウンロード・削除・一覧表示）
├─ チャット機能（会話履歴の保存・再開）
├─ /retry 機能（異なるモデル・プリセットで再実行）
├─ /rewind 機能（会話履歴の巻き戻し）
├─ /switch 機能（モデル切り替え）
├─ パラメータプリセット（balanced, creative, fast）
├─ 推奨モデル表示（システムスペックに応じて）
├─ SQLite データベース（会話履歴の永続化）
└─ ollama 自動起動

❌ Phase 2以降に見送り:
├─ バックグラウンド推論（並列実行）
├─ リッチなマークダウン描画
├─ アーティファクト管理
└─ Web UI
```

### 技術スタック

```typescript
実装済み:
- ランタイム: Node.js 18+
- 言語: TypeScript
- CLI Framework: Commander.js
- UI: readline（標準入力/出力）
- DB: better-sqlite3 (SQLite)
- HTTP Client: native fetch
- Config: cosmiconfig
- Testing: Vitest
```

### 前提条件

**必須:**
- Node.js 18+ インストール済み
- ollama インストール済み

**ollama の起動:**
- 不要（Llamuneが自動起動）
- `ollama serve` を手動実行する必要なし

**確認方法:**
```bash
# ollamaがインストールされているか確認
$ ollama --version
ollama version is 0.x.x

# モデルがインストールされているか確認
$ ollama list
NAME              ID              SIZE
gemma2:9b         ...            5.4 GB
deepseek-r1:7b    ...            4.7 GB
qwen2.5:14b       ...            8.5 GB
```

**Llamuneの動作:**
1. ollama の状態を確認
2. 起動していなければ自動起動
3. 処理開始

```bash
$ llamune chat

# ollama未起動の場合:
🚀 ollama を起動しています...
✅ ollama が起動しました

# ollama起動済みの場合:
# 何も表示せず即座に開始
```

---

## 実装済み機能

### 1. モデル管理

#### モデル一覧表示

```bash
$ llamune ls
# または
$ llmn ls

📦 インストール済みモデル:

NAME              SIZE     MODIFIED
gemma2:9b        5.4 GB   2 days ago
deepseek-r1:7b   4.7 GB   1 week ago
qwen2.5:14b      8.5 GB   3 days ago

合計: 3 モデル (18.6 GB)
```

#### モデルのダウンロード

```bash
$ llamune pull gemma2:9b
# または
$ llmn pull gemma2:9b

📥 gemma2:9b をダウンロード中...
pulling manifest
pulling 8934d96d3f08... 100% ▕████████████████▏ 5.4 GB
pulling 8c17c2ebb0ea... 100% ▕████████████████▏  7.0 KB
pulling 7c23fb36d801... 100% ▕████████████████▏  4.8 KB
pulling 2e0493f67d0c... 100% ▕████████████████▏   59 B
pulling fa304d675061... 100% ▕████████████████▏   91 B
pulling 42ba7f8a01dd... 100% ▕████████████████▏  557 B
verifying sha256 digest
writing manifest
removing any unused layers
success
```

#### モデルの削除

```bash
$ llamune rm gemma2:9b
# または
$ llmn rm gemma2:9b

⚠️  gemma2:9b を削除してもよろしいですか? (y/N): y
🗑️  gemma2:9b を削除しました
```

#### 推奨モデルの表示

```bash
$ llamune recommend
# または
$ llmn recommend

💻 システム仕様:
  CPU: Apple M1
  メモリ: 16 GB
  OS: macOS 14.0

📊 推奨モデル (16GB RAM):

1. gemma2:9b (5.4 GB)
   高品質な応答、最速の推論速度
   ✅ インストール済み

2. deepseek-r1:7b (4.7 GB)
   Reasoning特化、思考プロセスを表示
   ✅ インストール済み

3. qwen2.5:14b (8.5 GB)
   高性能、バランス型
   ✅ インストール済み

推奨: 最初は gemma2:9b から始めることをお勧めします
```

### 2. チャット機能

#### 基本的なチャット

```bash
$ llamune chat
# または
$ llmn chat

利用可能なモデル:

⭐ 1. gemma2:9b (前回使用)
   2. deepseek-r1:7b
   3. qwen2.5:14b

モデルを選択してください (番号): 1

💬 Chat モード
モデル: gemma2:9b

終了するには "exit" または "quit" と入力してください
---

You: こんにちは
AI (gemma2:9b): こんにちは！何かお手伝いできることはありますか？

You: exit
```

#### モデルを指定してチャット

```bash
$ llamune chat -m gemma2:9b
# または
$ llmn chat -m gemma2:9b

💬 Chat モード
モデル: gemma2:9b

終了するには "exit" または "quit" と入力してください
---

You: Pythonでクイックソートを実装して
AI (gemma2:9b): はい、実装します...
```

#### 過去の会話を再開

```bash
$ llamune chat -c 1
# または
$ llmn chat -c 1

💬 Chat モード（会話を再開）
セッションID: 1
モデル: gemma2:9b

--- 過去の会話 ---

You: こんにちは
AI (gemma2:9b): こんにちは！何かお手伝いできることはありますか？

You: Pythonでクイックソートを実装して
AI (gemma2:9b): はい、実装します...

--- 会話の続きを開始 ---

You: 
```

### 3. 会話履歴管理

#### 会話履歴一覧

```bash
$ llamune history
# または
$ llmn history

📚 会話履歴:

ID  モデル          メッセージ数  最終更新           プレビュー
─────────────────────────────────────────────────────────────────
1   gemma2:9b      4            2 hours ago        こんにちは
2   deepseek-r1:7b 8            1 day ago          Pythonでクイックソート...
3   qwen2.5:14b    6            3 days ago         機械学習について教えて

合計: 3 セッション
```

#### 会話の削除

```bash
$ llamune history delete 1
# または
$ llmn history delete 1

⚠️  セッションID 1 を削除してもよろしいですか? (y/N): y
🗑️  セッションID 1 を削除しました
```

#### 会話のタイトル変更

```bash
$ llamune history rename 1 "クイックソートの実装"
# または
$ llmn history rename 1 "クイックソートの実装"

✅ セッションID 1 のタイトルを変更しました
```

---

## チャット特殊コマンド

チャット中に使用できる特殊コマンド

### /retry - 回答の再生成

最後の質問を別のモデル・プリセットで再実行し、回答を比較できます。

**使い方:**
```bash
You: Pythonでクイックソートを実装して
AI (gemma2:9b): はい、実装します...

You: /retry

モデルとプリセットの組み合わせ:

⭐ 1. gemma2:9b (balanced)
   2. gemma2:9b (creative)
   3. gemma2:9b (fast)
   4. deepseek-r1:7b (balanced)
   5. deepseek-r1:7b (creative)
   6. deepseek-r1:7b (fast)
   7. qwen2.5:14b (balanced)
   8. qwen2.5:14b (creative)
   9. qwen2.5:14b (fast)

組み合わせを選択してください (番号): 4

🔄 deepseek-r1:7b (balanced) で再実行します...

AI (deepseek-r1:7b (balanced)): Pythonでクイックソート...

💡 この回答を採用しますか？
  yes, y  - 採用 (deepseek-r1:7b (balanced) の回答を採用する)
  no, n   - 破棄 (gemma2:9b の回答を採用する)

You: yes
✅ deepseek-r1:7b の回答を採用しました
```

**機能詳細:**
- 最後のアシスタントの回答を一時的に保留
- 選択したモデル・プリセットで再実行
- 新旧の回答を比較
- `yes` / `y` で新しい回答を採用
- `no` / `n` で元の回答を維持

**実装上の特徴:**
- 論理削除により元の回答もデータベースに保持
- 会話履歴の一貫性を維持
- プリセットのパラメータを適用

### /rewind - 会話の巻き戻し

指定した往復まで会話を巻き戻し、そこから別の展開を試せます。

**使い方:**
```bash
You: /history

📜 現在の会話履歴:

[1] You: こんにちは
    AI (gemma2:9b): こんにちは！何かお手伝いできることは...

[2] You: Pythonでクイックソートを実装して
    AI (gemma2:9b): はい、実装します...

[3] You: これを高速化できますか？
    AI (gemma2:9b): はい、Timsortを使用すれば...

合計: 3 往復

You: /rewind 2

⚠️  会話 #2 まで巻き戻しますか？
  yes, y  - 実行 (往復 #3 以降を削除)
  no, n   - キャンセル

You: yes
✅ 会話 #2 まで巻き戻しました
削除されたメッセージ: 2件

You: 別のアプローチを教えて
AI (gemma2:9b): マージソートを使うこともできます...
```

**機能詳細:**
- 往復番号を指定（1始まり）
- 指定した往復以降のメッセージを論理削除
- yes/no で確認してから実行
- 削除されたメッセージ数を表示

**実装上の特徴:**
- 論理削除（`deleted_at` カラム）で実装
- 物理削除せずデータを保持
- セッションがある場合はDBも更新
- 新規会話の場合はメモリ上で巻き戻し

### /switch - モデル切り替え

現在のモデルを別のモデルに切り替えます。

**使い方:**
```bash
You: /switch deepseek-r1:7b

✅ モデルを deepseek-r1:7b に切り替えました

You: 続きをお願いします
AI (deepseek-r1:7b): はい、続きます...
```

**機能詳細:**
- モデル名を引数に指定
- 会話履歴は引き継がれる
- 最後に使用したモデルとして記憶

### /history - 会話履歴表示

現在の会話の履歴を往復単位で表示します。

**使い方:**
```bash
You: /history

📜 現在の会話履歴:

[1] You: こんにちは
    AI (gemma2:9b): こんにちは！何かお手伝いできることは...

[2] You: Pythonでクイックソートを実装して
    AI (gemma2:9b): はい、実装します...

[3] You: これを高速化できますか？
    AI (deepseek-r1:7b): はい、Timsortを使用すれば...

合計: 3 往復
```

**機能詳細:**
- 往復単位（User → AI）で表示
- 各メッセージに往復番号を表示
- 使用したモデルを表示
- 長いメッセージはプレビュー表示

### /models - モデル一覧

利用可能なモデルの一覧を表示します。

**使い方:**
```bash
You: /models

📦 利用可能なモデル:
⭐ - gemma2:9b (現在使用中)
  - deepseek-r1:7b
  - qwen2.5:14b
```

### /current - 現在のモデル

現在使用中のモデルを表示します。

**使い方:**
```bash
You: /current

📦 現在のモデル: gemma2:9b
```

### /help - ヘルプ

チャット中のコマンド一覧を表示します。

**使い方:**
```bash
You: /help

📖 コマンド一覧:

  /retry          - 最後の質問を別のモデル・プリセットで再実行
  yes, y, /yes    - retry の回答を採用
  no, n, /no      - retry の回答を破棄
  /switch <model> - モデルを切り替え
  /models         - 利用可能なモデル一覧
  /current        - 現在のモデルを表示
  /history        - 現在の会話履歴を表示
  /rewind <番号>  - 指定した往復まで巻き戻し
  /help           - このヘルプを表示
  exit, quit      - チャットを終了
```

---

## データ構造

### データベーススキーマ

**ファイルパス:** `~/.llamune/history.db`

#### sessions テーブル

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT NOT NULL,              -- 使用モデル名
  created_at TEXT NOT NULL,         -- 作成日時 (ISO 8601)
  updated_at TEXT NOT NULL,         -- 更新日時 (ISO 8601)
  title TEXT                        -- セッションタイトル
);
```

#### messages テーブル

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,      -- セッションID
  role TEXT NOT NULL,               -- 'user' or 'assistant'
  content TEXT NOT NULL,            -- メッセージ内容
  created_at TEXT NOT NULL,         -- 作成日時 (ISO 8601)
  model TEXT,                       -- 使用モデル名（assistantのみ）
  deleted_at TEXT,                  -- 論理削除日時 (ISO 8601)
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

**論理削除の仕組み:**
- `deleted_at` が NULL: 有効なメッセージ
- `deleted_at` が非 NULL: 削除済みメッセージ（/rewindで設定）
- 削除済みメッセージは表示されないが、データは保持

#### parameter_presets テーブル

```sql
CREATE TABLE parameter_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,        -- プリセット名（内部用）
  display_name TEXT NOT NULL,       -- 表示名
  description TEXT,                 -- 説明
  temperature REAL,                 -- 温度パラメータ
  top_p REAL,                       -- Top-p パラメータ
  top_k INTEGER,                    -- Top-k パラメータ
  repeat_penalty REAL,              -- 繰り返しペナルティ
  num_ctx INTEGER,                  -- コンテキストサイズ
  created_at TEXT NOT NULL          -- 作成日時
);
```

**デフォルトプリセット:**

| name     | display_name | temperature | top_p | top_k | repeat_penalty | num_ctx |
|----------|--------------|-------------|-------|-------|----------------|---------|
| balanced | バランス     | 0.7         | 0.9   | 40    | 1.1            | 2048    |
| creative | 創造的       | 1.0         | 0.95  | 50    | 1.0            | 2048    |
| fast     | 高速         | 0.3         | 0.85  | 30    | 1.2            | 1024    |

#### recommended_models テーブル

```sql
CREATE TABLE recommended_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  min_memory_gb INTEGER NOT NULL,   -- 最小メモリ (GB)
  max_memory_gb INTEGER,            -- 最大メモリ (GB, NULL=無制限)
  model_name TEXT NOT NULL,         -- モデル名
  model_size TEXT NOT NULL,         -- モデルサイズ表示
  description TEXT NOT NULL,        -- 説明
  priority INTEGER NOT NULL,        -- 優先順位（1が最優先）
  created_at TEXT NOT NULL          -- 作成日時
);
```

### TypeScript型定義

```typescript
// チャットメッセージ
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  model?: string;  // assistantのみ
}

// チャットセッション
interface ChatSession {
  id: number;
  model: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string;
  title: string | null;
}

// パラメータプリセット
interface ParameterPreset {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  temperature: number | null;
  top_p: number | null;
  top_k: number | null;
  repeat_penalty: number | null;
  num_ctx: number | null;
  created_at: string;
}

// 推奨モデル
interface RecommendedModel {
  id: number;
  min_memory_gb: number;
  max_memory_gb: number | null;
  model_name: string;
  model_size: string;
  description: string;
  priority: number;
}

// チャットパラメータ
interface ChatParameters {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repeat_penalty?: number;
  num_ctx?: number;
}
```

### 設定ファイル

**ファイルパス:** `~/.llamune/config.json`

```json
{
  "lastUsedModel": "gemma2:9b",
  "defaultPreset": "balanced"
}
```

---

## 技術アーキテクチャ

### ディレクトリ構造

```
llamune/
├── bin/
│   ├── llamune.js          # CLIエントリーポイント
│   └── llmn.js             # ショートカット
├── src/
│   ├── index.ts            # メイン処理
│   ├── core/
│   │   └── chat-session.ts # チャットセッション管理
│   ├── utils/
│   │   ├── ollama.ts       # ollama連携
│   │   ├── database.ts     # データベース処理
│   │   ├── config.ts       # 設定管理
│   │   └── system.ts       # システム情報取得
│   └── api/                # API サーバー（Phase 2）
│       ├── server.ts
│       └── routes/
├── scripts/
│   ├── check-db.ts         # DB確認スクリプト
│   └── migrate-*.ts        # マイグレーションスクリプト
├── tests/
│   └── api/                # APIテスト
├── package.json
└── tsconfig.json
```

### 主要モジュール

#### src/index.ts

CLIのメインエントリーポイント。Commander.jsを使用してコマンドを定義。

**責務:**
- コマンドライン引数の解析
- 各コマンドのハンドラ実装
- ユーザー入力の処理

**主要な関数:**
- `selectModel()`: モデル選択UI
- `selectPreset()`: プリセット選択UI
- `showSpinner()`: スピナー表示
- `stopSpinner()`: スピナー停止

#### src/utils/ollama.ts

ollamaとの通信を担当。

**責務:**
- ollama APIとの通信
- モデル一覧取得
- モデルのダウンロード・削除
- チャット実行（ストリーミング）

**主要な関数:**
- `ensureOllamaRunning()`: ollama自動起動
- `listModels()`: モデル一覧取得
- `pullModel()`: モデルダウンロード
- `deleteModel()`: モデル削除
- `chatWithModel()`: チャット実行

**実装例:**
```typescript
export async function chatWithModel(
  model: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  parameters?: ChatParameters
): Promise<void> {
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: parameters
    })
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const data = JSON.parse(line);
      if (data.message?.content) {
        onChunk(data.message.content);
      }
    }
  }
}
```

#### src/utils/database.ts

SQLiteデータベースとの通信を担当。

**責務:**
- データベース初期化
- セッション管理
- メッセージの保存・取得
- 論理削除処理

**主要な関数:**
- `initDatabase()`: DB初期化
- `createSession()`: セッション作成
- `saveMessage()`: メッセージ保存
- `appendMessagesToSession()`: メッセージ追加
- `getSession()`: セッション取得
- `getSessionMessagesWithTurns()`: 往復単位でメッセージ取得
- `logicalDeleteMessagesAfterTurn()`: 論理削除
- `getAllParameterPresets()`: プリセット取得

#### src/utils/config.ts

設定ファイルの読み書きを担当。

**責務:**
- 最後に使用したモデルの保存・取得
- デフォルトプリセットの管理

**主要な関数:**
- `getLastUsedModel()`: 最後のモデル取得
- `saveLastUsedModel()`: モデル保存

#### src/utils/system.ts

システム情報の取得を担当。

**責務:**
- CPUとメモリ情報の取得
- 推奨モデルの表示
- システムスペック表示

**主要な関数:**
- `getSystemSpec()`: システム情報取得
- `getRecommendedModels()`: 推奨モデル取得
- `displaySystemSpec()`: システム情報表示
- `displayRecommendedModels()`: 推奨モデル表示

### 状態管理

**チャット中の状態:**
```typescript
// 会話履歴
let messages: ChatMessage[] = [];

// セッションID
let sessionId: number | null = null;

// 選択中のモデル
let selectedModel: string;

// パラメータ
let selectedParameters: ChatParameters | undefined;

// /retry の保留中回答
let pendingRetry: {
  response: string;
  model: string;
  previousResponse: ChatMessage;
} | null = null;

// /rewind の保留中巻き戻し
let pendingRewind: {
  sessionId: number | null;
  turnNumber: number;
} | null = null;

// /retry のモデル×プリセット選択待ち
let pendingRetryComboSelection: boolean = false;
let retryModelPresetCombos: Array<{
  model: string;
  preset: ParameterPreset;
  displayName: string;
}> = [];
```

### エラーハンドリング

```typescript
// カスタムエラークラス
export class OllamaError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'OllamaError';
  }
}

// エラー処理例
try {
  await chatWithModel(model, messages, onChunk);
} catch (error) {
  if (error instanceof OllamaError) {
    console.error('❌ エラー:', error.message);
  } else {
    console.error('❌ 予期しないエラーが発生しました');
  }
}
```

---

## 開発完了タスク

### ✅ Week 1-2: 基盤構築（完了）

```
✅ プロジェクトセットアップ
  - package.json作成
  - TypeScript設定
  - ESLint/Prettier設定

✅ Commander.js統合
  - コマンド構造定義
  - バージョン表示
  - ヘルプ表示

✅ ollama連携
  - HTTP通信実装
  - ストリーミング対応
  - 自動起動機能

✅ SQLiteデータベース
  - スキーマ設計
  - 初期化処理
  - CRUD操作
```

### ✅ Week 3-4: コア機能（完了）

```
✅ チャット機能
  - readline統合
  - ストリーミング表示
  - スピナー表示
  - エラーハンドリング

✅ 会話履歴管理
  - セッション作成
  - メッセージ保存
  - 会話再開機能
  - 履歴一覧表示

✅ モデル管理
  - モデル一覧表示
  - モデルダウンロード
  - モデル削除
  - モデル選択UI
```

### ✅ Week 5-6: 完成度向上（完了）

```
✅ /retry機能
  - モデル×プリセット組み合わせ生成
  - 再実行処理
  - yes/no選択
  - 回答の保留・採用・破棄

✅ /rewind機能
  - 往復番号指定
  - 論理削除実装
  - yes/no確認
  - メッセージ削除

✅ その他のコマンド
  - /switch: モデル切り替え
  - /history: 履歴表示
  - /models: モデル一覧
  - /current: 現在のモデル
  - /help: ヘルプ表示

✅ パラメータプリセット
  - balanced, creative, fast
  - プリセット選択UI
  - データベーススキーマ
  - デフォルト値設定

✅ 推奨モデル機能
  - システムスペック取得
  - メモリ容量に応じた推奨
  - インストール状況表示
```

### ✅ Week 7: リリース準備（完了）

```
✅ ドキュメント整備
  - README.md更新
  - API仕様書作成
  - CLI仕様書作成

✅ テスト実施
  - 基本機能テスト
  - エラーハンドリング
  - エッジケース確認

✅ コード整理
  - リファクタリング
  - コメント追加
  - 型定義整理

✅ 社内テスト開始
  - 実環境での動作確認
  - フィードバック収集
```

---

## 次のステップ（Phase 2）

### 検討中の機能

```
🔜 複数LLM並列実行
  - バックグラウンドで他のモデルも実行
  - 完了時に通知
  - 結果の比較表示

🔜 Web UI開発
  - Express APIサーバー
  - React フロントエンド
  - リアルタイムストリーミング

🔜 リッチなマークダウン
  - シンタックスハイライト
  - テーブル表示
  - コードブロック

🔜 アーティファクト管理
  - 生成されたコードの保存
  - ファイル出力
  - バージョン管理
```

---

**最終更新**: 2025-11-21  
**作成者**: mop & Claude Sonnet 4.5  
**バージョン**: 1.0.0 (Phase 1 完了版)  
**次回レビュー**: Phase 2 開始時
