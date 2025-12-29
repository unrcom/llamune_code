# Llamune Code - 手動セットアップガイド

このガイドでは、Dockerを使わずにLlamune Codeを手動でセットアップする方法を説明します。

**所要時間:** 初回 20-40分

## 📋 前提条件

### 必要な環境

**ハードウェア：**
- **メモリ**: 16GB RAM 以上推奨（32GB以上を強く推奨）
- **GPU**: Apple Silicon / NVIDIA / AMD（推奨、なくても動作可能）
- **ストレージ**: 20GB以上の空き容量

**ソフトウェア:**
- Node.js v22.21.0（厳密）- nvm推奨
- Ollama 最新版
- SQLite（better-sqlite3経由）
- **macOS**: Xcode Command Line Tools
- **Linux**: build-essential, Python 3.x

**動作検証環境:**
- ✅ macOS - Apple M1 (16GB RAM)
- ✅ macOS - Apple M4 (32GB RAM)
- ❌ Windows - サポート対象外

**⚠️ 重要**:
- Node.js v22.21.0が必須です。v24.1.0では動作しません。
- Windows環境はサポート対象外です（LLMが動作しません）。

---

## 🚀 セットアップ手順

### 1. 前提条件のインストール

#### Node.js v22.21.0 のセットアップ

```bash
# nvm (Node Version Manager) のインストール確認
nvm --version

# nvmがインストールされていない場合（command not foundの場合）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc  # ターミナルを再起動するか、このコマンドを実行

# Node.js v22.21.0 をインストール
nvm install 22.21.0

# v22.21.0 に切り替え
nvm use 22.21.0

# 確認
node --version  # v22.21.0 と表示されることを確認
```

**⚠️ 重要**: Node.js v22.21.0が必須です。v24.1.0では動作しません。

#### Ollama のインストールと起動

```bash
# Ollama のインストール確認
ollama --version  # バージョンが表示されればインストール済み

# インストールされていない場合（command not foundの場合）
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Ollama サービスの起動確認
ollama list

# もし "Error: could not connect to ollama app" が出た場合
# 別ターミナルで以下を実行してサービスを起動
ollama serve
```

**💡 ヒント**:
- `ollama --version` で警告が出てもバージョンが表示されればOKです
- `Warning: could not connect to a running Ollama instance` が出た場合、`ollama serve` を実行してください

#### ビルドツールの確認（macOS）

```bash
# Xcode Command Line Tools の確認
xcode-select -p
# /Library/Developer/CommandLineTools と表示されればOK

# 表示されない場合
xcode-select --install
```

---

### 2. リポジトリのクローン

```bash
git clone https://github.com/unrcom/llamune_code.git
cd llamune_code
```

---

### 3. 依存関係のインストール

#### 3-1. バックエンドの依存関係

```bash
npm install
# 所要時間: 約1-3分
```

**⚠️ トラブルシューティング:**
もし以下のエラーが出た場合:
```
fatal error: 'climits' file not found
```

Xcode Command Line Toolsを再インストールしてください:
```bash
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
# ダイアログで「インストール」をクリック（5-10分かかります）

# 完了後、再度実行
npm install
```

#### 3-2. フロントエンドの依存関係

```bash
cd web
npm install
cd ..
```

---

### 4. 環境変数の設定

#### 4-1. 環境変数のコピー

```bash
cp .env.example .env
```

#### 4-2. シークレットキーの生成

```bash
npm run setup
# JWT_SECRET と ENCRYPTION_KEY が自動生成されます
```

**💡 重要**:
- デフォルト値が残っている場合は自動的に置き換えられます
- 既に設定済みの値は上書きされません

**生成される `.env` ファイルの内容:**
```env
PORT=3000
JWT_SECRET=<自動生成された256-bitキー>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
OLLAMA_API_URL=http://localhost:11434
ENCRYPTION_KEY=<自動生成された256-bitキー>
```

---

### 5. データベースのセットアップ

#### 5-1. データベース用ディレクトリの作成

```bash
mkdir -p ~/.llamune_code
```

#### 5-2. マイグレーション実行

```bash
npm run migrate:latest
# "Batch 1 run: 5 migrations" と表示されれば成功
```

**💡 ヒント**: `Failed to load external module` の警告は無害です。

**期待される出力:**
```
Failed to load external module ts-node/register
Failed to load external module typescript-node/register
...
Using environment: development
Batch 1 run: 5 migrations
```

---

### 6. 管理ユーザーの作成

```bash
npm run create-user admin admin admin
```

**期待される出力:**
```
✅ User created successfully

👤 User ID: 1
📧 Username: admin
🔐 Password: admin
👑 Role: admin

You can now login with these credentials.
```

**💡 重要**:
- このコマンドでデフォルト管理ユーザー（admin/admin）が作成されます
- Web UIにログインする際に必要です
- 既に存在する場合はエラーが表示されます

**💡 使い方:**
```bash
# 基本形式
npm run create-user <username> <password> <role>

# 例: 一般ユーザーを作成
npm run create-user john password123 user
```

---

### 7. モデルのダウンロード

#### 7-1. Ollamaサービスの起動

**別のターミナルウィンドウ**で以下を実行してください:

```bash
ollama serve
# このターミナルは起動したままにしておきます
```

**元のターミナルに戻って**、サービスが起動していることを確認:

```bash
ollama list
# モデル一覧が表示されればOK（空でも可）
```

**💡 ヒント:**
- `ollama serve` は起動したままにしておく必要があります
- バックグラウンドで起動する場合: `ollama serve > /dev/null 2>&1 &`

#### 7-2. モデルのダウンロード

```bash
# 推奨モデル（どれか1つ）
ollama pull qwen2.5-coder:7b    # コーディング特化（推奨、約4GB）
ollama pull gemma2:9b           # バランス型（約5GB）
ollama pull gpt-oss:20b         # 推論特化（大規模、約12GB）
```

**所要時間:** ネットワーク速度により10〜30分

**確認:**
```bash
ollama list
# ダウンロードしたモデルが表示されることを確認
```

---

### 8. 起動

#### 8-1. バックエンド起動

**ターミナル1（Ollama起動中のターミナル以外）:**

```bash
npm run api
```

**期待される出力:**
```
🚀 Llamune API Server running on http://localhost:3000
📝 API Documentation: http://localhost:3000/api
```

#### 8-2. フロントエンド起動

**ターミナル2（新しいターミナル）:**

```bash
cd web
npm run dev
```

**期待される出力:**
```
VITE v7.2.2  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: http://172.18.0.4:5173/
```

---

### 9. アクセス確認

ブラウザで http://localhost:5173 を開いてください 🎉

**ログイン情報:**
- **ユーザー名**: admin
- **パスワード**: admin

これで Llamune Code を使い始めることができます!

---

## 🔧 日常の起動手順

2回目以降は以下の手順で起動します：

```bash
# ターミナル1: Ollama
ollama serve

# ターミナル2: バックエンド
cd /path/to/llamune_code
npm run api

# ターミナル3: フロントエンド
cd /path/to/llamune_code/web
npm run dev
```

**3つのターミナルが必要**です。

**💡 ヒント**: Dockerを使えば `docker compose up` 一発で起動できます。
詳細は [README.md](README.md) の「方法A: Docker」を参照してください。

---

## 🐛 トラブルシューティング

### Node.jsのバージョンエラー

**症状:**
```
Error: The module was compiled against a different Node.js version
```

**解決策:**
```bash
# Node.js v22.21.0 に切り替え
nvm use 22.21.0

# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install
```

### Ollamaに接続できない

**症状:**
```
Error: connect ECONNREFUSED 127.0.0.1:11434
```

**解決策:**
```bash
# Ollamaが起動しているか確認
ollama list

# 起動していない場合
ollama serve
```

### ポートが既に使用されている

**症状:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解決策:**
```bash
# 使用中のプロセスを確認
lsof -i :3000  # バックエンド
lsof -i :5173  # フロントエンド
lsof -i :11434 # Ollama

# プロセスを停止してから再実行
kill -9 <PID>
```

### データベースエラー

**症状:**
```
Error: SQLITE_ERROR: no such table: sessions
```

**解決策:**
```bash
# マイグレーションを再実行
npm run migrate:latest

# それでも解決しない場合、データベースを再作成
rm -rf ~/.llamune_code
mkdir -p ~/.llamune_code
npm run migrate:latest
npm run create-user admin admin admin
```

---

## 🔄 アップデート手順

### 1. 最新コードの取得

```bash
cd /path/to/llamune_code
git pull origin main
```

### 2. 依存関係の更新

```bash
# バックエンド
npm install

# フロントエンド
cd web
npm install
cd ..
```

### 3. マイグレーション実行

```bash
npm run migrate:latest
```

### 4. 再起動

```bash
# バックエンドとフロントエンドを再起動
```

---

## 🗑️ アンインストール

### 1. プロジェクトファイルの削除

```bash
cd /path/to/llamune_code/..
rm -rf llamune_code
```

### 2. データベースの削除

```bash
rm -rf ~/.llamune_code
```

### 3. Ollamaモデルの削除（オプション）

```bash
# モデル一覧確認
ollama list

# 不要なモデルを削除
ollama rm qwen2.5-coder:7b
ollama rm gemma2:9b
```

---

## 📚 追加情報

### データベースの場所

- **SQLiteファイル**: `~/.llamune_code/history.db`
- **バックアップ推奨**: 定期的にこのファイルをバックアップしてください

### ログファイル

- **APIログ**: `api-debug.log`（プロジェクトルート）

### 環境変数

詳細は `.env.example` を参照してください。

---

## 🔗 関連ドキュメント

- [README.md](README.md) - プロジェクト概要とDocker版セットアップ
- [API_ENDPOINTS.md](./docs/API_ENDPOINTS.md) - API仕様
- [DATABASE_MIGRATION.md](./docs/DATABASE_MIGRATION.md) - データベーススキーマ
- [AUTHENTICATION.md](./docs/AUTHENTICATION.md) - 認証の仕組み
- [SYSTEM_PROMPTS.md](./docs/SYSTEM_PROMPTS.md) - システムプロンプト管理

---

**最終更新**: 2025-12-28
