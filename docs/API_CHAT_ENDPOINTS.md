# チャット機能エンドポイント

以下の内容を `docs/API_SPECIFICATION.md` の「### 4. モデル管理」セクションの後に追加してください。

---

### 5. チャット機能

#### `POST /api/chat/messages`

メッセージを送信してストリーミングレスポンスを取得します（Server-Sent Events使用）。

**認証**: 必要

**リクエストボディ:**
```json
{
  "content": "Pythonでクイックソートを実装して",
  "sessionId": 1,
  "modelName": "gemma2:9b",
  "presetId": 1,
  "history": []
}
```

**リクエストフィールド:**
- `content` (string, 必須): ユーザーのメッセージ
- `sessionId` (number, オプション): 既存セッションID（継続の場合）
- `modelName` (string, オプション): モデル名（デフォルト: `gemma2:9b`）
- `presetId` (number, オプション): パラメータプリセットID
- `history` (array, オプション): 会話履歴（新規セッション時）

**リクエスト例:**
```bash
curl -X POST \
  -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  -H "Content-Type: application/json" \
  -d '{"content": "Pythonでクイックソートを実装して"}' \
  http://localhost:3000/api/chat/messages
```

**レスポンス（SSE）:**

ストリーミングでチャンクが送信されます。各チャンクには**開始から現在までの累積的な応答テキスト**が含まれます：

```
data: {"content":"は"}

data: {"content":"はい"}

data: {"content":"はい、実装"}

event: done
data: {"sessionId":1,"fullContent":"はい、実装します...\n\n```python\ndef quick_sort(arr):...","model":"gemma2:9b"}
```

**チャンクレスポンス:**
```json
{
  "content": "開始から現在までの累積的な応答テキスト"
}
```

**注意:** 各チャンクの `content` は差分ではなく、応答開始からの全文です。クライアント側で前のチャンクとの差分を計算する必要はありません。

**完了レスポンス（`event: done`）:**
```json
{
  "sessionId": 1,
  "fullContent": "完全な応答テキスト",
  "model": "gemma2:9b"
}
```

**エラーレスポンス（`event: error`）:**
```json
{
  "error": "Stream error",
  "code": "STREAM_ERROR",
  "statusCode": 500
}
```

---

#### `POST /api/chat/retry`

前回の応答を破棄して、別のモデルまたはプリセットで再実行します。

**認証**: 必要

**リクエストボディ:**
```json
{
  "sessionId": 1,
  "modelName": "qwen2.5:7b",
  "presetId": 2,
  "history": []
}
```

**リクエストフィールド:**
- `sessionId` (number, オプション): 既存セッションID
- `modelName` (string, 必須): 使用するモデル名
- `presetId` (number, オプション): パラメータプリセットID
- `history` (array, オプション): 会話履歴（sessionIdがない場合）

**リクエスト例:**
```bash
curl -X POST \
  -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":1,"modelName":"qwen2.5:7b","presetId":2}' \
  http://localhost:3000/api/chat/retry
```

**レスポンス（SSE）:**

`/api/chat/messages` と同様のSSEストリーミング形式。各チャンクには**開始から現在までの累積的な応答テキスト**が含まれます。

最後に `event: done` で完了イベントが送信され、セッションIDと完全な応答が返されます。

---

#### `GET /api/chat/sessions`

すべてのチャットセッション一覧を取得します。

**認証**: 必要

**リクエスト例:**
```bash
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/chat/sessions
```

**レスポンス:**
```json
{
  "sessions": [
    {
      "id": 1,
      "model": "gemma2:9b",
      "created_at": "2025-11-17T10:30:00.000Z",
      "message_count": 4,
      "preview": "Pythonでクイックソートを実装して"
    },
    {
      "id": 2,
      "model": "qwen2.5:7b",
      "created_at": "2025-11-17T09:15:00.000Z",
      "message_count": 6,
      "preview": "REST APIの実装方法を教えて"
    }
  ]
}
```

**セッションフィールド:**
- `id` (number): セッションID
- `model` (string): 使用したモデル名
- `created_at` (string): 作成日時（ISO 8601形式）
- `message_count` (number): メッセージ数
- `preview` (string): 最初のユーザーメッセージのプレビュー

---

#### `GET /api/chat/sessions/:id`

特定のセッションの詳細（メッセージ履歴含む）を取得します。

**認証**: 必要

**リクエスト例:**
```bash
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/chat/sessions/1
```

**レスポンス:**
```json
{
  "session": {
    "id": 1,
    "model": "gemma2:9b",
    "created_at": "2025-11-17T10:30:00.000Z"
  },
  "messages": [
    {
      "role": "user",
      "content": "Pythonでクイックソートを実装して"
    },
    {
      "role": "assistant",
      "content": "はい、実装します...",
      "model": "gemma2:9b"
    },
    {
      "role": "user",
      "content": "複雑度を教えて"
    },
    {
      "role": "assistant",
      "content": "平均計算量は O(n log n) です...",
      "model": "gemma2:9b"
    }
  ]
}
```

**エラーレスポンス（存在しないセッション）:**
```json
{
  "error": "Session not found",
  "code": "NOT_FOUND",
  "statusCode": 404
}
```

---

#### `DELETE /api/chat/sessions/:id/rewind`

セッションを指定したターン（往復）まで巻き戻します。

**認証**: 必要

**リクエストボディ:**
```json
{
  "turnNumber": 2
}
```

**リクエストフィールド:**
- `turnNumber` (number, 必須): 残すターン数（user-assistantのペア数）

**リクエスト例:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  -H "Content-Type: application/json" \
  -d '{"turnNumber":2}' \
  http://localhost:3000/api/chat/sessions/1/rewind
```

**レスポンス:**
```json
{
  "success": true,
  "sessionId": 1,
  "turnNumber": 2
}
```

**説明:**

ターン数 2 の場合、最初の2往復（user-assistant ペア×2）のみ残り、それ以降は削除されます。

---

#### `PUT /api/chat/sessions/:id/model`

セッションで使用するモデルを切り替えます。

**認証**: 必要

**リクエストボディ:**
```json
{
  "modelName": "qwen2.5:7b"
}
```

**リクエストフィールド:**
- `modelName` (string, 必須): 新しいモデル名

**リクエスト例:**
```bash
curl -X PUT \
  -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  -H "Content-Type: application/json" \
  -d '{"modelName":"qwen2.5:7b"}' \
  http://localhost:3000/api/chat/sessions/1/model
```

**レスポンス:**
```json
{
  "success": true,
  "sessionId": 1,
  "modelName": "qwen2.5:7b"
}
```

---

## チャット機能の使用例

### 1. 新規チャット開始

```bash
# メッセージ送信
curl -N -X POST \
  -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  -H "Content-Type: application/json" \
  -d '{"content":"Pythonでクイックソートを実装して"}' \
  http://localhost:3000/api/chat/messages

# ストリーミングレスポンス受信...
# 完了時に sessionId が返される
```

### 2. セッション継続

```bash
# 既存セッションでメッセージ送信
curl -N -X POST \
  -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":1,"content":"計算量を教えて"}' \
  http://localhost:3000/api/chat/messages
```

### 3. 別モデルでリトライ

```bash
# 前回の応答を破棄して別モデルで再実行
curl -N -X POST \
  -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":1,"modelName":"qwen2.5:7b"}' \
  http://localhost:3000/api/chat/retry
```

### 4. セッション管理

```bash
# セッション一覧
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/chat/sessions

# セッション詳細
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/chat/sessions/1

# 巻き戻し
curl -X DELETE \
  -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  -H "Content-Type: application/json" \
  -d '{"turnNumber":2}' \
  http://localhost:3000/api/chat/sessions/1/rewind
```

---

## SSE (Server-Sent Events) について

チャット関連のエンドポイント (`/api/chat/messages`, `/api/chat/retry`) は Server-Sent Events を使用してストリーミングレスポンスを返します。

### JavaScript での受信例

```javascript
const API_BASE = "http://localhost:3000";
const API_KEY = "sk_llamune_default_key_change_this";

async function sendMessage(content, sessionId = null) {
  const response = await fetch(`${API_BASE}/api/chat/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content, sessionId })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.content) {
          fullContent = data.content;
          console.log("Chunk:", data.content);
        }
      } else if (line.startsWith('event: done')) {
        console.log("Completed!");
      }
    }
  }

  return fullContent;
}

// 使用例
sendMessage("Pythonでクイックソートを実装して")
  .then(response => console.log("Final:", response));
```

### Python での受信例

```python
import requests
import json

API_BASE = "http://localhost:3000"
API_KEY = "sk_llamune_default_key_change_this"

def send_message(content, session_id=None):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {"content": content}
    if session_id:
        payload["sessionId"] = session_id

    response = requests.post(
        f"{API_BASE}/api/chat/messages",
        headers=headers,
        json=payload,
        stream=True
    )

    full_content = ""
    for line in response.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith('data: '):
                data = json.loads(line[6:])
                if 'content' in data:
                    full_content = data['content']
                    print(f"Chunk: {data['content']}")
            elif line.startswith('event: done'):
                print("Completed!")

    return full_content

# 使用例
response = send_message("Pythonでクイックソートを実装して")
print(f"Final: {response}")
```

---
