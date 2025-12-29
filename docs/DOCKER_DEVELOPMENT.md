# Docker環境での開発ガイド

このドキュメントでは、Docker環境でLlamune Codeを開発する方法を説明します。

## 🎯 概要

Docker環境では、ソースコードの変更が自動的にコンテナに反映されるホットリロード機能を使用できます。ただし、変更の種類によっては再ビルドや再起動が必要です。

---

## 🔄 変更の種類と反映方法

### ケース1: ソースコードの変更 ✨ 自動反映

**対象ファイル:**
- `src/**/*.ts` - バックエンドのTypeScriptファイル
- `web/src/**/*` - フロントエンドのReact/TypeScript/CSSファイル

**反映方法:**
```bash
# 何もしなくてOK！
# ファイルを保存するだけで自動的にホットリロード
```

**仕組み:**
docker-compose.ymlでソースコードがマウントされています：
```yaml
backend:
  volumes:
    - ./src:/app/src

frontend:
  volumes:
    - ./web/src:/app/src
```

**確認方法:**
```bash
# ターミナルでログを確認
# バックエンド: 自動的に再起動
# フロントエンド: "hmr update" が表示される
```

---

### ケース2: 依存関係の変更 🔨 再ビルド必要

**対象ファイル:**
- `package.json` - バックエンドの依存関係
- `package-lock.json` - バックエンドのロックファイル
- `web/package.json` - フロントエンドの依存関係
- `web/package-lock.json` - フロントエンドのロックファイル

**反映方法:**
```bash
# コンテナを停止
docker compose down

# 再ビルドして起動
docker compose up --build
```

**理由:** 
`npm install` はDockerイメージのビルド時に実行されるため、再ビルドが必要です。

---

### ケース3: Dockerfile/設定の変更 🔨 再ビルド必要

**対象ファイル:**
- `Dockerfile.backend`
- `Dockerfile.ollama`
- `web/Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

**反映方法:**
```bash
docker compose down
docker compose up --build
```

**特定のサービスだけ再ビルド:**
```bash
# バックエンドのみ
docker compose build backend
docker compose up

# フロントエンドのみ
docker compose build frontend
docker compose up
```

---

### ケース4: 環境変数の変更 🔄 再起動のみ

**対象ファイル:**
- `.env`

**反映方法（サービス再起動）:**
```bash
# 特定のサービスを再起動
docker compose restart backend

# または全体を再起動
docker compose down
docker compose up
```

**注意:**
- `.env`ファイルはコンテナ内で自動生成されます
- ホスト側の`.env`を変更しても、コンテナには自動反映されません
- コンテナ内の`.env`を変更する場合は、コンテナ内で編集してください

**コンテナ内の.envを編集:**
```bash
docker exec -it llamune_backend nano /app/.env
docker compose restart backend
```

---

### ケース5: データベーススキーマの変更 📊 マイグレーション必要

**対象ファイル:**
- `migrations/*.ts` - 新しいマイグレーションファイル
- `knexfile.ts` - データベース設定

**反映方法:**
```bash
# 方法1: コンテナ内でマイグレーション実行
docker exec -it llamune_backend npm run migrate:latest

# 方法2: バックエンドを再起動（entrypointで自動実行）
docker compose restart backend

# 方法3: 完全に再起動
docker compose down
docker compose up
```

**マイグレーションの確認:**
```bash
# 現在のマイグレーション状態を確認
docker exec -it llamune_backend npm run migrate:status
```

**マイグレーションのロールバック:**
```bash
# 最後のマイグレーションを取り消し
docker exec -it llamune_backend npm run migrate:rollback
```

---

### ケース6: スクリプトファイルの変更 ✨ 再実行のみ

**対象ファイル:**
- `scripts/*.js` - セットアップスクリプトなど
- `docker-entrypoint.sh` - 起動スクリプト

**反映方法:**
```bash
# スクリプトの場合: 再実行
docker exec -it llamune_backend node scripts/your-script.js

# entrypoint.shの場合: 再ビルド必要
docker compose down
docker compose up --build
```

---

## 🛠️ よくある開発タスク

### 新しいnpmパッケージを追加

```bash
# 1. package.jsonに追加（ホスト側で編集）
# または
npm install <package-name>

# 2. Dockerに反映
docker compose down
docker compose up --build
```

### データベースをリセット

```bash
# 方法1: ボリュームを削除（データ完全消去）
docker compose down -v
docker compose up

# 方法2: マイグレーションをロールバックしてやり直し
docker exec -it llamune_backend npm run migrate:rollback
docker exec -it llamune_backend npm run migrate:latest
```

### ログの確認

```bash
# 全サービスのログをリアルタイム表示
docker compose logs -f

# 特定のサービスのみ
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f ollama

# 過去のログ（最新100行）
docker compose logs --tail=100 backend
```

### コンテナ内でコマンド実行

```bash
# バックエンドコンテナに入る
docker exec -it llamune_backend bash

# コンテナ内で
npm run test
npm run migrate:status
node scripts/generate-secrets.js
exit

# ワンライナーで実行
docker exec -it llamune_backend npm test
```

### データベースを直接操作

```bash
# SQLiteデータベースに接続
docker exec -it llamune_backend sqlite3 /root/.llamune_code/history.db

# SQLiteコマンド例
.tables                    # テーブル一覧
.schema sessions          # スキーマ確認
SELECT * FROM users;      # クエリ実行
.quit                     # 終了
```

### Ollamaモデルの管理

```bash
# Ollamaコンテナに入る
docker exec -it llamune_ollama bash

# モデルのダウンロード
ollama pull qwen2.5-coder:7b

# モデル一覧
ollama list

# モデルの削除
ollama rm <model-name>

# 終了
exit
```

---

## 🐛 デバッグ方法

### ブレークポイントを使ったデバッグ

**Node.js Inspector を有効にする:**

docker-compose.ymlを編集：
```yaml
backend:
  command: npm run api
  ports:
    - "3000:3000"
    - "9229:9229"  # デバッグポート追加
  environment:
    - NODE_OPTIONS=--inspect=0.0.0.0:9229
```

**VS Codeでデバッグ:**

`.vscode/launch.json` を作成：
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Docker: Attach to Node",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "address": "localhost",
      "restart": true,
      "sourceMaps": true,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app"
    }
  ]
}
```

### エラーログの詳細確認

```bash
# バックエンドの詳細ログ
docker compose logs backend | grep -A 10 "Error"

# api-debug.log を確認
docker exec -it llamune_backend tail -f /app/api-debug.log
```

### ネットワーク接続の確認

```bash
# コンテナ間の接続確認
docker exec -it llamune_backend ping ollama
docker exec -it llamune_backend curl http://ollama:11434/api/tags

# フロントエンドからバックエンドへの接続確認
docker exec -it llamune_frontend ping backend
```

---

## 🔧 トラブルシューティング

### 問題1: ホットリロードが動作しない

**症状:** ファイルを変更しても反映されない

**原因と解決策:**

1. **ファイルがマウントされていない**
   ```bash
   # マウント状態を確認
   docker inspect llamune_backend | grep -A 10 Mounts
   
   # volumes設定を確認
   cat docker-compose.yml | grep -A 5 volumes
   ```

2. **エディタの保存設定**
   - VS Code: `"files.watcherExclude"` を確認
   - エディタで「保存時に自動フォーマット」が原因の場合あり

3. **Dockerのファイル監視制限（macOS/Windows）**
   ```bash
   # Docker Desktop の設定を確認
   # Settings > Resources > File sharing
   # プロジェクトフォルダが共有されているか確認
   ```

---

### 問題2: node_modules関連のエラー

**症状:**
```
Error: Cannot find module 'express'
```

**解決策:**
```bash
# 依存関係を再インストール
docker compose down
docker compose build --no-cache backend
docker compose up
```

---

### 問題3: データベース接続エラー

**症状:**
```
Error: SQLITE_ERROR: no such table: sessions
```

**解決策:**
```bash
# マイグレーションを実行
docker exec -it llamune_backend npm run migrate:latest

# またはコンテナを再起動
docker compose restart backend
```

---

### 問題4: ポートが既に使用されている

**症状:**
```
Error: bind: address already in use
```

**解決策:**
```bash
# 使用中のプロセスを確認
lsof -i :3000  # バックエンド
lsof -i :5173  # フロントエンド
lsof -i :11434 # Ollama

# Dockerコンテナを完全停止
docker compose down

# 必要に応じてプロセスを強制終了
kill -9 <PID>

# 再起動
docker compose up
```

---

### 問題5: Ollamaに接続できない

**症状:**
```
Error: connect ECONNREFUSED 127.0.0.1:11434
```

**解決策:**
```bash
# Ollamaコンテナの状態確認
docker ps | grep ollama

# Ollamaのログ確認
docker compose logs ollama

# ヘルスチェック確認
docker exec -it llamune_ollama curl http://localhost:11434/api/tags

# 再起動
docker compose restart ollama
docker compose restart backend
```

---

## 🚀 開発フロー例

### 1. 新機能の開発

```bash
# 1. ブランチ作成
git checkout -b feature/new-chat-ui

# 2. Docker起動
docker compose up

# 3. コード編集（自動反映）
# web/src/components/Chat.tsx を編集
# 保存すると自動的にブラウザが更新される

# 4. 新しいパッケージが必要な場合
npm install react-icons
docker compose down
docker compose up --build

# 5. テスト
docker exec -it llamune_backend npm test

# 6. コミット
git add .
git commit -m "feat: Add new chat UI"
```

---

### 2. バグ修正

```bash
# 1. 現象を再現
docker compose up
# ブラウザで問題を確認

# 2. ログ確認
docker compose logs -f backend

# 3. コード修正（自動反映）
# src/api/routes/chat.ts を修正
# 保存すると自動的に反映

# 4. 再テスト
# ブラウザで修正を確認

# 5. コミット
git commit -am "fix: Fix chat streaming issue"
```

---

### 3. データベーススキーマ変更

```bash
# 1. マイグレーションファイル作成
npm run migrate:make add_user_preferences

# 2. マイグレーションファイルを編集
# migrations/xxx_add_user_preferences.ts

# 3. マイグレーション実行
docker exec -it llamune_backend npm run migrate:latest

# 4. コード修正（自動反映）
# src/models/user.ts を編集

# 5. テスト
docker exec -it llamune_backend npm test
```

---

## 📊 パフォーマンス最適化

### ビルド時間の短縮

**1. 不要なファイルを除外**

`.dockerignore` を確認：
```
node_modules
npm-debug.log
.git
.env
*.md
tests
```

**2. マルチステージビルドを検討**

本番環境用に最適化されたDockerfileを作成：
```dockerfile
# Dockerfile.backend.prod
FROM node:22.21.0-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:22.21.0-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
CMD ["npm", "start"]
```

**3. キャッシュを活用**

依存関係が変わっていない場合、`--build` を省略：
```bash
docker compose up  # キャッシュを使用
```

---

### ホットリロード最適化

**1. 監視対象を限定**

package.jsonのnodemonやVite設定を調整：
```json
{
  "scripts": {
    "api": "nodemon --watch src src/api/server.ts"
  }
}
```

**2. ファイルシステムの最適化（macOS/Windows）**

Docker Desktop設定：
- VirtioFS を有効化（Settings > General > VirtioFS）
- メモリとCPU割り当てを増やす

---

## 🔗 関連ドキュメント

- [README.md](../README.md) - プロジェクト概要
- [MANUAL_SETUP.md](./MANUAL_SETUP.md) - 手動セットアップ
- [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md) - データベース設計
- [API_SPECIFICATION.md](./API_SPECIFICATION.md) - API仕様

---

**最終更新**: 2025-12-29
