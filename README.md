# Llamune Code

[![Status](https://img.shields.io/badge/status-alpha-green)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

ローカルLLMを活用した、完全クローズド環境で動作するコーディング支援プラットフォーム

## 🎯 概要

Llamune Code は、機密情報を外部に送信せず、ローカルLLMでコーディング支援を受けられるプラットフォームです。プロジェクトディレクトリに直接アクセスし、エンドツーエンド暗号化で会話内容を保護します。

**主な特徴：**
- 🔒 **完全クローズド環境** - データは一切外部に送信されません
- 📁 **プロジェクト統合** - ローカルディレクトリに直接アクセス（Function Calling）
- 🧠 **思考過程の可視化** - 推論モデルの思考プロセスを表示
- 🔐 **エンドツーエンド暗号化** - AES-256-GCMで会話内容を保護
- 🤖 **複数LLM対応** - gpt-oss, qwen2.5-coder:7b, gemma2, deepseek-r1 など

> 💡 **サービスを体感する**: [Llamune コンセプトページ](https://llamune.com)（準備中）で、ローカル環境不要でサービスを体験できます。

## ✨ 主要機能

### 🧠 推論モデルの思考過程表示

推論モデル（gpt-oss など）の思考プロセスをリアルタイムで確認できます。

- 折りたたみUI（デフォルトで非表示）
- 「🧠 思考過程を表示」をクリックで展開
- LLMがどのように考えて答えを導いたかを理解

### 📁 プロジェクトディレクトリ統合

Function Callingを使って、LLMがローカルのプロジェクトディレクトリに直接アクセスできます。

- **read_file** - ファイルの内容を読み取り
- **list_files** - ディレクトリ内のファイル一覧を取得
- パストラバーサル対策済み
- セキュアなファイルアクセス

**使用例：**
```
You: package.jsonを読んで、依存関係を教えて

AI: [read_file: /your/project/package.json を実行]
このプロジェクトの主な依存関係は...
```

### 🔐 エンドツーエンド暗号化

会話内容とシステムプロンプトをAES-256-GCMで暗号化します。

**暗号化対象：**
- メッセージ内容（`messages.content`）
- 思考過程（`messages.thinking`）
- システムプロンプト（`domain_prompts.system_prompt`）

**特徴：**
- 認証付き暗号化（改ざん検知）
- 環境変数で鍵管理
- GitHubリポジトリ公開でも安全

### 🤖 複数LLM対応

複数のローカルLLMモデルを切り替えて使用できます。

**対応モデル：**
- **gpt-oss:20b** - 推論モデル、思考過程表示
- **qwen2.5-coder:7b** - コーディング特化、軽量
- **gemma2:9b** - 高品質、バランス型
- **deepseek-r1:7b** - 推論特化、思考過程表示
- **qwen2.5:14b** - 大規模、高精度
- **phi3.5** - 軽量、高速

### 💬 Web UI / CLI

**Web UI（完成）：**
- ブラウザベースの直感的なチャットインターフェース
- リアルタイムストリーミング表示
- セッション管理
- マークダウン表示（表、コードブロック対応）

**CLI（完成）：**
- ターミナルから直接使用
- `/retry`, `/rewind`, `/switch` などの便利コマンド
- 会話履歴の保存・再開

## 🚀 クイックスタート

以下の手順でLlamune Codeを始められます。
（初回セットアップ時間: 約20〜40分）

**所要時間の内訳:**
- 環境準備（Node.js, Ollama）: 5-10分
- 依存関係インストール: 1-3分
- モデルダウンロード: 10-30分（ネットワーク速度に依存）
- 設定とマイグレーション: 1-2分

### 1. 前提条件

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

### 2. リポジトリのクローン

```bash
git clone https://github.com/unrcom/llamune_code.git
cd llamune_code
```

### 3. セットアップ

#### 3-1. 依存関係のインストール

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

#### 3-2. 環境変数のコピー

```bash
cp .env.example .env
```

#### 3-3. シークレットキーの生成

```bash
npm run setup
# JWT_SECRET と ENCRYPTION_KEY が自動生成されます
```

**💡 重要**: 
- デフォルト値が残っている場合は自動的に置き換えられます
- 既に設定済みの値は上書きされません

#### 3-4. データベースのマイグレーション

```bash
# データベース用ディレクトリの作成
mkdir -p ~/.llamune_code

# マイグレーション実行
npm run migrate:latest
# "Batch 1 run: 5 migrations" と表示されれば成功
```

**💡 ヒント**: `Failed to load external module` の警告は無害です。

#### 3-5. 管理ユーザーの作成

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

### 4. モデルのダウンロード

#### Ollamaサービスの起動

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

#### モデルのダウンロード

```bash
# 推奨モデル（どれか1つ）
ollama pull qwen2.5-coder:7b    # コーディング特化（推奨、約4GB）
ollama pull gemma2:9b           # バランス型（約5GB）
ollama pull gpt-oss:20b         # 推論特化（大規模、約12GB）
```

**所要時間:** ネットワーク速度により10〜30分

### 5. 起動

```bash
# バックエンド起動
npm run api

# フロントエンド起動（別ターミナル）
cd web
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開いてください 🎉

**ログイン情報:**
- **ユーザー名**: admin
- **パスワード**: admin

これで Llamune Code を使い始めることができます!

## 📦 セットアップ

### 必要な環境

**ハードウェア：**
- **メモリ**: 16GB RAM 以上推奨（32GB以上を強く推奨）
- **GPU**: Apple Silicon / NVIDIA / AMD（推奨、なくても動作可能）
- **ストレージ**: 20GB以上の空き容量

**ソフトウェア:**
- Node.js v22.21.0（厳密）- nvm推奨
- Ollama 最新版
- SQLite（better-sqlite3経由）
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: build-essential, Python 3.x

**動作検証環境:**
- ✅ macOS - Apple M1 (16GB RAM)
- ✅ macOS - Apple M4 (32GB RAM)
- ❌ Windows - サポート対象外

**⚠️ 重要**: 
- Node.js v22.21.0が必須です。v24.1.0では動作しません。
- Windows環境はサポート対象外です（LLMが動作しません）。

### インストール手順

#### 1. Ollama のインストール

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

#### 2. プロジェクトのセットアップ

```bash
# リポジトリクローン
git clone https://github.com/unrcom/llamune_code.git
cd llamune_code

# 依存関係インストール
npm install

# Web UI の依存関係
cd web
npm install
cd ..
```

#### 3. 環境変数の設定

```bash
# .env.example をコピー
cp .env.example .env

# 暗号化キーの自動生成
npm run setup
```

`.env` ファイルには以下が含まれます：
- `ENCRYPTION_KEY` - メッセージ暗号化キー（自動生成）
- `JWT_SECRET` - JWT認証シークレット
- `PORT` - APIサーバーのポート

**⚠️ 重要**: `.env` ファイルは絶対にGitにコミットしないでください

#### 4. データベースのマイグレーション

```bash
# マイグレーション実行
npm run migrate:latest

# 状態確認
npm run migrate:status
```

#### 5. モデルのダウンロード

```bash
# 推奨: コーディング特化モデル
ollama pull qwen2.5-coder:7b

# または: その他のモデル
ollama pull gpt-oss:20b      # 推論特化（大規模）
ollama pull gemma2:9b        # バランス型
```

### 初回起動

```bash
# ターミナル1: バックエンド起動
npm run api

# ターミナル2: フロントエンド起動
cd web
npm run dev
```

ブラウザで以下にアクセス：
- **フロントエンド**: http://localhost:5173
- **API**: http://localhost:3000

## 💡 使い方

### Web UI

#### 基本的なチャット

1. ブラウザで http://localhost:5173 を開く
2. モデルを選択（ドロップダウン）
3. メッセージを入力して送信
4. リアルタイムでストリーミング表示

#### プロジェクトディレクトリの設定

1. 新しいチャットを作成
2. 「プロジェクトディレクトリ」欄にローカルパスを入力
   - 例: `/Users/username/projects/my-app`
3. メッセージを送信すると、LLMがそのディレクトリにアクセス可能

**注意**: チャット開始後は変更できません（セキュリティ上の理由）

#### 思考過程の確認

推論モデル（gpt-oss など）を使用すると：

1. メッセージ送信後、「🧠 思考過程を表示」が表示
2. クリックすると、LLMの思考プロセスを確認
3. どのように答えを導いたかを理解できる

### CLI

#### 基本操作

```bash
# チャット開始
llamune chat

# モデルを指定
llamune chat -m gemma2:9b

# 過去の会話を再開
llamune chat -c 1

# モデル一覧
llamune ls

# 推奨モデル表示
llamune recommend
```

#### チャット中のコマンド

```bash
/retry          # 最後の質問を別モデルで再実行
/rewind <番号>  # 会話を巻き戻し
/switch <model> # モデル切り替え
/history        # 会話履歴表示
/help           # ヘルプ表示
exit, quit      # 終了
```

## 🏗️ アーキテクチャ

### 技術スタック

**バックエンド：**
- Node.js 18+ / TypeScript
- Express.js
- better-sqlite3（SQLite）
- JWT認証
- Server-Sent Events (SSE)

**フロントエンド：**
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand（状態管理）
- react-markdown

**LLMエンジン：**
- Ollama
- Function Calling サポート

### データベーススキーマ

主要テーブル：
- `sessions` - チャットセッション
- `messages` - メッセージ（暗号化済み）
- `users` - ユーザー情報
- `domain_prompts` - システムプロンプト（暗号化済み）
- `refresh_tokens` - リフレッシュトークン

詳細は [DATABASE_MIGRATION.md](./docs/DATABASE_MIGRATION.md) を参照

### 暗号化の仕組み

```
平文メッセージ
    ↓
[AES-256-GCM 暗号化]
    ↓
iv:authTag:encryptedData
    ↓
データベースに保存
    ↓
[復号]
    ↓
平文メッセージ
```

- **暗号化キー**: `.env` ファイルで管理（32バイト）
- **IV**: 毎回ランダム生成
- **認証タグ**: 改ざん検知

## 🔒 セキュリティ

### AES-256-GCM暗号化

Llamune Codeは、機密情報を保護するためにAES-256-GCM暗号化を採用しています。

**暗号化対象フィールド：**

| テーブル | フィールド | 内容 |
|---------|-----------|------|
| `messages` | `content` | 会話内容（ユーザー・AI） |
| `messages` | `thinking` | 推論モデルの思考過程 |
| `domain_prompts` | `system_prompt` | システムプロンプト |

**暗号化されないフィールド：**
- `sessions.title` - セッション一覧での表示用
- `users.username` - ログイン用
- メタデータ（作成日時、モデル名など）

### 鍵管理

**暗号化キーの生成：**
```bash
npm run setup
```

自動的に32バイトのランダムキーが生成され、`.env` ファイルに保存されます。

**セキュリティのベストプラクティス：**
- ✅ `.env` ファイルは `.gitignore` に含まれています
- ✅ 暗号化キーは環境変数で管理
- ✅ 後方互換性あり（既存の平文データも読み取り可能）
- ⚠️ `.env` ファイルのバックアップを忘れずに
- ⚠️ サーバーへのアクセスを制限してください

### GitHubリポジトリ公開時の安全性

**暗号化により保護されるもの：**
- 会話内容
- システムプロンプト（ノウハウ）
- 思考過程

**暗号化キーがない場合：**
- データベースは見れても、暗号化されたフィールドは復号不可
- コードは公開されても、鍵がなければ安全

### 既存データの暗号化

既に平文で保存されているデータを暗号化するには：

```bash
# domain_prompts.system_prompt を暗号化
npm run encrypt-domain-prompts
```

**注意**: メッセージは自動的に暗号化されます（新規メッセージのみ）

## 🧪 開発者向け

### 開発環境セットアップ

```bash
# リポジトリクローン
git clone https://github.com/unrcom/llamune_code.git
cd llamune_code

# 依存関係インストール
npm install
cd web && npm install && cd ..

# 環境変数設定
cp .env.example .env
npm run setup

# マイグレーション
npm run migrate:latest

# 開発モード起動
npm run api        # バックエンド
cd web && npm run dev  # フロントエンド
```

### テスト

```bash
# ユニットテスト
npm test

# データベース確認
npm run check-db

# セッション確認
npm run check-sessions
```

### デバッグ

**バックエンドログ：**
```bash
# api-debug.log に出力される
tail -f api-debug.log
```

**データベース確認：**
```bash
sqlite3 ~/.llamune_code/history.db

# メッセージ確認（暗号化されている）
SELECT id, role, substr(content, 1, 50) FROM messages LIMIT 5;

# セッション確認
SELECT id, title FROM sessions ORDER BY id DESC LIMIT 5;
```

### ビルド

```bash
# TypeScriptコンパイル
npm run build

# 本番モード起動
npm start
```

## 🗺️ ロードマップ

| フェーズ | 期間 | 内容 | 状況 |
|---------|------|------|------|
| **Phase 0** | 2025-11 | 準備・調査・ドキュメント作成 | ✅ 完了 |
| **Phase 1** | 2025-12 ~ 2026-01 | CLI版MVP開発 | ✅ 完了 |
| **Phase 1.5** | 2026-01 | Web UI開発 | ✅ 完了 |
| **Phase 2** | 2026-02 ~ 2026-03 | 複数LLM並列実行・比較 | 📋 計画中 |
| **Phase 3** | 2026 Q2~ | ドメイン特化・PoC | 📋 計画中 |

### ✅ Phase 1.5 完了（Web UI）

**実装済み機能：**
- ✅ Express API サーバー
- ✅ React フロントエンド
- ✅ リアルタイムストリーミング（SSE）
- ✅ チャットインターフェース
- ✅ セッション管理
- ✅ JWT認証
- ✅ プロジェクトディレクトリ統合（Function Calling）
- ✅ 推論モデルの思考過程表示
- ✅ AES-256-GCM暗号化

### 📋 Phase 2 計画（複数LLM並列実行）

- 複数モデルで同時に回答生成
- 回答の比較表示
- 投票・評価機能
- モデル推奨システム

### 📋 Phase 3 計画（ドメイン特化）

- カスタムドメインプロンプト
- RAG機能
- ファインチューニング支援
- 業界特化モード

## 🤝 コントリビューション

バグ報告や機能提案を歓迎します！

**Issue作成：**
- バグを見つけた場合
- 新機能のアイデア
- ドキュメントの改善提案

**Pull Request：**
- コードの改善
- ドキュメントの追加・修正
- テストの追加

## 📄 ライセンス

MIT License

## 👤 作者

mop - [@unrcom](https://github.com/unrcom)

## 🔗 リンク

- [Llamune コンセプトページ](https://llamune.com)（準備中） - サービスを体感できるデモ
- [GitHub リポジトリ](https://github.com/unrcom/llamune_code)
- [ドキュメント](./docs/)
- [API仕様書](./docs/API_SPECIFICATION.md)
- [データベースマイグレーションガイド](./docs/DATABASE_MIGRATION.md)

---

**最終更新**: 2025-12-18  
**バージョン**: 0.1.0  
**ステータス**: Alpha（Phase 1.5 完了）
