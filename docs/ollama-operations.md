# Ollama 操作マニュアル

## 目次
1. [インストール](#インストール)
2. [起動・停止](#起動停止)
3. [状態確認](#状態確認)
4. [モデル管理](#モデル管理)
5. [モデル実行](#モデル実行)
6. [トラブルシューティング](#トラブルシューティング)

---

## インストール

### macOSへの導入

```bash
# Homebrewを使用する場合
brew install ollama

# または公式サイトからダウンロード
# https://ollama.ai/download
```

インストール後、以下で確認:
```bash
ollama --version
```

---

## 起動・停止

### 基本的な起動方法

```bash
# ollamaサービスを起動（フォアグラウンド）
ollama serve
```

このコマンドを実行すると、ターミナルがollamaサーバーに占有されます。

### バックグラウンド起動

```bash
# バックグラウンドで起動
ollama serve &

# または
nohup ollama serve > ollama.log 2>&1 &
```

### 停止方法

```bash
# フォアグラウンドで動作している場合
Ctrl + C

# バックグラウンドの場合
pkill ollama
```

---

## 状態確認

### ollamaが起動しているか確認

```bash
# 方法1: プロセスを確認
ps aux | grep ollama

# 方法2: より簡潔に
pgrep -fl ollama

# 方法3: ollamaコマンドで確認
ollama list
```

`ollama list` がエラーなく実行できれば、ollamaは正常に動作しています。

---

## モデル管理

### インストール済みモデルの一覧表示

```bash
ollama list
```

**出力例:**
```
NAME              ID              SIZE     MODIFIED
qwen2.5:14b       abc123def456    8.2 GB   2 hours ago
deepseek-r1:7b    def789ghi012    4.1 GB   1 day ago
```

### モデルのダウンロード（pull）

```bash
# 基本構文
ollama pull <モデル名>:<タグ>

# 例: qwen2.5の14Bモデルをダウンロード
ollama pull qwen2.5:14b

# 例: deepseek-r1の7Bモデル
ollama pull deepseek-r1:7b
```

**ダウンロード時間の目安:**
- 7Bモデル（約4GB）: 5-10分
- 14Bモデル（約8GB）: 10-20分
- 32Bモデル（約19GB）: 60-90分

※ネットワーク速度に依存

### モデルの削除（rm）

```bash
# 基本構文
ollama rm <モデル名>:<タグ>

# 例: qwq:32bを削除
ollama rm qwq:32b
```

### モデルの詳細情報表示

```bash
# モデルの詳細を表示
ollama show <モデル名>:<タグ>

# 例
ollama show qwen2.5:14b
```

**表示内容:**
- アーキテクチャ
- パラメータ数
- コンテキスト長
- 量子化方式
- デフォルトパラメータ（temperature、top_pなど）

---

## モデル実行

### 対話的実行（run）

```bash
# 基本構文
ollama run <モデル名>:<タグ>

# 例: qwen2.5:14bを起動
ollama run qwen2.5:14b
```

実行後、プロンプトが表示され、対話が開始されます。

```bash
>>> こんにちは
こんにちは！何かお手伝いできることはありますか？

>>> /bye  # 終了コマンド
```

### プロンプトを直接渡して実行

```bash
# 一度だけ実行して結果を取得
ollama run qwen2.5:14b "マイクロサービスアーキテクチャの利点を3つ教えてください"
```

### API経由での実行（プログラムから）

```bash
# curlを使った例
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:14b",
  "prompt": "こんにちは",
  "stream": false
}'
```

---

## トラブルシューティング

### メモリ不足でシステムクラッシュする

**症状:**
- macOSが応答しなくなる
- 「WindowServerの問題レポート」ダイアログが表示される
- システムが強制的にリブートされる

**原因:**
モデルサイズがメモリ容量を超えている

**メモリとモデルサイズの目安:**

| メモリ容量 | 動作可能なモデル | 例 |
|-----------|----------------|-----|
| 8GB | 最大3Bまで | qwen2.5:3b |
| 16GB | 最大14Bまで | qwen2.5:14b, deepseek-r1:7b |
| 32GB | 最大32Bまで | qwq:32b, qwen2.5:32b |
| 64GB | 70Bも可能 | llama3.3:70b |

**注意:** 
- 実際の必要メモリは、モデルサイズ + OS + 他のアプリの合計
- OS + 他のアプリで4-6GB程度は確保が必要
- 例: 16GBメモリの場合、実質10-12GB程度が利用可能

**解決策:**
```bash
# 大きすぎるモデルを削除
ollama rm qwq:32b

# より小さいモデルをダウンロード
ollama pull qwen2.5:14b  # または qwen2.5:7b
```

### ollamaが応答しない

**確認手順:**

1. **プロセスが動いているか確認**
```bash
pgrep -fl ollama
```

2. **動いていない場合は起動**
```bash
ollama serve
```

3. **別ターミナルで動作確認**
```bash
ollama list
```

### モデルのダウンロードが途中で止まる

**対処法:**

```bash
# ダウンロードを中断
Ctrl + C

# 再度pullを実行（途中から再開される）
ollama pull qwen2.5:14b
```

### ポートが既に使用されている

**症状:**
```
Error: listen tcp 127.0.0.1:11434: bind: address already in use
```

**原因:**
別のollamaプロセスが既に動いている

**解決策:**
```bash
# 既存のollamaプロセスを終了
pkill ollama

# 再度起動
ollama serve
```

---

## よく使うコマンドまとめ

```bash
# ollamaサービス起動
ollama serve

# モデル一覧
ollama list

# モデルのダウンロード
ollama pull <モデル名>:<タグ>

# モデルの削除
ollama rm <モデル名>:<タグ>

# モデルの詳細表示
ollama show <モデル名>:<タグ>

# モデルを実行（対話モード）
ollama run <モデル名>:<タグ>

# モデルを実行（ワンショット）
ollama run <モデル名>:<タグ> "プロンプト"

# ollamaのプロセス確認
pgrep -fl ollama

# ollamaの停止
pkill ollama
```

---

## 推奨モデル構成

### 16GBメモリ環境

**Reasoning向け:**
```bash
ollama pull qwen2.5:7b        # 約4GB（軽量）
ollama pull qwen2.5:14b       # 約8GB（バランス）
ollama pull deepseek-r1:7b    # 約4GB（Reasoning特化）
```

**コード生成向け:**
```bash
ollama pull qwen2.5-coder:7b  # 約4GB（軽量）
ollama pull deepseek-coder:6.7b # 約4GB
ollama pull codellama:13b     # 約7GB
```

### 32GBメモリ環境

**Reasoning向け:**
```bash
ollama pull qwq:32b           # 約19GB（Reasoning特化）
ollama pull qwen2.5:32b       # 約19GB（汎用）
ollama pull llama3.3:70b      # 約40GB（大規模）
```

**コード生成向け:**
```bash
ollama pull deepseek-coder:33b # 約19GB
ollama pull qwen2.5-coder:32b  # 約19GB
```

---

## 備考

- モデルは `~/.ollama/models/` に保存される
- モデルファイルは削除しない限り残り続ける
- 複数バージョンのダウンロードも可能（例: qwen2.5:7b と qwen2.5:14b）
- バッチ実行の場合、1つのモデルが完了してから次を実行すればメモリは安全

**最終更新:** 2025-11-08

