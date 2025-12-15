# システムプロンプト設定ガイド

Llamune Code では、2種類のシステムプロンプトを使用します：

- **デフォルトプロンプト**: 推論モードで使用される汎用プロンプト
- **ドメインプロンプト**: ドメイン特化モードで使用される専用プロンプト

## デフォルトプロンプト

### 現在の設定（初期値）

```
**必ず日本語で応答してください。**

あなたは親切なAIアシスタントです。ユーザーの質問に丁寧に答えてください。
```

### データベースでの管理

デフォルトプロンプトは **SQLite データベース（`llamune.db`）の `default_prompt` テーブル** で管理されています。

**テーブル構造**:
- `id`: プライマリキー（常に 1）
- `system_prompt`: デフォルトプロンプトの内容
- `description`: プロンプトの説明（任意）
- `updated_at`: 最終更新日時

### 確認方法

```bash
# データベースで確認
sqlite3 ~/.llamune_code/history.db "SELECT * FROM default_prompt;"

# または check-db スクリプトで確認
npm run check-db
```

### 変更方法

**方法1: SQLite で直接更新**

```bash
sqlite3 ~/.llamune_code/history.db
```

```sql
-- デフォルトプロンプトを更新
UPDATE default_prompt 
SET system_prompt = 'あなたの新しいプロンプト内容...',
    description = 'プロンプトの説明（任意）',
    updated_at = datetime('now')
WHERE id = 1;
```

**方法2: スクリプトで更新（将来実装予定）**

```bash
npm run update-default-prompt
```

### 変更の反映

- **即座に反映**: 新しいチャットセッションから自動的に反映されます
- **既存セッション**: 影響を受けません（セッション作成時のプロンプトが保持されます）
- **再起動不要**: データベースを更新するだけで、アプリの再起動は不要です

### フォールバック

DBからの取得に失敗した場合、以下のハードコードされたフォールバックプロンプトが使用されます：

```
**必ず日本語で応答してください。**

あなたは親切なAIアシスタントです。ユーザーの質問に丁寧に答えてください。
```

**注意**: フォールバックはエラー時のみ使用されます。通常はDBのプロンプトが使用されます。

## ドメインプロンプト

### データベースでの管理

ドメインプロンプトは SQLite データベース（`llamune.db`）で管理されています。

**テーブル構造**:
- `domain_modes`: ドメインの定義（app-development, accounting など）
- `domain_prompts`: 各ドメイン用のシステムプロンプト

### 既存プロンプトの確認

```bash
# データベースを確認
npm run check-db

# または SQLite で直接確認
sqlite3 llamune.db "SELECT id, domain_mode_id, display_name, system_prompt FROM domain_prompts WHERE deleted_at IS NULL;"
```

### 新規追加方法

**方法1: スクリプトでドメインを追加**

```bash
npm run update-domains
```

`scripts/update-domain-prompts.ts` を編集してドメインとプロンプトを定義します。

**方法2: SQLite で直接追加**

```sql
-- 1. ドメインモードを追加
INSERT INTO domain_modes (name, display_name, description, icon, enabled)
VALUES ('my-domain', 'マイドメイン', 'カスタムドメインの説明', '🎯', 1);

-- 2. ドメインプロンプトを追加
INSERT INTO domain_prompts (
  domain_mode_id, 
  display_name, 
  description, 
  system_prompt,
  is_default
)
VALUES (
  (SELECT id FROM domain_modes WHERE name = 'my-domain'),
  'デフォルトプロンプト',
  'このドメイン用のプロンプト',
  'あなたは〇〇の専門家です。...',
  1
);
```

### 更新方法

```sql
-- プロンプトの内容を更新
UPDATE domain_prompts 
SET system_prompt = '新しいプロンプト内容...'
WHERE id = <プロンプトID>;
```

### 削除方法（論理削除）

```sql
-- プロンプトを無効化（論理削除）
UPDATE domain_prompts 
SET deleted_at = datetime('now')
WHERE id = <プロンプトID>;

-- ドメイン全体を無効化
UPDATE domain_modes 
SET enabled = 0 
WHERE id = <ドメインID>;
```

### ベストプラクティス

1. **プロンプトは明確に**: LLMの役割と期待する動作を具体的に記述
2. **日本語指示を含める**: `**必ず日本語で応答してください。**` を推奨
3. **バックアップ**: 変更前に `llamune.db` をバックアップ
4. **テスト**: 新しいプロンプトを追加したら、実際にチャットで動作確認

---

**関連ファイル**:
- `migrations/20251211000000_add_default_prompt.ts` - デフォルトプロンプトテーブルのマイグレーション
- `src/utils/database.ts` - デフォルトプロンプトの取得・更新関数
- `src/core/chat-session.ts` - デフォルトプロンプトの使用ロジック
- `src/api/routes/chat.ts` - ドメインプロンプトの取得ロジック
- `scripts/update-domain-prompts.ts` - ドメイン・プロンプトの一括登録
