#!/usr/bin/env bash
#
# generate-allcode.sh
# プロジェクト全体のコードを折り畳み可能なMarkdownファイルにまとめるスクリプト
#

set -euo pipefail

# 出力ファイル名
OUTPUT_FILE="llamune_allcode.md"

# 除外するディレクトリパターン
EXCLUDE_DIRS=(
  "node_modules"
  ".git"
  "dist"
  "build"
  "__pycache__"
  ".next"
  ".cache"
  "coverage"
)

# 対象とするファイル拡張子
INCLUDE_EXTENSIONS=(
  "*.ts"
  "*.tsx"
  "*.js"
  "*.jsx"
  "*.py"
  "*.go"
  "*.sh"
  "*.json"
  "*.yaml"
  "*.yml"
  "*.md"
  "*.html"
  "*.css"
)

# プロジェクトのルートディレクトリ（スクリプトの親ディレクトリ）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔍 プロジェクトをスキャン中: $PROJECT_ROOT"

# 除外パターンを find コマンド用に変換
FIND_EXCLUDE=""
for dir in "${EXCLUDE_DIRS[@]}"; do
  FIND_EXCLUDE="$FIND_EXCLUDE -path '*/$dir' -prune -o"
done

# 既存の出力ファイルを削除
if [ -f "$OUTPUT_FILE" ]; then
  echo "🗑️  既存の $OUTPUT_FILE を削除中..."
  rm -f "$OUTPUT_FILE"
fi

# ファイルを検索
echo "📝 ソースファイルを収集中..."

# 拡張子パターンを find コマンド用に変換
FIND_INCLUDE=""
for i in "${!INCLUDE_EXTENSIONS[@]}"; do
  if [ $i -eq 0 ]; then
    FIND_INCLUDE="-name '${INCLUDE_EXTENSIONS[$i]}'"
  else
    FIND_INCLUDE="$FIND_INCLUDE -o -name '${INCLUDE_EXTENSIONS[$i]}'"
  fi
done

# ファイル一覧を取得
FILES=$(eval "find '$PROJECT_ROOT' $FIND_EXCLUDE -type f \( $FIND_INCLUDE \) -print" | sort)

# ファイル数をカウント
FILE_COUNT=$(echo "$FILES" | wc -l)
echo "✅ $FILE_COUNT 個のファイルを発見"

# Markdownヘッダーを作成
cat > "$OUTPUT_FILE" <<'EOF'
# Llamune - プロジェクト全コード

このドキュメントには、llamuneプロジェクトの全ソースコードが含まれています。

## 概要

**Llamune**は、閉じたネットワーク環境でLLM（大規模言語モデル）を活用するためのプラットフォームです。

### 主な機能
- **CLIインターフェース**: ターミナルから直接LLMとチャット
- **Web UI**: ブラウザベースのチャットインターフェース
- **セッション管理**: 会話履歴の保存・再開
- **モデル管理**: 複数のLLMモデルをダウンロード・管理
- **リトライ機能**: 異なるモデル・パラメータで回答を再生成
- **API**: RESTful APIでプログラムから利用可能

### 技術スタック
- **バックエンド**: Node.js + TypeScript + Express
- **フロントエンド**: React + TypeScript + Vite + Tailwind CSS
- **データベース**: SQLite (better-sqlite3)
- **LLMエンジン**: Ollama
- **状態管理**: Zustand

---

## 📁 ファイル一覧

以下のファイルをクリックすると、コードが展開されます。

EOF

# ファイル一覧を作成（リンク付き）
echo "📋 ファイル一覧を作成中..."

echo "" >> "$OUTPUT_FILE"
echo "### ファイルツリー" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# カテゴリ別にファイルを分類
declare -A categories
categories=(
  ["バックエンド - コア"]="src/index.ts src/core/"
  ["バックエンド - API"]="src/api/"
  ["バックエンド - ユーティリティ"]="src/utils/"
  ["フロントエンド - コンポーネント"]="web/src/components/"
  ["フロントエンド - ページ・ルート"]="web/src/App.tsx web/src/main.tsx"
  ["フロントエンド - 状態管理・フック"]="web/src/store/ web/src/hooks/"
  ["フロントエンド - ユーティリティ・型"]="web/src/utils/ web/src/types/"
  ["設定ファイル"]="*.json *.config.* tsconfig.* vite.config.*"
  ["スクリプト"]="scripts/ bin/"
  ["ドキュメント"]="*.md"
)

# 各ファイルへのリンクを作成
for file in $FILES; do
  # プロジェクトルートからの相対パスを取得
  rel_path="${file#$PROJECT_ROOT/}"

  # ファイル名をアンカーIDに変換（特殊文字を除去）
  anchor=$(echo "$rel_path" | sed 's/[^a-zA-Z0-9_-]/-/g' | tr '[:upper:]' '[:lower:]')

  # ファイル一覧にリンクを追加
  echo "- [$rel_path](#$anchor)" >> "$OUTPUT_FILE"
done

echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 各ファイルのコードを折り畳み形式で追加
echo "💾 コードを埋め込み中..."

CURRENT_FILE=0
for file in $FILES; do
  CURRENT_FILE=$((CURRENT_FILE + 1))
  rel_path="${file#$PROJECT_ROOT/}"

  echo "[$CURRENT_FILE/$FILE_COUNT] $rel_path"

  # ファイル名をアンカーIDに変換
  anchor=$(echo "$rel_path" | sed 's/[^a-zA-Z0-9_-]/-/g' | tr '[:upper:]' '[:lower:]')

  # ファイル拡張子を取得
  ext="${file##*.}"

  # コードブロックの言語を決定
  case "$ext" in
    ts|tsx) lang="typescript" ;;
    js|jsx) lang="javascript" ;;
    py) lang="python" ;;
    go) lang="go" ;;
    sh) lang="bash" ;;
    json) lang="json" ;;
    yaml|yml) lang="yaml" ;;
    html) lang="html" ;;
    css) lang="css" ;;
    md) lang="markdown" ;;
    *) lang="text" ;;
  esac

  # Markdownに追加
  cat >> "$OUTPUT_FILE" <<EOF
## $rel_path

<details id="$anchor">
<summary>クリックしてコードを表示</summary>

\`\`\`$lang
EOF

  # ファイル内容を追加
  cat "$file" >> "$OUTPUT_FILE"

  cat >> "$OUTPUT_FILE" <<EOF

\`\`\`

</details>

---

EOF
done

# フッターを追加
cat >> "$OUTPUT_FILE" <<EOF

## 生成情報

- **生成日時**: $(date '+%Y年%m月%d日 %H:%M:%S')
- **プロジェクトルート**: $PROJECT_ROOT
- **総ファイル数**: $FILE_COUNT

---

**Llamune** - Closed Network LLM Platform
EOF

echo ""
echo "✅ 完了！"
echo "📄 出力ファイル: $OUTPUT_FILE"
echo "📊 総ファイル数: $FILE_COUNT"
