# Llamune Code API エンドポイント仕様

Llamune Code の REST API エンドポイントの完全な仕様書です。

## 目次

- [認証](#認証)
- [チャット](#チャット)
- [モデル管理](#モデル管理)
- [システム情報](#システム情報)
- [パラメータプリセット](#パラメータプリセット)
- [ドメインモード](#ドメインモード)
- [Git リポジトリ](#git-リポジトリ)

---

## 基本情報

**ベース URL**: `http://localhost:3000`

**認証方式**: JWT Bearer Token

**コンテンツタイプ**: `application/json`

**認証ヘッダー**:
```
Authorization: Bearer {ACCESS_TOKEN}
```

---

## 認証

### POST /api/auth/register

ユーザー登録

**認証**: 不要（初回ユーザー）、または管理者権限必要

**リクエスト**:
```json
{
  "username": "admin",
  "password": "your-password",
  "role": "admin"
}
```

**レスポンス** (201 Created):
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### POST /api/auth/login

ログイン

**認証**: 不要

**リクエスト**:
```json
{
  "username": "admin",
  "password": "your-password"
}
```

**レスポンス** (200 OK):
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**エラー** (401 Unauthorized):
```json
{
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS",
  "statusCode": 401
}
```

---

### POST /api/auth/refresh

アクセストークンのリフレッシュ

**認証**: 不要（リフレッシュトークンを使用）

**リクエスト**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**レスポンス** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### POST /api/auth/logout

ログアウト

**認証**: 必要

**リクエスト**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**レスポンス** (200 OK):
```json
{
  "message": "Logged out successfully"
}
```

---

### GET /api/auth/me

現在のユーザー情報取得

**認証**: 必要

**レスポンス** (200 OK):
```json
{
  "id": 1,
  "username": "admin",
  "role": "admin",
  "created_at": "2025-01-01T00:00:00.000Z",
  "updated_at": "2025-01-01T00:00:00.000Z"
}
```

---

### POST /api/auth/change-password

パスワード変更

**認証**: 必要

**リクエスト**:
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

**レスポンス** (200 OK):
```json
{
  "message": "Password changed successfully"
}
```

---

### GET /api/auth/users

ユーザー一覧取得（管理者のみ）

**認証**: 必要（管理者権限）

**レスポンス** (200 OK):
```json
{
  "users": [
    {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### DELETE /api/auth/users/:id

ユーザー削除（管理者のみ）

**認証**: 必要（管理者権限）

**パラメータ**:
- `id`: ユーザーID

**レスポンス** (200 OK):
```json
{
  "message": "User deleted successfully"
}
```

---

## チャット

### POST /api/chat/messages

メッセージ送信（Server-Sent Events でストリーミング）

**認証**: 必要

**リクエスト**:
```json
{
  "sessionId": 1,
  "content": "package.json を読んで、プロジェクト名を教えてください",
  "modelName": "llama3.1:8b",
  "presetId": 1,
  "domainPromptId": 1,
  "repositoryPath": "/path/to/repository",
  "workingBranch": "main",
  "history": []
}
```

**パラメータ**:
- `sessionId` (optional): セッション ID（省略時は新規セッション）
- `content` (required): メッセージ内容
- `modelName` (optional): モデル名（デフォルト: gemma2:9b）
- `presetId` (optional): パラメータプリセット ID
- `domainPromptId` (optional): ドメインプロンプト ID
- `repositoryPath` (optional): **リポジトリパス（ツール有効化に必須）**
- `workingBranch` (optional): 作業ブランチ（デフォルト: main）
- `history` (optional): 会話履歴

**レスポンス** (Server-Sent Events):

```
data: {"content":"この"}

data: {"content":"この package"}

data: {"content":"この package.json"}

...

event: done
data: {"sessionId":1,"fullContent":"この package.json を読んでみると、プロジェクト名は \"llamune_code\" です。","model":"llama3.1:8b"}
```

**SSE イベント**:
- `data`: チャンクデータ（`ChatChunkResponse`）
- `event: done`: 完了通知（`ChatDoneResponse`）

**エラー** (400 Bad Request):
```json
{
  "error": "content is required",
  "code": "INVALID_REQUEST",
  "statusCode": 400
}
```

**重要**: `repositoryPath` を指定することで、10 個のリポジトリツールが LLM に提供されます。

---

### GET /api/chat/sessions

セッション一覧取得

**認証**: 必要

**レスポンス** (200 OK):
```json
{
  "sessions": [
    {
      "id": 1,
      "model": "llama3.1:8b",
      "created_at": "2025-01-01T00:00:00.000Z",
      "message_count": 10,
      "preview": "package.json を読んで...",
      "title": "プロジェクト調査"
    }
  ]
}
```

---

### GET /api/chat/sessions/:id

セッション詳細取得

**認証**: 必要

**パラメータ**:
- `id`: セッション ID

**レスポンス** (200 OK):
```json
{
  "session": {
    "id": 1,
    "model": "llama3.1:8b",
    "created_at": "2025-01-01T00:00:00.000Z"
  },
  "messages": [
    {
      "role": "user",
      "content": "package.json を読んで、プロジェクト名を教えてください"
    },
    {
      "role": "assistant",
      "content": "この package.json を読んでみると、プロジェクト名は \"llamune_code\" です。"
    }
  ]
}
```

---

### DELETE /api/chat/sessions/:id/rewind

セッション巻き戻し

**認証**: 必要

**パラメータ**:
- `id`: セッション ID

**リクエスト**:
```json
{
  "turnNumber": 2
}
```

**レスポンス** (200 OK):
```json
{
  "message": "Session rewound to turn 2"
}
```

---

### PUT /api/chat/sessions/:id/model

モデル切り替え

**認証**: 必要

**パラメータ**:
- `id`: セッション ID

**リクエスト**:
```json
{
  "modelName": "gemma2:9b"
}
```

**レスポンス** (200 OK):
```json
{
  "message": "Model switched to gemma2:9b"
}
```

---

## モデル管理

### GET /api/models

モデル一覧取得

**認証**: 必要

**レスポンス** (200 OK):
```json
{
  "models": [
    {
      "name": "llama3.1:8b",
      "size": 4661211808,
      "modified_at": "2025-01-01T00:00:00.000Z",
      "digest": "sha256:..."
    }
  ]
}
```

---

### GET /api/models/recommended

推奨モデル取得

**認証**: 必要

**レスポンス** (200 OK):
```json
{
  "system": {
    "totalMemory": 34359738368,
    "availableMemory": 20000000000
  },
  "recommended": [
    {
      "name": "llama3.1:8b",
      "size": "4.7GB",
      "reason": "Balanced performance"
    }
  ]
}
```

---

### POST /api/models/pull

モデルダウンロード

**認証**: 必要

**リクエスト**:
```json
{
  "modelName": "llama3.1:8b"
}
```

**レスポンス** (Server-Sent Events):
```
data: {"status":"pulling manifest"}

data: {"status":"downloading","completed":1000000,"total":4661211808}

...

event: done
data: {"status":"success"}
```

---

### DELETE /api/models

モデル削除

**認証**: 必要

**リクエスト**:
```json
{
  "modelName": "llama3.1:8b"
}
```

**レスポンス** (200 OK):
```json
{
  "message": "Model llama3.1:8b deleted successfully"
}
```

---

## システム情報

### GET /api/system/spec

システムスペック取得

**認証**: 必要

**レスポンス** (200 OK):
```json
{
  "cpu": "Apple M1",
  "memory": {
    "total": 34359738368,
    "available": 20000000000
  },
  "platform": "darwin",
  "arch": "arm64"
}
```

---

### GET /api/system/health

ヘルスチェック

**認証**: 必要

**レスポンス** (200 OK):
```json
{
  "status": "ok",
  "ollama": "running"
}
```

---

## パラメータプリセット

### GET /api/presets

パラメータプリセット一覧取得

**認証**: 必要

**レスポンス** (200 OK):
```json
{
  "presets": [
    {
      "id": 1,
      "name": "default",
      "display_name": "デフォルト",
      "description": "LLM のデフォルト値を使用",
      "temperature": null,
      "top_p": null,
      "top_k": null,
      "repeat_penalty": null,
      "num_ctx": null
    },
    {
      "id": 2,
      "name": "balanced",
      "display_name": "バランス",
      "description": "バランスの取れた設定",
      "temperature": 0.7,
      "top_p": 0.9,
      "top_k": 40,
      "repeat_penalty": 1.1,
      "num_ctx": 2048
    }
  ]
}
```

---

## ドメインモード

### GET /api/domains

ドメイン一覧取得

**認証**: 必要

**レスポンス** (200 OK):
```json
{
  "domains": [
    {
      "id": 1,
      "name": "general",
      "display_name": "汎用",
      "description": "一般的な用途",
      "icon": "💬"
    },
    {
      "id": 2,
      "name": "accounting",
      "display_name": "会計",
      "description": "会計・財務領域",
      "icon": "💰"
    }
  ]
}
```

---

### GET /api/domains/:id

ドメイン詳細取得

**認証**: 必要

**パラメータ**:
- `id`: ドメイン ID

**レスポンス** (200 OK):
```json
{
  "id": 1,
  "name": "general",
  "display_name": "汎用",
  "description": "一般的な用途",
  "icon": "💬",
  "prompts": [
    {
      "id": 1,
      "name": "standard",
      "display_name": "標準",
      "system_prompt": "あなたは親切なアシスタントです。"
    }
  ]
}
```

---

### GET /api/domains/:id/prompts

ドメインプロンプト一覧取得

**認証**: 必要

**パラメータ**:
- `id`: ドメイン ID

**レスポンス** (200 OK):
```json
{
  "prompts": [
    {
      "id": 1,
      "domain_id": 1,
      "name": "standard",
      "display_name": "標準",
      "system_prompt": "あなたは親切なアシスタントです。",
      "description": "標準的な対話"
    }
  ]
}
```

---

### GET /api/domains/prompts/:id

プロンプト詳細取得

**認証**: 必要

**パラメータ**:
- `id`: プロンプト ID

**レスポンス** (200 OK):
```json
{
  "id": 1,
  "domain_id": 1,
  "name": "standard",
  "display_name": "標準",
  "system_prompt": "あなたは親切なアシスタントです。",
  "description": "標準的な対話"
}
```

---

## Git リポジトリ

### GET /api/git-repos

リポジトリスキャン

**認証**: 必要

**クエリパラメータ**:
- `path` (optional): スキャン開始パス（デフォルト: ホームディレクトリ）

**レスポンス** (200 OK):
```json
{
  "repositories": [
    {
      "path": "/Users/username/projects/llamune_code",
      "name": "llamune_code",
      "branch": "main",
      "isGitRepo": true
    }
  ]
}
```

---

## リポジトリツール

チャット API で `repositoryPath` を指定すると、以下の 10 個のツールが LLM に提供されます：

### 利用可能なツール

1. **read_file** - ファイル読み取り
2. **write_file** - ファイル書き込み
3. **list_files** - ディレクトリ一覧
4. **search_code** - コード検索
5. **git_status** - Git ステータス確認
6. **git_diff** - 差分表示
7. **create_branch** - ブランチ作成
8. **commit_changes** - コミット作成
9. **get_file_tree** - ファイルツリー取得
10. **get_recent_commits** - コミット履歴

詳細は [リポジトリツール使用ガイド](./REPOSITORY_TOOLS.md) を参照してください。

---

## エラーレスポンス

すべてのエラーは以下の形式で返されます：

```json
{
  "error": "エラーメッセージ",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

### 一般的なエラーコード

- `INVALID_REQUEST` (400) - リクエストが不正
- `UNAUTHORIZED` (401) - 認証が必要
- `FORBIDDEN` (403) - 権限がない
- `NOT_FOUND` (404) - リソースが見つからない
- `INTERNAL_ERROR` (500) - サーバーエラー
- `INVALID_CREDENTIALS` (401) - 認証情報が不正
- `INVALID_DOMAIN_PROMPT` (400) - ドメインプロンプト ID が不正

---

## 認証フロー

### 1. 初回セットアップ

```bash
# 管理者ユーザー作成
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password","role":"admin"}'
```

### 2. ログイン

```bash
# ログインしてトークン取得
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

レスポンス:
```json
{
  "user": {...},
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 3. API 呼び出し

```bash
# アクセストークンを使用
curl -X GET http://localhost:3000/api/models \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 4. トークンリフレッシュ

```bash
# アクセストークンの有効期限が切れたらリフレッシュ
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"eyJhbGciOiJIUzI1NiIs..."}'
```

---

## リポジトリツールの使用例

```bash
# トークン取得
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -s | jq -r '.accessToken')

# リポジトリツールを使用したチャット
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"package.json を読んで、プロジェクト名を教えてください\",
    \"modelName\": \"llama3.1:8b\",
    \"repositoryPath\": \"/path/to/repository\",
    \"workingBranch\": \"main\"
  }" \
  -N
```

**重要**: `repositoryPath` を指定することで、LLM がファイル操作や Git 操作を実行できるようになります。

---

## Server-Sent Events (SSE) の処理

チャット API はストリーミングレスポンスを返します。クライアント側での処理例：

### JavaScript / TypeScript

```typescript
const response = await fetch('/api/chat/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    content: 'Hello',
    modelName: 'llama3.1:8b'
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log('Chunk:', data.content);
    } else if (line.startsWith('event: done')) {
      const nextLine = lines[lines.indexOf(line) + 1];
      if (nextLine?.startsWith('data: ')) {
        const doneData = JSON.parse(nextLine.slice(6));
        console.log('Done:', doneData);
      }
    }
  }
}
```

---

## まとめ

Llamune Code API は以下の機能を提供します：

- ✅ JWT ベースの認証
- ✅ ストリーミングチャット（SSE）
- ✅ **リポジトリツール統合（10種類）**
- ✅ モデル管理
- ✅ セッション管理
- ✅ ドメイン特化モード
- ✅ パラメータプリセット

次回のセッションでは、このドキュメントを参照して GUI 開発を進めることができます！
