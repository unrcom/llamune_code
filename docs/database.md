# データベース管理ガイド

Llamuneは会話履歴と推奨モデル情報をSQLite3データベースで管理しています。

## データベースファイルの場所

```
~/.llamune/history.db
```

## 接続方法

### sqlite3コマンドラインで接続

```bash
sqlite3 ~/.llamune/history.db
```

### 終了方法

```sql
.quit
```

または

```sql
.exit
```

## 基本的なコマンド

### テーブル一覧を表示

```sql
.tables
```

**出力例:**
```
messages            recommended_models  sessions
```

### テーブル定義を表示

```sql
-- すべてのテーブル定義を表示
.schema

-- 特定のテーブルのみ表示
.schema recommended_models
.schema sessions
.schema messages
```

### 見やすく設定

```sql
-- カラム形式で表示
.mode column

-- ヘッダーを表示
.headers on
```

### ヘルプを表示

```sql
.help
```

## データベーススキーマ

### 1. sessions テーブル

会話セッション情報を保存

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 2. messages テーブル

各セッションのメッセージを保存

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role TEXT NOT NULL,           -- 'user' または 'assistant'
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### 3. recommended_models テーブル

推奨モデル情報を保存

```sql
CREATE TABLE recommended_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  min_memory_gb INTEGER NOT NULL,
  max_memory_gb INTEGER,        -- NULLの場合は無制限
  model_name TEXT NOT NULL,
  model_size TEXT NOT NULL,
  description TEXT NOT NULL,
  priority INTEGER NOT NULL,    -- 1が最優先
  created_at TEXT NOT NULL
);
```

## よく使うクエリ

### 推奨モデルを確認

```sql
-- 見やすく設定
.mode column
.headers on

-- すべての推奨モデルを表示
SELECT
  id,
  min_memory_gb,
  max_memory_gb,
  model_name,
  model_size,
  description,
  priority
FROM recommended_models
ORDER BY min_memory_gb, priority;
```

### 会話セッション一覧を確認

```sql
SELECT
  id,
  model,
  created_at,
  updated_at
FROM sessions
ORDER BY updated_at DESC
LIMIT 10;
```

### 特定セッションのメッセージを確認

```sql
-- セッションID 1 のメッセージを表示
SELECT
  role,
  content,
  created_at
FROM messages
WHERE session_id = 1
ORDER BY id;
```

## データの更新

### 推奨モデルのメモリ範囲を変更

```sql
-- ID 3, 4 の max_memory_gb を 31 に変更
UPDATE recommended_models
SET max_memory_gb = 31
WHERE id IN (3, 4);

-- ID 5, 6, 7 の min_memory_gb を 32 に変更
UPDATE recommended_models
SET min_memory_gb = 32
WHERE id IN (5, 6, 7);

-- 変更を確認
SELECT id, min_memory_gb, max_memory_gb, model_name
FROM recommended_models
ORDER BY min_memory_gb, priority;
```

### 推奨モデルを追加

```sql
INSERT INTO recommended_models (
  min_memory_gb,
  max_memory_gb,
  model_name,
  model_size,
  description,
  priority,
  created_at
) VALUES (
  9,                                    -- 最小メモリ
  31,                                   -- 最大メモリ
  'llama3.1:8b',                       -- モデル名
  '4.7 GB',                            -- モデルサイズ
  '高速で汎用性が高い',                 -- 説明
  3,                                    -- 優先度
  datetime('now')                       -- 作成日時
);
```

### 推奨モデルを削除

```sql
-- ID 7 のモデルを削除
DELETE FROM recommended_models WHERE id = 7;
```

## npmスクリプトでの確認

### データベース内容を確認

```bash
npm run check-db
```

**出力例:**
```
📂 Database: /root/.llamune/history.db

🎯 推奨モデルテーブル:

ID: 1
  メモリ範囲: 0GB - 8GB
  モデル: gemma2:2b (1.6 GB)
  説明: 軽量で高速。低スペックPCに最適
  優先度: 1

...

💬 会話セッション: 0 件
📝 メッセージ: 0 件
```

### 推奨モデルのメモリ範囲を更新

```bash
npm run update-models
```

## 現在のメモリ範囲設定

| メモリ範囲 | 推奨モデル |
|----------|----------|
| 0-8GB | gemma2:2b, qwen2.5:3b |
| 9-31GB | gemma2:9b, qwen2.5:7b |
| 32GB以上 | gemma2:27b, qwen2.5:14b, deepseek-r1:7b |

## トラブルシューティング

### データベースが壊れた場合

1. バックアップがあれば復元
2. なければデータベースファイルを削除して再初期化

```bash
# データベースを削除（注意: 会話履歴も消えます）
rm ~/.llamune/history.db

# llamuneコマンドを実行すると自動的に再作成されます
llmn recommend
```

### sqlite3がインストールされていない場合

```bash
# Ubuntu/Debian
sudo apt install sqlite3

# macOS (Homebrew)
brew install sqlite3

# Fedora/RHEL
sudo dnf install sqlite

# または npm スクリプトを使用
npm run check-db
```

## セキュリティとバックアップ

### バックアップ

```bash
# データベースをバックアップ
cp ~/.llamune/history.db ~/.llamune/history.db.backup

# または日付付きバックアップ
cp ~/.llamune/history.db ~/.llamune/history.db.$(date +%Y%m%d)
```

### リストア

```bash
# バックアップから復元
cp ~/.llamune/history.db.backup ~/.llamune/history.db
```

## 参考リンク

- [SQLite公式ドキュメント](https://www.sqlite.org/docs.html)
- [SQLite CLI ドキュメント](https://www.sqlite.org/cli.html)
- [better-sqlite3 (Node.js ライブラリ)](https://github.com/WiseLibs/better-sqlite3)
