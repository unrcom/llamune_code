# Llamune (ラムネ/ラミューン)

クローズドネットワーク環境で複数のローカル LLM を比較・活用するプラットフォーム

[![Status](https://img.shields.io/badge/status-alpha-green)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

## 🎯 概要

Llamune は、機密情報を外部に送信せず、複数のローカル LLM を活用できるプラットフォームです。

### 解決する 3 つの課題

1. **機密情報の保護**: 完全クローズド環境でデータを外部に送信しない
2. **LLM の偏りの発見**: 複数モデルで推論し、誤りや偏りに気づく
3. **業務への特化**: RAG/ファインチューニングでドメイン知識を注入

## ✨ 主要機能

### CLI 版（現在利用可能）

- 🔒 **完全クローズド**: 外部通信ゼロ、データは完全にローカル
- 🤖 **複数 LLM 対応**: gemma2, deepseek-r1, qwen2.5, phi3.5 など
- 🔄 **リトライ機能**: 異なるモデル・パラメータで回答を再生成
- ⏮️ **巻き戻し機能**: 会話履歴の途中から再開
- 💾 **セッション管理**: 会話履歴の保存・再開
- 🎨 **パラメータ調整**: プリセット選択で最適な回答を生成

### Web UI 版（開発中）

- 🌐 **ブラウザベース**: 直感的なチャットインターフェース
- 📊 **ビジュアル比較**: 複数モデルの回答を並べて比較
- 📈 **リアルタイム**: ストリーミングで回答を表示
- 🎯 **モデル管理**: ブラウザからモデルのダウンロード・削除

## 🛠️ 技術スタック

### Phase 1: CLI 版（実装完了）

- **ランタイム**: Node.js 18+
- **言語**: TypeScript
- **CLI**: Commander.js + readline
- **データベース**: better-sqlite3 (SQLite)
- **LLM Engine**: ollama
- **ビルド**: TypeScript Compiler

### Phase 2: Web 版（開発中）

- **バックエンド**: Express + TypeScript
- **フロントエンド**: React + TypeScript + Vite + Tailwind CSS
- **状態管理**: Zustand
- **ストリーミング**: Server-Sent Events (SSE)
- **API**: RESTful API

## 📖 ユースケース

Llamune は様々な業務シーンで活用できます：

- 💻 [**安全な Vibe Coding**](./docs/vibe-coding-with-llamune.md) - 複数 LLM でコード生成・比較し、セキュリティと品質を向上
- 🤔 **意思決定支援** - 複数の視点から分析（準備中）
- 📝 **ドキュメント作成** - 多角的なレビュー（準備中）
- 🏢 **業界特化モード** - 会計監査、法律、医療など（準備中）

## 📚 ドキュメント

### サービス仕様・設計

- [**CLI 版 仕様書**](./docs/llamune-cli-specification.md) - ⭐ Phase 1 実装仕様
- [サービス仕様書](./docs/llamune-service-specification.md) - プロジェクト全体のビジョン
- [API 仕様書](./docs/API_SPECIFICATION.md) - RESTful API の詳細
- [パラメータテストガイド](./docs/llm-parameters-testing-guide.md) - 7 つのパラメータ
- [LLM ファイルとファインチューニング](./docs/llm-files-and-finetuning.md)
- [Ollama 操作マニュアル](./docs/ollama-operations.md)

### モデルテスト結果

| モデル         | パラメータ数 | 思考プロセス | 推論速度 | 品質   | レポート                                        |
| -------------- | ------------ | ------------ | -------- | ------ | ----------------------------------------------- |
| gemma2:9b      | 9.2B         | ❌           | 52 秒    | 最高   | [詳細](./docs/reasoning-test-gemma2-9b.md)      |
| deepseek-r1:7b | 7.0B         | ✅           | 78 秒    | 不安定 | [詳細](./docs/reasoning-test-deepseek-r1-7b.md) |
| qwen2.5:14b    | 14.0B        | ❌           | 70 秒    | 高     | [詳細](./docs/reasoning-test-qwen2-5.md)        |
| phi3.5         | 3.8B         | ❌           | 91 秒    | 限定的 | [詳細](./docs/reasoning-test-phi3-5.md)         |

_推論速度は 16GB M1 Mac での複雑な Reasoning タスクでの実測値_

## 🚀 現在の状況

**フェーズ**: Phase 1 完了 → Phase 2 開発中

### ✅ Phase 1 完了（CLI 版 MVP）

**実装済み機能:**
- ✅ CLI インターフェース（`llamune` / `llmn` コマンド）
- ✅ モデル管理（ダウンロード・削除・一覧表示）
- ✅ チャット機能（会話履歴の保存・再開）
- ✅ `/retry` 機能（異なるモデル・プリセットで再実行）
- ✅ `/rewind` 機能（会話履歴の巻き戻し）
- ✅ `/switch` 機能（モデル切り替え）
- ✅ パラメータプリセット（balanced, creative, fast）
- ✅ 推奨モデル表示（システムスペックに応じて）
- ✅ SQLite データベース（会話履歴の永続化）
- ✅ ollama 自動起動

**開発環境:**
- ✅ ドメイン取得 (llamune.com)
- ✅ 4 つの LLM モデルテスト完了
- ✅ サービス仕様書作成
- ✅ 技術ドキュメント整備
- ✅ MacBook Air M4 32GB 導入完了

### 🔄 Phase 2 進行中（Web UI）

**実装中:**
- 🔄 Express API サーバー
- 🔄 React フロントエンド
- 🔄 リアルタイムストリーミング（SSE）
- 🔄 ビジュアルチャットインターフェース
- 🔄 モデル管理 UI
- 🔄 セッション管理 UI

### 📋 次のステップ

- 🔜 Web UI の完成度向上
- 🔜 複数モデル並列実行（Phase 2）
- 🔜 リッチなマークダウン表示
- 🔜 アーティファクト機能（Phase 2）
- 🔜 RAG 機能（Phase 3）

## 💻 インストール・使い方

### 必要な環境

**ハードウェア:**
- **メモリ**: 16GB RAM 以上推奨（32GB以上を推奨、モデルサイズに応じて）
- **GPU**: 以下のいずれか（推奨、なくても動作可能だが大幅に遅い）
  - NVIDIA GPU (CUDA対応)
  - AMD GPU (ROCm対応、Linux)
  - Apple Silicon (Metal)
- **ストレージ**: 20GB以上の空き容量（モデルファイル用）

**OS:**
- macOS 14.0 以降（Intel / Apple Silicon）
- Linux（Ubuntu 20.04以降、その他ディストリビューション）
- Windows 11（WSL2 または ネイティブ、NVIDIA GPU推奨）

**ソフトウェア:**
- Node.js: 18.x 以降
- ollama: 最新版（Llamuneが自動起動）

**動作検証環境:**
- ✅ Apple M1 (16GB RAM) で動作検証済み
- ✅ Apple M4 (32GB RAM) で動作検証済み
- 🔜 主要クラウドプロバイダーのVM環境での動作検証を予定

**未検証環境（動作する可能性あり）:**
- Windows 11 (NVIDIA GPU + CUDA)
- Linux (NVIDIA GPU / AMD GPU)
- クラウドVM (AWS, GCP, Azure)

動作報告やフィードバックを歓迎します！

**注意事項:**
- **Windows**: WSL2上でollamaを使用、またはネイティブ版（プレビュー）
- **GPU なし**: 動作しますが推論速度が大幅に低下します（実用的でない可能性）
- **メモリ**: モデルサイズ + 数GB の余裕が必要
  - 例: gemma2:9b (5.4GB) → 最低12GB、推奨16GB以上

**⚠️ リソース消費について:**

生成AI（LLM）は、クラウドサービスと異なり、閉域環境では**ローカルマシンのリソースを大量に消費**して動作します。

- **メモリ**: モデル全体をRAMに展開（数GB〜十数GB）
- **CPU/GPU**: 推論中は高負荷状態が継続
- **システムへの影響**: 他のアプリケーションの動作に影響する可能性

**推奨事項:**
- 使用中は**不要なアプリケーションを終了**してください
- 特に16GB環境では、ブラウザや大規模なアプリを閉じることを推奨
- メモリスワップが発生するとシステム全体が著しく遅くなります
- **システムスペックに応じた推奨モデルを使用してください**
  - CLI: `llamune recommend` または `llmn recommend` で推奨モデルを確認
  - Web UI: 「モデル管理」画面で推奨マークが付いたモデルを選択

**実例:**
- 16GB M1 Mac + qwen2.5:14b (8.5GB) 使用時、他アプリ多数起動でシステムハングアップの事例あり
- 余裕を持ったメモリ管理が重要です

### インストール（ユーザー向け）

```bash
# 1. Node.jsがインストール済みであることを確認
node --version

# 2. ollamaをインストール
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# https://ollama.com/download からインストーラーをダウンロード

# 3. モデルをダウンロード
ollama pull gemma2:9b
ollama pull deepseek-r1:7b
ollama pull qwen2.5:14b

# 4. Llamuneをインストール（将来）
npm install -g llamune

# 5. 実行
llamune
```

> **注**: `ollama serve` を実行する必要はありません。  
> Llamune が必要に応じて自動的に ollama を起動します。

### 開発セットアップ（コントリビューター向け）

```bash
# リポジトリクローン
git clone https://github.com/unrcom/llamune.git
cd llamune

# 依存関係インストール
npm install

# CLI版を開発モードで実行
npm run dev

# API サーバーを起動
npm run api

# Web UI を起動（別ターミナル）
cd web
npm install
npm run dev
```

## 🎮 使い方

### CLI 版の基本操作

```bash
# チャット開始
llamune chat

# モデルを指定してチャット
llamune chat -m gemma2:9b

# 過去の会話を再開
llamune chat -c 1

# モデル一覧
llamune ls

# モデルをダウンロード
llamune pull gemma2:9b

# 推奨モデルを表示
llamune recommend

# 会話履歴を表示
llamune history
```

### チャット中の特殊コマンド

```bash
/retry          # 最後の質問を別モデル・プリセットで再実行
/rewind <番号>  # 指定した往復まで巻き戻し
/switch <model> # モデルを切り替え
/history        # 会話履歴を表示
/models         # 利用可能なモデル一覧
/current        # 現在のモデルを表示
/help           # ヘルプを表示
yes, y          # retry の回答を採用
no, n           # retry の回答を破棄
exit, quit      # チャットを終了
```

### 実行例

```bash
$ llamune chat
利用可能なモデル:

⭐ 1. gemma2:9b (前回使用)
   2. deepseek-r1:7b
   3. qwen2.5:14b

モデルを選択してください (番号): 1

💬 Chat モード
モデル: gemma2:9b

終了するには "exit" または "quit" と入力してください
---

You: Pythonでクイックソートを実装して
AI (gemma2:9b): はい、実装します...

You: /retry
モデルとプリセットの組み合わせ:

⭐ 1. gemma2:9b (balanced)
   2. gemma2:9b (creative)
   3. gemma2:9b (fast)
   4. deepseek-r1:7b (balanced)
   5. deepseek-r1:7b (creative)
   ...

組み合わせを選択してください (番号): 4

🔄 deepseek-r1:7b (balanced) で再実行します...

AI (deepseek-r1:7b (balanced)): Pythonでクイックソート...

💡 この回答を採用しますか？
  yes, y  - 採用 (deepseek-r1:7b (balanced) の回答を採用する)
  no, n   - 破棄 (gemma2:9b の回答を採用する)

You: yes
✅ deepseek-r1:7b の回答を採用しました
```

## 🗓️ ロードマップ

| フェーズ      | 期間              | 内容                         | 状況      |
| ------------- | ----------------- | ---------------------------- | --------- |
| **Phase 0**   | 2025-11           | 準備・調査・ドキュメント作成 | ✅ 完了   |
| **Phase 1**   | 2025-12 ~ 2026-01 | CLI 版 MVP 開発              | ✅ 完了   |
| **Phase 1.5** | 2026-01 ~ 2026-02 | Web UI 開発                  | 🔄 進行中 |
| **Phase 2**   | 2026-02 ~ 2026-03 | 複数 LLM 並列実行・比較      | 📋 計画中 |
| **Phase 3**   | 2026 Q2~          | ドメイン特化・PoC            | 📋 計画中 |

### Phase 1 完了（CLI 版 MVP）

```
✅ Week 1-2: 基盤構築
  - Node.js + TypeScript セットアップ
  - Commander.js による CLI 構造
  - ollama 連携
  - SQLite データベース

✅ Week 3-4: コア機能
  - チャット機能
  - 会話履歴管理
  - パラメータ調整
  - セッション管理

✅ Week 5-6: 完成度向上
  - /retry 機能実装
  - /rewind 機能実装
  - エラーハンドリング
  - 設定管理

✅ Week 7: リリース準備
  - ドキュメント整備
  - テスト実施
  - 社内テスト開始
```

### Phase 1.5 進行中（Web UI）

```
🔄 API サーバー実装
  - Express + TypeScript
  - RESTful API
  - Server-Sent Events (SSE)
  - 認証機能

🔄 フロントエンド実装
  - React + Vite
  - Tailwind CSS
  - Zustand 状態管理
  - チャット UI
```

## 🧪 テスト

```bash
# ユニットテスト実行
npm test

# API テスト
npm run test:api

# データベース確認
npm run check-db
```

## 🤝 コントリビューション

コントリビューションを歓迎します！以下の方法で参加できます：

1. Issue を作成してバグ報告や機能提案
2. Pull Request を送信してコード改善
3. ドキュメントの改善提案

## 📄 ライセンス

MIT License

## 👤 作者

mop - [@unrcom](https://github.com/unrcom)

## 🔗 リンク

- [GitHub リポジトリ](https://github.com/unrcom/llamune)
- [公式サイト](https://llamune.com)（準備中）
- [ドキュメント](./docs/)

---

**最終更新**: 2025-11-21  
**バージョン**: 0.1.0  
**ステータス**: Alpha（CLI 版完成、Web 版開発中）
