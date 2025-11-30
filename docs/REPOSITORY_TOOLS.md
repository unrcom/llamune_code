# リポジトリツール使用ガイド

llamune_code は、LLM が Git リポジトリに対して直接操作を行える 10 個のツールを提供します。

## 概要

リポジトリツールを使用すると、LLM は以下のような操作を自律的に実行できます：

- ファイルの読み書き
- コード検索
- Git 操作（ステータス確認、差分表示、コミット作成など）
- ファイルツリーの取得

## 前提条件

### 1. サービスの起動

**API サーバー**
```bash
npm run api
```

**Ollama**
```bash
ollama serve
```

**LLM モデルの準備**
```bash
# 例: llama3.1:8b を使用する場合
ollama pull llama3.1:8b
```

### 2. リポジトリパスの指定

ツールを有効化するには、API リクエスト時に `repositoryPath` パラメータを指定する必要があります：

```bash
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"質問内容\",
    \"modelName\": \"llama3.1:8b\",
    \"repositoryPath\": \"/path/to/repository\",
    \"workingBranch\": \"main\"
  }"
```

## 利用可能なツール（全10種類）

### 1. read_file - ファイル読み取り

**説明**: 指定されたファイルの内容を読み取ります。

**使用例**:
```bash
"package.json を読んで、プロジェクト名を教えてください"
```

**LLM の動作**: `read_file` ツールを呼び出し、ファイル内容を取得して回答します。

---

### 2. write_file - ファイル書き込み

**説明**: ファイルを作成または上書きします。

**使用例**:
```bash
"test.txt というファイルを作成して、'Hello World' と書き込んでください"
```

**LLM の動作**: `write_file` ツールで新しいファイルを作成します。

**注意**: 既存ファイルを上書きする可能性があるため、慎重に使用してください。

---

### 3. list_files - ディレクトリ一覧

**説明**: 指定されたディレクトリのファイル・フォルダ一覧を取得します。

**使用例**:
```bash
"src ディレクトリにあるファイル一覧を教えてください"
```

**LLM の動作**: `list_files` ツールでディレクトリ内容を取得します。

---

### 4. search_code - コード検索

**説明**: リポジトリ内で指定されたパターンに一致するコードを検索します。

**使用例**:
```bash
"repositoryPath という文字列を含むファイルを検索してください"
```

**LLM の動作**: `search_code` ツールで grep 検索を実行します。

**パラメータ**:
- `pattern`: 検索パターン（正規表現対応）
- `file_pattern`: ファイル名フィルタ（例: "*.ts"）
- `case_sensitive`: 大文字小文字を区別するか（デフォルト: true）

---

### 5. git_status - Git ステータス

**説明**: 現在の Git ワークツリーの状態を確認します。

**使用例**:
```bash
"現在の Git ステータスを教えてください"
```

**LLM の動作**: `git status` コマンドを実行し、変更されたファイルやステージング状態を報告します。

---

### 6. git_diff - 差分表示

**説明**: Git の差分を表示します。

**使用例**:
```bash
"最新のコミットとの差分を表示してください"
"package.json の変更内容を見せてください"
```

**LLM の動作**: `git diff` コマンドを実行します。

**パラメータ**:
- `file_path`: 特定ファイルの差分のみ表示（オプション）
- `staged`: ステージングされた変更のみ表示（デフォルト: false）

---

### 7. create_branch - ブランチ作成

**説明**: 新しい Git ブランチを作成し、チェックアウトします。

**使用例**:
```bash
"feature/new-feature というブランチを作成してください"
```

**LLM の動作**: `git checkout -b` コマンドでブランチを作成します。

**注意**: 実際に Git 操作を実行するため、慎重に使用してください。

---

### 8. commit_changes - コミット作成

**説明**: 変更をステージングし、コミットを作成します。

**使用例**:
```bash
"変更をコミットしてください。メッセージは 'Fix bug in authentication' でお願いします"
```

**LLM の動作**: `git add` と `git commit` を実行します。

**パラメータ**:
- `message`: コミットメッセージ
- `files`: コミット対象ファイル（省略時は全変更ファイル）

**注意**: 実際にコミットを作成するため、慎重に使用してください。

---

### 9. get_file_tree - ファイルツリー取得

**説明**: リポジトリのディレクトリ構造を階層的に取得します。

**使用例**:
```bash
"このリポジトリのファイル構造を教えてください"
"src フォルダの構造を見せてください"
```

**LLM の動作**: ディレクトリツリーを再帰的に取得し、構造化して表示します。

**パラメータ**:
- `path`: 起点ディレクトリ（デフォルト: リポジトリルート）
- `max_depth`: 最大深度（デフォルト: 3）

---

### 10. get_recent_commits - コミット履歴

**説明**: 最近のコミット履歴を取得します。

**使用例**:
```bash
"最近のコミット履歴を 5 件表示してください"
"直近の変更内容を教えてください"
```

**LLM の動作**: `git log` コマンドで履歴を取得します。

**パラメータ**:
- `count`: 取得件数（デフォルト: 10）
- `file_path`: 特定ファイルの履歴のみ（オプション）

---

## 動作確認手順

### 準備: 認証トークンの取得

```bash
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -s | jq -r '.accessToken')
```

### 包括的なテストワークフロー

以下は、複数のツールを組み合わせた完全なテストフローです：

**ステップ 1: テスト用ブランチを作成**
```bash
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"test/tool-verification という名前のテストブランチを作成してください\",
    \"modelName\": \"llama3.1:8b\",
    \"repositoryPath\": \"$(pwd)\",
    \"workingBranch\": \"main\"
  }" \
  -N
```

**ステップ 2: テストファイルを作成**
```bash
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"test.txt というファイルを作成して、'Test for repository tools' という内容を書き込んでください\",
    \"modelName\": \"llama3.1:8b\",
    \"repositoryPath\": \"$(pwd)\",
    \"workingBranch\": \"test/tool-verification\"
  }" \
  -N
```

**ステップ 3: 変更をコミット**
```bash
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"test.txt をコミットしてください。メッセージは 'Test commit tool' でお願いします\",
    \"modelName\": \"llama3.1:8b\",
    \"repositoryPath\": \"$(pwd)\",
    \"workingBranch\": \"test/tool-verification\"
  }" \
  -N
```

**ステップ 4: コミット確認**
```bash
# ローカルで確認
git log -1 --oneline
git status
```

**ステップ 5: テストブランチの削除（クリーンアップ）**
```bash
# 開発ブランチに戻る
git checkout main  # または開発中のブランチ

# テストブランチを削除
git branch -D test/tool-verification
```

このワークフローで以下のツールをテストできます：
- ✅ `create_branch` - ブランチ作成
- ✅ `write_file` - ファイル作成
- ✅ `commit_changes` - コミット作成
- ✅ `git_status` - ステータス確認（手動）
- ✅ `git_log` - コミット履歴確認（手動）

---

### 個別ツールのテスト例

以下は個別ツールの動作確認例です。本番環境では上記の包括的なワークフローを推奨します。

#### read_file - ファイル読み取り

```bash
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"package.json を読んで、プロジェクト名を教えてください\",
    \"modelName\": \"llama3.1:8b\",
    \"repositoryPath\": \"$(pwd)\",
    \"workingBranch\": \"main\"
  }" \
  -N
```

#### git_status - Gitステータス確認

```bash
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"現在の Git ステータスを教えてください\",
    \"modelName\": \"llama3.1:8b\",
    \"repositoryPath\": \"$(pwd)\",
    \"workingBranch\": \"main\"
  }" \
  -N
```

#### search_code - コード検索

```bash
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"repositoryPath という文字列を含むファイルを検索してください\",
    \"modelName\": \"llama3.1:8b\",
    \"repositoryPath\": \"$(pwd)\",
    \"workingBranch\": \"main\"
  }" \
  -N
```

## デバッグモード

ツール呼び出しをデバッグするには、環境変数を設定します：

```bash
export DEBUG_TOOL_CALLING=true
npm run api
```

ログに以下のような出力が表示されます：

```
[DEBUG] Tools enabled, repository path: /path/to/repository
[DEBUG] Tool called: read_file
[DEBUG] Tool parameters: {"file_path":"package.json"}
```

## トラブルシューティング

### ツールが呼び出されない

**原因**:
- `repositoryPath` パラメータが指定されていない
- リポジトリパスが存在しない
- モデルがツール呼び出しをサポートしていない

**解決方法**:
1. `repositoryPath` が正しいパスであることを確認
2. `DEBUG_TOOL_CALLING=true` でログを確認
3. Ollama でツール対応モデルを使用（llama3.1:8b、gemma2:9b など）

### ファイル操作が失敗する

**原因**:
- ファイルパスが不正
- 権限がない
- ファイルが存在しない

**解決方法**:
1. パスが絶対パスではなく、リポジトリルートからの相対パスであることを確認
2. ファイル・ディレクトリの権限を確認
3. エラーメッセージを確認して原因を特定

### Git 操作が失敗する

**原因**:
- Git リポジトリではないディレクトリを指定
- ブランチが存在しない
- コンフリクトが発生

**解決方法**:
1. `git status` で現在の状態を確認
2. リポジトリパスが Git リポジトリのルートであることを確認
3. 手動で Git 操作を試して問題を特定

## 実装の詳細

### ツール定義の場所

- **ツール定義**: `src/utils/repository-tools.ts`
- **ツール有効化**: `src/core/chat-session.ts` (99行目付近)
- **パス管理**: リポジトリ情報はデータベースではなく、リクエスト時のパラメータで管理

### 重要な実装ポイント

```typescript
// src/core/chat-session.ts:99
if (this.repositoryPath) {
  request.tools = repositoryTools;
  if (process.env.DEBUG_TOOL_CALLING === 'true') {
    console.log('[DEBUG] Tools enabled, repository path:', this.repositoryPath);
  }
}
```

`repositoryPath` が指定されている場合のみ、ツールが有効化されます。

### ツール呼び出しフロー

1. ユーザーが `repositoryPath` を含むリクエストを送信
2. `ChatSession` が `repositoryPath` を検出
3. `repositoryTools` を LLM リクエストに追加
4. LLM がツールを選択して呼び出し
5. ツールが実行され、結果を LLM に返す
6. LLM が結果を元に回答を生成

## セキュリティ考慮事項

### 危険な操作

以下のツールは実際に Git 操作を実行するため、慎重に使用してください：

- `write_file`: ファイルを上書きする可能性
- `create_branch`: 新しいブランチを作成
- `commit_changes`: コミットを作成

### 推奨事項

1. **テスト環境で試す**: 本番リポジトリで試す前に、テストリポジトリで動作確認
2. **バックアップを取る**: 重要な変更前に Git でコミットしておく
3. **デバッグモードを使用**: `DEBUG_TOOL_CALLING=true` で動作を監視
4. **読み取り専用操作から始める**: まず `read_file`, `git_status` などで試す

## まとめ

llamune_code のリポジトリツールは、LLM にコードベースへの直接アクセスを提供し、より高度な開発支援を可能にします。

- **10 個のツール**が利用可能
- **repositoryPath 指定**で自動的に有効化
- **Ollama 対応モデル**で動作（llama3.1:8b、gemma2:9b など）
- **読み取り専用から破壊的操作まで**幅広い操作をサポート

安全に使用するために、まず読み取り専用ツールで動作確認してから、書き込み・Git 操作を試すことをお勧めします。
