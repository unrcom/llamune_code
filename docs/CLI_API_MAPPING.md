# CLI と API の対応表

## 概要

Llamune は CLI と API の両方で同じ機能を提供します。
CLI はインタラクティブな操作に最適化され、API は GUI やプログラムからの利用に最適化されています。

---

## コマンド対応表

### 0. メタ情報

| CLI コマンド | API エンドポイント | 説明 | 実装状況 |
|------------|------------------|------|---------|
| `llamune` | `GET /api` | プラットフォーム情報とコマンド一覧 | ✅ 両方実装済み |

### 1. モデル管理

| CLI コマンド | API エンドポイント | 説明 | 実装状況 |
|------------|------------------|------|---------|
| `llamune ls` | `GET /api/models` | モデル一覧表示 | ✅ 両方実装済み |
| `llamune pull <model>` | `POST /api/models/pull` | モデルダウンロード | ✅ 両方実装済み |
| `llamune rm <model>` | `DELETE /api/models` | モデル削除 | ✅ 両方実装済み |
| `llamune recommend` | `GET /api/models/recommended` | 推奨モデル表示 | ✅ 両方実装済み |

### 2. チャット機能

| CLI コマンド | API エンドポイント | 説明 | 実装状況 |
|------------|------------------|------|---------|
| `llamune chat` | `POST /api/chat/messages` | 新規チャット開始 | ✅ 両方実装済み |
| `llamune chat --continue <id>` | `POST /api/chat/messages` (with sessionId) | 会話継続 | ✅ 両方実装済み |
| `llamune chat -m <model>` | `POST /api/chat/messages` (with modelName) | モデル指定でチャット | ✅ 両方実装済み |

#### チャット中のコマンド

| CLI コマンド | API エンドポイント | 説明 | 実装状況 |
|------------|------------------|------|---------|
| `/retry` | `POST /api/chat/retry` | 別モデル/プリセットで再実行 | ✅ 両方実装済み |
| `/switch <model>` | `PUT /api/chat/sessions/:id/model` | モデル切り替え | ✅ 両方実装済み |
| `/rewind <番号>` | `DELETE /api/chat/sessions/:id/rewind` | 会話の巻き戻し | ✅ 両方実装済み |
| `/history` | `GET /api/chat/sessions/:id` | 現在の会話履歴表示 | ✅ 両方実装済み |
| `/models` | `GET /api/models` | 利用可能なモデル一覧 | ✅ 両方実装済み |
| `/current` | - | 現在のモデル表示 | ✅ CLI のみ |

### 3. 履歴管理

| CLI コマンド | API エンドポイント | 説明 | 実装状況 |
|------------|------------------|------|---------|
| `llamune history` | `GET /api/chat/sessions` | セッション一覧表示 | ✅ 両方実装済み |
| `llamune history -n <数>` | `GET /api/chat/sessions?limit=<数>` | 履歴数指定表示 | ⚠️ CLI のみ（API は全件取得） |

### 4. システム情報

| CLI コマンド | API エンドポイント | 説明 | 実装状況 |
|------------|------------------|------|---------|
| （なし） | `GET /api/system/spec` | システムスペック取得 | ✅ API のみ |
| （なし） | `GET /api/system/health` | Ollama ステータス確認 | ✅ API のみ |
| （なし） | `GET /api/presets` | プリセット一覧 | ✅ API のみ |

### 5. 比較機能

| CLI コマンド | API エンドポイント | 説明 | 実装状況 |
|------------|------------------|------|---------|
| `llamune compare <query>` | （未実装） | 複数 LLM で比較実行 | ❌ 両方未実装（CLI は開発中） |

---

## 詳細な対応関係

### モデル一覧表示

**CLI:**
```bash
llamune ls
```

**API:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/models
```

**レスポンス:**
```json
{
  "models": [
    {"name": "gemma2:9b", "size": 5816076993, "modified_at": "..."}
  ]
}
```

---

### モデルダウンロード

**CLI:**
```bash
llamune pull gemma2:9b
```

**API:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"modelName":"gemma2:9b"}' \
  http://localhost:3000/api/models/pull
```

---

### チャット開始

**CLI:**
```bash
llamune chat
# インタラクティブにモデルを選択
# You: こんにちは
```

**API:**
```bash
curl -N -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"こんにちは","modelName":"gemma2:9b"}' \
  http://localhost:3000/api/chat/messages
```

**ストリーミングレスポンス:**
```
data: {"content":"こん"}
data: {"content":"こんにちは"}
event: done
data: {"sessionId":1,"fullContent":"こんにちは！...","model":"gemma2:9b"}
```

---

### 会話継続

**CLI:**
```bash
llamune chat --continue 1
# You: 続きを話そう
```

**API:**
```bash
curl -N -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":1,"content":"続きを話そう"}' \
  http://localhost:3000/api/chat/messages
```

---

### リトライ（別モデルで再実行）

**CLI:**
```
llamune chat
You: Pythonのコード書いて
AI (gemma2:9b): ...
You: /retry
# モデルとプリセットを選択
# 1. gemma2:9b (デフォルト)
# 2. gemma2:9b (高感度)
# 3. qwen2.5:7b (デフォルト)
# ...
```

**API:**
```bash
curl -N -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":1,"modelName":"qwen2.5:7b","presetId":2}' \
  http://localhost:3000/api/chat/retry
```

---

### 会話履歴表示

**CLI:**
```bash
llamune history
```

**API:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
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
      "preview": "Pythonでクイックソート..."
    }
  ]
}
```

---

### セッション詳細表示

**CLI:**
```
llamune chat
You: /history
# 現在のセッションの履歴を表示
```

**API:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/chat/sessions/1
```

**レスポンス:**
```json
{
  "session": {"id": 1, "model": "gemma2:9b", ...},
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "...", "model": "gemma2:9b"}
  ]
}
```

---

### 巻き戻し

**CLI:**
```
llamune chat
You: /rewind 2
# 会話 #2 まで巻き戻す確認
yes/no?
You: yes
```

**API:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"turnNumber":2}' \
  http://localhost:3000/api/chat/sessions/1/rewind
```

---

### モデル切り替え

**CLI:**
```
llamune chat
You: /switch qwen2.5:7b
# 次の質問から qwen2.5:7b を使用
```

**API:**
```bash
curl -X PUT \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"modelName":"qwen2.5:7b"}' \
  http://localhost:3000/api/chat/sessions/1/model
```

---

## 実装状況サマリー

### ✅ 完全実装（CLI & API 両方）

- モデル一覧表示
- モデルダウンロード
- モデル削除
- 推奨モデル表示
- チャット開始
- 会話継続
- リトライ（別モデルで再実行）
- モデル切り替え
- 会話の巻き戻し
- 履歴表示

### ⚠️ 部分的実装

- 履歴数制限（CLI のみ実装、API は未対応）

### ❌ 未実装

- 複数 LLM 比較機能（`llamune compare`）

---

## テスト手順

### 1. 並行実行テスト

**ターミナル1（CLI）:**
```bash
llamune chat
You: こんにちは
```

**ターミナル2（API サーバー）:**
```bash
npm run api
# サーバーが起動
```

**ターミナル3（API テスト）:**
```bash
# セッション一覧を確認
curl -H "Authorization: Bearer YOUR_KEY" \
  http://localhost:3000/api/chat/sessions

# CLI で作成したセッションが表示される
```

### 2. 同じ操作の確認

**操作: モデル一覧表示**

CLI:
```bash
llamune ls
```

API:
```bash
curl -H "Authorization: Bearer YOUR_KEY" \
  http://localhost:3000/api/models | jq .
```

両方で同じモデルリストが表示されることを確認。

### 3. セッション継続テスト

**Step 1: CLI でチャット開始**
```bash
llamune chat
You: こんにちは
AI: こんにちは！...
You: exit
# セッションID: 1 が表示される
```

**Step 2: API で会話を継続**
```bash
curl -N -X POST \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":1,"content":"続きを話そう"}' \
  http://localhost:3000/api/chat/messages
```

**Step 3: CLI で履歴確認**
```bash
llamune history
# セッションID: 1 に新しいメッセージが追加されている
```

---

## まとめ

- **CLI**: 対話的な操作に最適（開発者、運用者向け）
- **API**: プログラマブルなアクセス、GUI 統合に最適

両方で同じデータベースを共有しているため、CLI で作成したセッションを API で継続したり、その逆も可能です。
