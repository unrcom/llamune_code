# Ollama パラメータのデフォルト値に関する発見

**日付:** 2025-11-18
**発見者:** mop
**コンテキスト:** Llamune プロジェクトでパラメータプリセット機能を実装中

---

## 概要

Llamune のパラメータプリセット機能で「デフォルト」という名前のプリセットを実装していたが、このプリセットが実際に何を指しているのか疑問が生じた。

**疑問:**
- 「デフォルト」は「何もパラメータを指定していない」という意味なのか？
- それとも「Claude（開発者）がデフォルトだと思っている値を明示的に指定している」のか？

---

## 調査方法

### 1. Llamune のプリセット実装を確認

`scripts/migrate-add-parameter-presets.ts` でプリセットがどう定義されているか確認：

```typescript
{
  name: 'default',
  display_name: 'デフォルト',
  description: 'バランスの取れた標準設定',
  temperature: 0.7,      // ← 明示的に指定
  top_p: 0.9,            // ← 明示的に指定
  top_k: 40,             // ← 明示的に指定
  repeat_penalty: 1.1,   // ← 明示的に指定
  num_ctx: 2048,         // ← 明示的に指定
}
```

→ **明示的に値を指定していることが判明**

### 2. Ollama API でモデルの Modelfile を確認

実際のモデル（gemma2:27b）が Ollama にどのようなデフォルト値を持っているか確認するため、`ollama show` API を使用：

```bash
curl http://localhost:11434/api/show -d '{"name": "gemma2:27b"}'
```

**結果（Modelfile 部分）:**

```
FROM /Users/m/.ollama/models/blobs/sha256-d7e4b00a7d7a8d03d4eed9b0f3f61a427e9f0fc5dea6aeb414e41dee23dc8ecc
TEMPLATE "<start_of_turn>user
{{ if .System }}{{ .System }} {{ end }}{{ .Prompt }}<end_of_turn>
<start_of_turn>model
{{ .Response }}<end_of_turn>
"
PARAMETER stop "<start_of_turn>"
PARAMETER stop "<end_of_turn>"
LICENSE """..."""
```

**重要な発見:**
- **temperature, top_p, top_k, repeat_penalty などのパラメータは一切指定されていない**
- stop トークンのみが指定されている

---

## 結論

### 発見内容

1. **gemma2:27b モデル自体には、パラメータのデフォルト値が設定されていない**
   - Modelfile には `PARAMETER temperature` などの記述がない
   - モデル固有のデフォルト値は存在しない

2. **Ollama がシステムレベルでデフォルト値を持っている**
   - パラメータを指定しない場合、Ollama の内部デフォルト値が使用される
   - 通常、Ollama のデフォルトは以下のような値:
     - temperature: 0.8
     - top_p: 0.9
     - top_k: 40
     - repeat_penalty: 1.1

3. **Llamune の「デフォルト」プリセットは、実際には Ollama のデフォルトを上書きしている**
   - `temperature: 0.7` を明示的に送信
   - これは Ollama のデフォルト（0.8）とは異なる
   - つまり、「パラメータ未指定」ではなく「開発者が適切だと考える値」を送っている

### 理解の修正

**以前の理解（誤り）:**
- 「デフォルト」プリセット = パラメータを何も指定しない = モデル本来の動作

**正しい理解:**
- 「デフォルト」プリセット = Llamune 開発者が選んだバランスの良い値
- モデル本来の Modelfile には、パラメータ指定がない
- Ollama がシステムレベルでデフォルト値を適用している

---

## 実装への影響

### 1. プリセット名の再考

現在の「デフォルト」という名前は誤解を招く可能性がある：

| プリセット名 | 現状の意味                       | 改善案                       |
| ------------ | -------------------------------- | ---------------------------- |
| デフォルト   | temperature=0.7 を明示的に指定  | 「バランス」「標準」など     |
| （なし）     | 存在しない                       | 「システムデフォルト」を追加 |

### 2. 「システムデフォルト」プリセットの追加検討

本当にパラメータを指定しない（Ollama のデフォルトを使う）プリセットを追加するか検討が必要：

```typescript
{
  name: 'system_default',
  display_name: 'システムデフォルト',
  description: 'Ollamaのデフォルト値を使用（パラメータ未指定）',
  temperature: null,      // ← null で送信しない
  top_p: null,
  top_k: null,
  repeat_penalty: null,
  num_ctx: null,
}
```

### 3. ドキュメントの更新

ユーザーに正確な情報を伝えるため、以下を明記する必要がある：
- 「デフォルト」プリセットは開発者が選んだ推奨値
- モデル自体にはパラメータのデフォルト値は設定されていない
- Ollama がシステムレベルでデフォルト値を適用している

---

## 技術的詳細

### Ollama API の動作

**パラメータ指定あり:**
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "gemma2:27b",
  "prompt": "こんにちは",
  "options": {
    "temperature": 0.7
  }
}'
```
→ Ollama は temperature=0.7 を使用

**パラメータ指定なし:**
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "gemma2:27b",
  "prompt": "こんにちは"
}'
```
→ Ollama は内部デフォルト値（temperature=0.8 など）を使用

### Modelfile でのパラメータ指定

もしモデル作成者が Modelfile でパラメータを指定していれば：

```
FROM gemma2:27b
PARAMETER temperature 0.5
PARAMETER top_p 0.9
```

この場合、そのモデル固有のデフォルト値が適用される。しかし、公式の gemma2:27b にはこれが**ない**。

---

## 参考情報

### 確認したファイル
- `scripts/migrate-add-parameter-presets.ts` (L60-70)
- Ollama API: `/api/show` エンドポイント

### 関連ドキュメント
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Ollama Modelfile Specification](https://github.com/ollama/ollama/blob/main/docs/modelfile.md)
- [LLM パラメータテストガイド](./llm-parameters-testing-guide.md)

---

## 今後の課題

1. **プリセット名の変更を検討**
   - 「デフォルト」→「バランス」「標準」など
   - ユーザーの誤解を防ぐ

2. **「システムデフォルト」プリセットの追加を検討**
   - パラメータを一切送らないオプション
   - Ollama のデフォルト動作を体験できる

3. **ドキュメントの更新**
   - API 仕様書に詳細を追記
   - ユーザーガイドで説明

4. **他のモデルも調査**
   - qwen2.5:14b, phi3.5 なども同様か確認
   - カスタム Modelfile を持つモデルの動作確認

---

**最終更新:** 2025-11-18
**プロジェクト:** Llamune
**関連 Issue:** （今後作成予定）
