# データベースマイグレーション手順

llamune_codeプロジェクトのデータベースセットアップとマイグレーション手順

---

## 概要

llamune_codeは、llamuneからフォークした独自のコーディング支援ツールです。

### 重要な変更点

- **データベースパス**: `~/.llamune/` → `~/.llamune_code/`
- **設定ファイル**: `~/.llamune/` → `~/.llamune_code/`
- **完全分離**: llamuneとllamune_codeは独立して動作

---

## 前提条件

- Node.js v22.21.1
- npm (Node.jsに含まれる)

---

## データベース構造

```
~/.llamune_code/
└── history.db          SQLiteデータベース
```

### テーブル一覧

| テーブル名 | 用途 | 作成マイグレーション |
|-----------|------|-------------------|
| sessions | チャットセッション管理 | init-base-db.ts |
| messages | メッセージ履歴 | init-base-db.ts |
| recommended_models | 推奨モデル情報 | init-base-db.ts |
| parameter_presets | パラメータプリセット | migrate-add-parameter-presets.ts |
| users | ユーザー認証 | migrate-add-auth.ts |
| refresh_tokens | トークン管理 | migrate-add-auth.ts |
| domain_modes | ドメインモード | migrate-add-domain-modes.ts |
| domain_prompts | ドメイン別プロンプト | migrate-add-domain-modes.ts |

---

## マイグレーション手順

### ステップ1: 基本データベース作成

```bash
npx tsx scripts/init-base-db.ts
```

**作成されるテーブル:**
- sessions
- messages
- recommended_models

**確認:**
```bash
sqlite3 ~/.llamune_code/history.db ".tables"
```

### ステップ2: パラメータプリセット追加

```bash
npx tsx scripts/migrate-add-parameter-presets.ts
```

**作成されるテーブル:**
- parameter_presets

**登録されるプリセット:**
- デフォルト (default): すべてnull（LLMのデフォルト値を使用）
- 高感度 (creative): temp=1.0, top_p=0.95
- 事務的 (precise): temp=0.3, top_p=0.8

**確認:**
```bash
sqlite3 ~/.llamune_code/history.db "SELECT * FROM parameter_presets;"
```

### ステップ3: セッションタイトル機能追加

```bash
npx tsx scripts/migrate-add-session-title.ts
```

**変更内容:**
- sessionsテーブルに `title` カラムを追加

### ステップ4: 認証機能追加

```bash
npx tsx scripts/migrate-add-auth.ts
```

**作成されるテーブル:**
- users
- refresh_tokens

**追加されるカラム:**
- sessions.user_id

**デフォルトユーザー:**
- Username: `admin`
- Password: `admin`
- Role: `admin`

⚠️ **セキュリティ警告**: ログイン後すぐにパスワードを変更してください。

**確認:**
```bash
sqlite3 ~/.llamune_code/history.db "SELECT id, username, role FROM users;"
```

### ステップ5: ドメインモード機能追加

```bash
npx tsx scripts/migrate-add-domain-modes.ts
```

**前提条件:**
- parameter_presets テーブルが存在すること（ステップ2）

**作成されるテーブル:**
- domain_modes
- domain_prompts

**追加されるカラム:**
- sessions.domain_mode_id
- sessions.domain_prompt_id

**登録されるドメイン:**
- 汎用 (general)
  - チャット (chat) [デフォルト]

**確認:**
```bash
sqlite3 ~/.llamune_code/history.db "SELECT * FROM domain_modes;"
sqlite3 ~/.llamune_code/history.db "SELECT * FROM domain_prompts;"
```

### ステップ6: 専門ドメイン追加

```bash
npx tsx scripts/migrate-replace-domains.ts
```

**前提条件:**
- domain_modes テーブルに「汎用」ドメイン（ID: 1）が存在すること

**実行内容:**
- 汎用ドメインを削除
- 5つの専門ドメインに置き換え

**登録されるドメイン:**
- 💰 会計・財務 (accounting)
- ⚖️ 法律 (legal)
- 🏥 医療・健康 (healthcare)
- 📊 マーケティング (marketing)
- 🔧 エンジニアリング (engineering)

**確認:**
```bash
sqlite3 ~/.llamune_code/history.db "SELECT id, display_name FROM domain_modes;"
```

### ステップ7: アプリケーション開発ドメイン追加

```bash
npx tsx scripts/migrate-add-app-dev-domain.ts
```

**登録されるドメイン:**
- 💻 アプリケーション開発 (app-development)
  - コード生成 (code-generation) [デフォルト]
  - コードレビュー (code-review)
  - リファクタリング (refactoring)
  - バグ修正 (bug-fixing)
  - アーキテクチャ設計 (architecture-design)

**最終確認:**
```bash
sqlite3 ~/.llamune_code/history.db "SELECT dm.display_name, dp.display_name FROM domain_prompts dp JOIN domain_modes dm ON dp.domain_mode_id = dm.id;"
```

---

## 完全なマイグレーション実行（初回セットアップ）

新規環境でのセットアップ手順：

```bash
# 1. 基本データベース作成
npx tsx scripts/init-base-db.ts

# 2. パラメータプリセット追加
npx tsx scripts/migrate-add-parameter-presets.ts

# 3. セッションタイトル機能追加
npx tsx scripts/migrate-add-session-title.ts

# 4. 認証機能追加
npx tsx scripts/migrate-add-auth.ts

# 5. ドメインモード機能追加（汎用ドメイン）
npx tsx scripts/migrate-add-domain-modes.ts

# 6. 専門ドメイン追加（汎用を置き換え）
npx tsx scripts/migrate-replace-domains.ts

# 7. アプリケーション開発ドメイン追加
npx tsx scripts/migrate-add-app-dev-domain.ts

# 8. 最終確認
sqlite3 ~/.llamune_code/history.db ".tables"
sqlite3 ~/.llamune_code/history.db "SELECT id, name, display_name FROM domain_modes;"
```

**期待される出力（テーブル）:**
```
domain_modes        messages            recommended_models  sessions
domain_prompts      parameter_presets   refresh_tokens      users
```

**期待される出力（ドメイン）:**
```
1|accounting|会計・財務
2|legal|法律
3|healthcare|医療・健康
4|marketing|マーケティング
5|engineering|エンジニアリング
6|app-development|アプリケーション開発
```

---

## トラブルシューティング

### エラー: "no such table: parameter_presets"

**原因:**
マイグレーションの実行順序が間違っています。

**解決方法:**
```bash
# parameter_presetsを先に作成
npx tsx scripts/migrate-add-parameter-presets.ts

# その後、domain_modesを作成
npx tsx scripts/migrate-add-domain-modes.ts
```

### エラー: "SQLITE_ERROR: table xxx already exists"

**原因:**
マイグレーションが既に実行済みです。

**解決方法:**
スクリプトは冪等性を持つように設計されているため、通常はスキップされます。
エラーが出る場合は、スクリプト内のチェック処理を確認してください。

### データベースをリセットしたい

```bash
# データベースファイルを削除
rm ~/.llamune_code/history.db

# 最初からマイグレーションを実行
npx tsx scripts/init-base-db.ts
# ... 以降のマイグレーションを順番に実行
```

⚠️ **警告**: すべてのデータが削除されます。

---

## マイグレーションの依存関係

```
init-base-db.ts
    ↓
migrate-add-parameter-presets.ts
    ↓
migrate-add-session-title.ts
    ↓
migrate-add-auth.ts
    ↓
migrate-add-domain-modes.ts  (← parameter_presetsに依存)
    ↓
migrate-replace-domains.ts   (← domain_modesに依存、汎用ドメインを削除)
    ↓
migrate-add-app-dev-domain.ts
```

**重要**: この順序を守って実行してください。

**特に注意:**
- `migrate-replace-domains.ts` は汎用ドメイン（ID: 1）を削除します
- `migrate-add-domain-modes.ts` の後に必ず実行してください

---

## データベース確認コマンド

### テーブル一覧
```bash
sqlite3 ~/.llamune_code/history.db ".tables"
```

### テーブル構造確認
```bash
sqlite3 ~/.llamune_code/history.db ".schema users"
```

### データ確認
```bash
# ユーザー一覧
sqlite3 ~/.llamune_code/history.db "SELECT * FROM users;"

# ドメインモード一覧
sqlite3 ~/.llamune_code/history.db "SELECT * FROM domain_modes;"

# プリセット一覧
sqlite3 ~/.llamune_code/history.db "SELECT * FROM parameter_presets;"
```

### SQLiteコンソール
```bash
sqlite3 ~/.llamune_code/history.db
```

**便利なコマンド:**
```sql
-- テーブル一覧
.tables

-- スキーマ表示
.schema

-- ヘッダー付きで表示
.headers on

-- カラムモードで表示
.mode column

-- 終了
.quit
```

---

## 次のステップ

マイグレーション完了後：

1. **APIサーバー起動**
   ```bash
   npm run api
   ```

2. **動作確認**
   ```bash
   ./scripts/test-bug-fix.sh
   ```

3. **Web UI起動**
   ```bash
   cd web
   npm install
   npm run dev
   ```

---

## 参考情報

### 設定ファイルの場所

- データベース: `~/.llamune_code/history.db`
- 設定ファイル: `~/.llamune_code/config.json`

### ソースコード

- データベースユーティリティ: `src/utils/database.ts`
- マイグレーションスクリプト: `scripts/migrate-*.ts`

---

**最終更新**: 2025-11-29
**バージョン**: 1.0.0
**プロジェクト**: llamune_code
