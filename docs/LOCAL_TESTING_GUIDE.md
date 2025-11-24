# ローカル環境でのツール呼び出しテストガイド

## 📋 前提条件

✅ **ローカルマシンに必要なもの:**
- Node.js (v18以上)
- Ollama + ツール対応モデル
  - qwen2.5:14b（推奨）
  - gemma2:27b（推奨）
  - または qwen2.5:7b（軽量）

## 🚀 セットアップ手順

### 1. リポジトリのクローン・チェックアウト

```bash
git clone <repository-url>
cd llamune_code
git checkout claude/review-repo-implementation-01YNqeMvUMnyGNQ4HELMSN2c
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. データベースのセットアップ

```bash
# 基本テーブル作成
npx tsx scripts/init-base-db.ts

# 認証テーブル
npx tsx scripts/migrate-add-auth.ts

# リポジトリテーブル
npx tsx scripts/migrate-add-repositories.ts

# アプリ開発ドメインモード
npx tsx scripts/migrate-add-app-dev-domain.ts

# 管理ユーザー作成 (username: admin, password: admin)
npx tsx scripts/setup-admin.ts
```

### 4. ビルド

```bash
npm run build
```

### 5. Ollamaの起動確認

```bash
# Ollamaが起動しているか確認
ollama list

# 出力例：
# NAME              ID              SIZE      MODIFIED
# gemma2:27b        53261bc9c192    15 GB     7 days ago
# qwen2.5:14b       7cdf5a0187d5    9.0 GB    7 days ago
```

Ollamaが起動していない場合：
```bash
ollama serve
```

### 6. APIサーバーの起動

別のターミナルで：

```bash
npm run api
```

または、バックグラウンドで：
```bash
npm run api > api.log 2>&1 &
```

## 🧪 テスト実行

### 自動テストスクリプトを実行

```bash
chmod +x ./scripts/test-tool-calling.sh
./scripts/test-tool-calling.sh
```

このスクリプトは以下を自動実行します：
1. ✅ ログイン
2. ✅ リポジトリ登録（このプロジェクト自体を登録）
3. ✅ Ollamaモデル検出
4. 🤖 **ツール呼び出しテスト1**: package.json読み取り
5. 🤖 **ツール呼び出しテスト2**: repository-tools.ts解析

### テスト結果の確認

LLMが以下のツールを自律的に使用する様子が確認できます：

```
🤖 ツール呼び出し実行テスト

質問: 'package.jsonを読んで、プロジェクト名とバージョン、説明を教えてください'

LLMの応答:
---
[🔧 Executing: read_file({"path":"package.json"})...]
[✓ read_file: Success]

このプロジェクトは「llamune」で、バージョンは0.1.0です。
Llamuneは閉じたネットワーク内でLLMを活用するためのプラットフォームで...
---
```

## 🔧 手動テスト（curlで実行）

### 1. ログイン

```bash
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -s | jq -r '.accessToken')
```

### 2. リポジトリ登録

```bash
REPO_ID=$(curl -X POST http://localhost:3000/api/repositories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"llamune_code\",
    \"localPath\": \"$(pwd)\",
    \"description\": \"Test repository\"
  }" \
  -s | jq -r '.id')
```

### 3. ツール呼び出しテスト

```bash
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"package.jsonを読んで内容を教えてください\",
    \"modelName\": \"qwen2.5:14b\",
    \"repositoryId\": $REPO_ID
  }" \
  -N
```

## 📊 実装されているツール一覧

LLMが自律的に選択・使用できるツール（10個）：

| ツール | 機能 | 使用例 |
|--------|------|--------|
| `read_file` | ファイル読み取り | "package.jsonを読んで" |
| `write_file` | ファイル書き込み | "新しいファイルを作成して" |
| `list_files` | ファイル一覧 | "src/配下のファイルを一覧して" |
| `search_code` | コード検索 | "Gitという文字列を検索して" |
| `git_status` | Git状態確認 | "現在の変更を確認して" |
| `git_diff` | 差分表示 | "変更内容を見せて" |
| `create_branch` | ブランチ作成 | "新しいブランチを作って" |
| `commit_changes` | コミット | "変更をコミットして" |
| `get_file_tree` | ファイルツリー | "ディレクトリ構造を見せて" |
| `get_recent_commits` | コミット履歴 | "最近のコミットを表示して" |

## 💡 テスト例

### 例1: ファイル読み取り
```
質問: "src/core/chat-session.ts を読んで、主要な機能を説明してください"

期待される動作:
1. LLMが read_file ツールを自動選択
2. chat-session.ts の内容を取得
3. 内容を解析して説明を生成
```

### 例2: コード検索 + ファイル読み取り
```
質問: "Git操作に関するファイルを探して、その内容を説明してください"

期待される動作:
1. LLMが search_code または list_files を使用
2. git.ts を発見
3. read_file でファイル内容を取得
4. 機能を説明
```

### 例3: ファイルツリー + 分析
```
質問: "src/utils/ のファイル構造を見せて、主要なユーティリティファイルを説明してください"

期待される動作:
1. get_file_tree または list_files でファイル一覧取得
2. 複数のファイルを read_file で読み取り
3. 各ファイルの機能をまとめて説明
```

## 🐛 トラブルシューティング

### Ollamaに接続できない

```bash
# Ollamaが起動しているか確認
ps aux | grep ollama

# APIが応答するか確認
curl http://localhost:11434/api/version
```

### APIサーバーが起動しない

```bash
# ポートが使用中か確認
lsof -i :3000

# ビルドエラーがないか確認
npm run build
```

### データベースエラー

```bash
# データベースを再初期化
rm llamune.db
npx tsx scripts/init-base-db.ts
# ... 各マイグレーションを再実行
```

## 🎯 次のステップ

テストが成功したら：
1. Web UIの統合（将来実装）
2. より複雑なツールチェーンのテスト
3. ブランチ作成・コミット機能のテスト
4. カスタムドメインプロンプトの追加

## 📚 関連ドキュメント

- `/tmp/TOOL_CALLING_IMPLEMENTATION.md` - 実装詳細
- `scripts/check-schema.ts` - データベーススキーマ確認
- `src/utils/repository-tools.ts` - ツール定義
- `src/utils/tool-executor.ts` - ツール実行エンジン
