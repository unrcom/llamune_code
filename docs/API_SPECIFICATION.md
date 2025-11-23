# Llamune API 仕様書

## 概要

- **ベースURL**: `http://localhost:3000`
- **認証方式**: Bearer Token
- **Content-Type**: `application/json`

---

## 認証

すべての `/api/*` エンドポイントは認証が必要です（`/health` と `/api` メタ情報を除く）。

### 認証ヘッダー

```
Authorization: Bearer {API_KEY}
```

### APIキーの設定

**⚠️ 重要: デフォルトキーは使用しないでください**

初期セットアップ時に独自のAPIキーを生成する必要があります：

```bash
# テンプレートファイルをコピー
cp config/api-keys.json.example config/api-keys.json

# セキュアなキーを生成
openssl rand -base64 32

# 生成されたキーの前に "sk_llamune_" を付けて
# config/api-keys.json に設定
```

詳細は [セットアップガイド](./SETUP.md) を参照してください。

**以下のドキュメント例では `sk_llamune_default_key_change_this` を使用していますが、これは例示のみです。実際の環境では絶対に使用しないでください。**

### エラーレスポンス

**認証ヘッダーなし:**
```json
{
  "error": "Authorization header is required",
  "code": "UNAUTHORIZED",
  "statusCode": 401
}
```

**無効なAPIキー:**
```json
{
  "error": "Invalid API key",
  "code": "UNAUTHORIZED",
  "statusCode": 401
}
```

---

## エンドポイント一覧

### 1. API メタ情報

#### `GET /api`

APIの情報、バージョン、利用可能なエンドポイント一覧を取得します（認証不要）。

**認証**: 不要

**リクエスト例:**
```bash
curl http://localhost:3000/api
```

**レスポンス:**
```json
{
  "name": "Llamune API",
  "version": "0.1.0",
  "description": "クローズドネットワーク環境で複数のローカルLLMを比較・活用するプラットフォーム",
  "platform": "Closed Network LLM Platform",
  "endpoints": {
    "models": {
      "list": "GET /api/models",
      "pull": "POST /api/models/pull",
      "delete": "DELETE /api/models",
      "recommended": "GET /api/models/recommended"
    },
    "chat": {
      "sendMessage": "POST /api/chat/messages",
      "retry": "POST /api/chat/retry",
      "listSessions": "GET /api/chat/sessions",
      "getSession": "GET /api/chat/sessions/:id",
      "rewind": "DELETE /api/chat/sessions/:id/rewind",
      "switchModel": "PUT /api/chat/sessions/:id/model"
    },
    "system": {
      "spec": "GET /api/system/spec",
      "health": "GET /api/system/health"
    },
    "presets": {
      "list": "GET /api/presets"
    }
  },
  "documentation": {
    "main": "https://github.com/unrcom/llamune/blob/main/docs/API_SPECIFICATION.md",
    "chat": "https://github.com/unrcom/llamune/blob/main/docs/API_CHAT_ENDPOINTS.md",
    "setup": "https://github.com/unrcom/llamune/blob/main/docs/SETUP.md"
  },
  "authentication": {
    "type": "Bearer Token",
    "header": "Authorization: Bearer {API_KEY}",
    "setup": "See docs/SETUP.md for configuration"
  }
}
```

**用途:**
- GUIクライアントがAPIサーバーの機能を自動検出
- バージョン確認
- エンドポイント一覧の取得
- ドキュメントURLの取得

**CLI対応:**

CLI の `llamune` コマンド（引数なし）に相当する情報を提供します。

```bash
# CLI
llamune

# API
curl http://localhost:3000/api
```

---

### 2. ヘルスチェック

#### `GET /health`

サーバーの稼働状態を確認します（認証不要）。

**認証**: 不要

**リクエスト例:**
```bash
curl http://localhost:3000/health
```

**レスポンス:**
```json
{
  "status": "ok"
}
```

---

### 3. システム情報

#### `GET /api/system/spec`

システムのハードウェアスペックを取得します。

**認証**: 必要

**リクエスト例:**
```bash
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/system/spec
```

**レスポンス:**
```json
{
  "totalMemoryGB": 13,
  "cpuCores": 16,
  "platform": "linux",
  "arch": "x64"
}
```

**レスポンスフィールド:**
- `totalMemoryGB` (number): 総メモリ容量（GB）
- `cpuCores` (number): CPUコア数
- `platform` (string): OS プラットフォーム
- `arch` (string): アーキテクチャ

---

#### `GET /api/system/health`

システムとOllamaの稼働状態を確認します。

**認証**: 必要

**リクエスト例:**
```bash
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/system/health
```

**レスポンス:**
```json
{
  "status": "ok",
  "ollama": "running"
}
```

**レスポンスフィールド:**
- `status` (string): サーバーステータス（常に `"ok"`）
- `ollama` (string): Ollamaの状態（`"running"` または `"stopped"`）

---

### 3. パラメータプリセット

#### `GET /api/presets`

利用可能なパラメータプリセット一覧を取得します。

**認証**: 必要

**リクエスト例:**
```bash
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/presets
```

**レスポンス:**
```json
{
  "presets": [
    {
      "id": 1,
      "name": "default",
      "display_name": "デフォルト",
      "description": "バランスの取れた標準設定",
      "temperature": 0.7,
      "top_p": 0.9,
      "top_k": 40,
      "repeat_penalty": 1.1,
      "num_ctx": 2048,
      "created_at": "2025-11-17T09:03:25.819Z"
    },
    {
      "id": 2,
      "name": "creative",
      "display_name": "高感度",
      "description": "創造的で多様な回答",
      "temperature": 1.0,
      "top_p": 0.95,
      "top_k": 50,
      "repeat_penalty": 1.05,
      "num_ctx": 2048,
      "created_at": "2025-11-17T09:03:25.819Z"
    }
  ]
}
```

**プリセットフィールド:**
- `id` (number): プリセットID
- `name` (string): プリセット名（識別子）
- `display_name` (string): 表示名
- `description` (string): 説明
- `temperature` (number): 温度パラメータ（0.0-2.0）
- `top_p` (number): Top-Pサンプリング（0.0-1.0）
- `top_k` (number): Top-Kサンプリング
- `repeat_penalty` (number): 繰り返しペナルティ
- `num_ctx` (number): コンテキスト長
- `created_at` (string): 作成日時（ISO 8601形式）

---

### 4. モデル管理

#### `GET /api/models`

Ollamaにインストールされているモデル一覧を取得します。

**認証**: 必要

**リクエスト例:**
```bash
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/models
```

**レスポンス（成功時）:**
```json
{
  "models": [
    {
      "name": "llama2:latest",
      "size": 3825819519,
      "modified_at": "2025-01-15T10:30:00Z"
    },
    {
      "name": "gemma2:9b",
      "size": 5816076993,
      "modified_at": "2025-01-16T14:20:00Z"
    }
  ]
}
```

**エラーレスポンス（Ollama未起動）:**
```json
{
  "error": "Ollama に接続できませんでした: fetch failed",
  "code": "OLLAMA_ERROR",
  "statusCode": 500
}
```

**モデルフィールド:**
- `name` (string): モデル名
- `size` (number): モデルサイズ（バイト）
- `modified_at` (string): 最終更新日時（ISO 8601形式）

---

#### `GET /api/models/recommended`

システムスペックに基づいた推奨モデルを取得します。

**認証**: 必要

**リクエスト例:**
```bash
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/models/recommended
```

**レスポンス:**
```json
{
  "spec": {
    "totalMemoryGB": 13,
    "cpuCores": 16,
    "platform": "linux",
    "arch": "x64"
  },
  "recommended": [
    {
      "name": "gemma2:9b",
      "size": "5.4 GB",
      "description": "バランス型。品質と速度を両立",
      "priority": 1
    },
    {
      "name": "qwen2.5:7b",
      "size": "4.7 GB",
      "description": "日本語性能が高い",
      "priority": 2
    }
  ]
}
```

**推奨モデルフィールド:**
- `name` (string): モデル名
- `size` (string): モデルサイズ（人間が読める形式）
- `description` (string): モデルの説明
- `priority` (number): 優先順位（小さいほど優先度が高い）

---

#### `POST /api/models/pull`

Ollamaモデルをダウンロードします。

**認証**: 必要

**リクエストボディ:**
```json
{
  "modelName": "llama2:latest"
}
```

**リクエストフィールド:**
- `modelName` (string, 必須): ダウンロードするモデル名

**リクエスト例:**
```bash
curl -X POST \
  -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  -H "Content-Type: application/json" \
  -d '{"modelName": "llama2:latest"}' \
  http://localhost:3000/api/models/pull
```

**レスポンス（成功時）:**
```json
{
  "success": true,
  "modelName": "llama2:latest"
}
```

**エラーレスポンス（パラメータ不足）:**
```json
{
  "error": "modelName is required",
  "code": "INVALID_REQUEST",
  "statusCode": 400
}
```

**エラーレスポンス（Ollamaエラー）:**
```json
{
  "error": "モデルのダウンロードに失敗しました",
  "code": "OLLAMA_ERROR",
  "statusCode": 500
}
```

---

#### `DELETE /api/models`

Ollamaモデルを削除します。

**認証**: 必要

**リクエストボディ:**
```json
{
  "modelName": "llama2:latest"
}
```

**リクエストフィールド:**
- `modelName` (string, 必須): 削除するモデル名

**リクエスト例:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  -H "Content-Type: application/json" \
  -d '{"modelName": "llama2:latest"}' \
  http://localhost:3000/api/models
```

**レスポンス（成功時）:**
```json
{
  "success": true,
  "modelName": "llama2:latest"
}
```

**エラーレスポンス（パラメータ不足）:**
```json
{
  "error": "modelName is required",
  "code": "INVALID_REQUEST",
  "statusCode": 400
}
```

**エラーレスポンス（Ollamaエラー）:**
```json
{
  "error": "モデルの削除に失敗しました",
  "code": "OLLAMA_ERROR",
  "statusCode": 500
}
```

---

### 5. チャット機能

チャット機能の詳細なエンドポイント仕様は、別ドキュメントを参照してください：

**📄 [チャット機能エンドポイント仕様](./API_CHAT_ENDPOINTS.md)**

#### エンドポイント一覧

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| `POST` | `/api/chat/messages` | メッセージ送信（ストリーミング） |
| `POST` | `/api/chat/retry` | 再実行（モデル切り替え） |
| `GET` | `/api/chat/sessions` | セッション一覧 |
| `GET` | `/api/chat/sessions/:id` | セッション詳細 |
| `DELETE` | `/api/chat/sessions/:id/rewind` | 巻き戻し |
| `PUT` | `/api/chat/sessions/:id/model` | モデル切り替え |

**特徴:**
- Server-Sent Events (SSE) によるストリーミング対応
- セッション管理（会話履歴の保存・復元）
- モデル切り替えとリトライ機能
- 会話の巻き戻し機能

---

## エラーコード一覧

| コード | HTTPステータス | 説明 |
|--------|---------------|------|
| `UNAUTHORIZED` | 401 | 認証エラー（APIキー不正または未提供） |
| `INVALID_REQUEST` | 400 | リクエストパラメータ不正 |
| `NOT_FOUND` | 404 | リソースが見つからない（セッション等） |
| `OLLAMA_ERROR` | 500 | Ollama関連のエラー |
| `STREAM_ERROR` | 500 | ストリーミングエラー |
| `RETRY_ERROR` | 500 | リトライ失敗 |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー |

---

## 使用例

### Python

```python
import requests

API_BASE = "http://localhost:3000"
API_KEY = "sk_llamune_default_key_change_this"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# システムスペック取得
response = requests.get(f"{API_BASE}/api/system/spec", headers=HEADERS)
print(response.json())

# プリセット一覧取得
response = requests.get(f"{API_BASE}/api/presets", headers=HEADERS)
print(response.json())

# 推奨モデル取得
response = requests.get(f"{API_BASE}/api/models/recommended", headers=HEADERS)
print(response.json())

# モデルダウンロード
response = requests.post(
    f"{API_BASE}/api/models/pull",
    headers=HEADERS,
    json={"modelName": "llama2:latest"}
)
print(response.json())
```

### JavaScript/Node.js

```javascript
const API_BASE = "http://localhost:3000";
const API_KEY = "sk_llamune_default_key_change_this";
const headers = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json"
};

// システムスペック取得
const spec = await fetch(`${API_BASE}/api/system/spec`, { headers });
console.log(await spec.json());

// プリセット一覧取得
const presets = await fetch(`${API_BASE}/api/presets`, { headers });
console.log(await presets.json());

// 推奨モデル取得
const recommended = await fetch(`${API_BASE}/api/models/recommended`, { headers });
console.log(await recommended.json());

// モデルダウンロード
const pull = await fetch(`${API_BASE}/api/models/pull`, {
  method: "POST",
  headers,
  body: JSON.stringify({ modelName: "llama2:latest" })
});
console.log(await pull.json());
```

### curl

```bash
# システムスペック取得
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/system/spec

# プリセット一覧取得
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/presets

# 推奨モデル取得
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/models/recommended

# モデルダウンロード
curl -X POST \
  -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  -H "Content-Type: application/json" \
  -d '{"modelName": "llama2:latest"}' \
  http://localhost:3000/api/models/pull

# モデル削除
curl -X DELETE \
  -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  -H "Content-Type: application/json" \
  -d '{"modelName": "llama2:latest"}' \
  http://localhost:3000/api/models
```

---

## セキュリティ

### APIキー管理

1. **デフォルトキーを変更**: `config/api-keys.json` のデフォルトキーを必ず変更してください
2. **複数キーの管理**: 複数のAPIキーを設定し、用途に応じて使い分けることができます
3. **HTTPS推奨**: 本番環境ではHTTPSを使用してください

### CORS設定

現在の設定では全てのオリジンを許可しています。本番環境では適切なオリジンを設定してください。

```typescript
// src/api/server.ts
app.use(cors({
  origin: 'https://your-frontend-domain.com'
}));
```

---

## 注意事項

1. **Ollama依存**: モデル関連のエンドポイントはOllamaが起動している必要があります
2. **データベース初期化**: プリセットエンドポイントを使用する前に `npm run migrate:presets` を実行してください
3. **ポート設定**: 環境変数 `PORT` でポート番号を変更できます（デフォルト: 3000）
4. **タイムアウト**: モデルダウンロードは時間がかかる場合があります

---

## トラブルシューティング

### Ollamaに接続できない

**症状**: `OLLAMA_ERROR: fetch failed`

**解決方法**:
1. Ollamaが起動しているか確認: `ollama list`
2. Ollamaのポートを確認（デフォルト: 11434）
3. ファイアウォール設定を確認

### プリセットが取得できない

**症状**: `INTERNAL_ERROR`

**解決方法**:
```bash
npm run migrate:presets
```

### 認証エラー

**症状**: `UNAUTHORIZED`

**解決方法**:
1. `config/api-keys.json` の設定を確認
2. `Authorization` ヘッダーの形式を確認: `Bearer {API_KEY}`
3. APIキーが正しいか確認

---

## バージョン履歴

### v0.1.0 (2025-11-17)
- 初回リリース
- 8つのRESTful APIエンドポイント実装
- Bearer Token認証
- Ollama連携
- パラメータプリセット管理
