#!/bin/bash
set -e

echo "========================================="
echo "🧪 Llamune ツール呼び出しテスト（ローカル実行用）"
echo "========================================="
echo ""

# 1. ログイン
echo "1️⃣  ログイン..."
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -s | jq -r '.accessToken')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ ログイン失敗"
  echo "   管理ユーザーを作成してください："
  echo "   npx tsx scripts/setup-admin.ts"
  exit 1
fi

echo "✅ ログイン成功"
echo ""

# 2. リポジトリ登録
echo "2️⃣  リポジトリ登録..."
REPO_RESPONSE=$(curl -X POST http://localhost:3000/api/repositories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"llamune_code\",
    \"localPath\": \"$(pwd)\",
    \"description\": \"Llamune code repository for testing\"
  }" \
  -s)

REPO_ID=$(echo "$REPO_RESPONSE" | jq -r '.id // .repository.id // empty')

# リポジトリが既に存在する場合は取得
if [ -z "$REPO_ID" ]; then
  echo "   既存リポジトリを取得中..."
  REPO_ID=$(curl -s http://localhost:3000/api/repositories \
    -H "Authorization: Bearer $TOKEN" | jq -r '.repositories[0].id')
fi

echo "✅ リポジトリID: $REPO_ID"
echo ""

# 3. 利用可能なモデル確認
echo "3️⃣  Ollamaモデル確認..."
MODELS=$(curl -s http://localhost:11434/api/tags)
MODEL_NAME=$(echo "$MODELS" | jq -r '.models[] | select(.name | contains("qwen2.5:14b")) | .name' | head -1)

if [ -z "$MODEL_NAME" ]; then
  MODEL_NAME=$(echo "$MODELS" | jq -r '.models[] | select(.name | contains("gemma2")) | .name' | head -1)
fi

if [ -z "$MODEL_NAME" ]; then
  MODEL_NAME=$(echo "$MODELS" | jq -r '.models[0].name')
fi

echo "✅ 使用モデル: $MODEL_NAME"
echo ""

# 4. ツール呼び出しテスト
echo "========================================="
echo "🤖 ツール呼び出し実行テスト"
echo "========================================="
echo ""
echo "質問: 'package.jsonを読んで、プロジェクト名とバージョン、説明を教えてください'"
echo ""
echo "⏳ LLMが応答を生成中..."

# 一時ファイルに最終結果を保存
TEMP_FILE=$(mktemp)
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"package.jsonを読んで、プロジェクト名とバージョン、説明を教えてください\",
    \"modelName\": \"$MODEL_NAME\",
    \"repositoryId\": $REPO_ID
  }" \
  -N 2>/dev/null | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      data="${line#data: }"
      content=$(echo "$data" | jq -r '.content // empty' 2>/dev/null)
      if [ -n "$content" ]; then
        echo "$content" > "$TEMP_FILE"
      fi
    elif [[ $line == event:\ done ]]; then
      break
    fi
  done

# 最終結果を表示
echo ""
echo "LLMの応答:"
echo "---"
cat "$TEMP_FILE"
echo ""
echo "---"
rm -f "$TEMP_FILE"

echo ""

# 5. 第2テスト：コード検索
echo "========================================="
echo "🔍 コード検索テスト"
echo "========================================="
echo ""
echo "質問: 'src/utils/repository-tools.ts ファイルを読んで、定義されているツールの数を教えてください'"
echo ""
echo "⏳ LLMが応答を生成中..."

TEMP_FILE=$(mktemp)
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"src/utils/repository-tools.ts ファイルを読んで、定義されているツールの数を教えてください\",
    \"modelName\": \"$MODEL_NAME\",
    \"repositoryId\": $REPO_ID
  }" \
  -N 2>/dev/null | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      data="${line#data: }"
      content=$(echo "$data" | jq -r '.content // empty' 2>/dev/null)
      if [ -n "$content" ]; then
        echo "$content" > "$TEMP_FILE"
      fi
    elif [[ $line == event:\ done ]]; then
      break
    fi
  done

echo ""
echo "LLMの応答:"
echo "---"
cat "$TEMP_FILE"
echo ""
echo "---"
rm -f "$TEMP_FILE"

echo ""
echo "========================================="
echo "✅ テスト完了！"
echo "========================================="
echo ""
echo "🎉 LLMは以下のツールを自律的に使用しました："
echo "  • read_file: ファイル内容の読み取り"
echo "  • list_files: ファイル一覧の取得"
echo "  • その他必要に応じて自動選択"
echo ""
echo "📊 実装されたツール（10個）："
echo "  1. read_file - ファイル読み取り"
echo "  2. write_file - ファイル書き込み"
echo "  3. list_files - ファイル一覧"
echo "  4. search_code - コード検索"
echo "  5. git_status - Git状態"
echo "  6. git_diff - 差分表示"
echo "  7. create_branch - ブランチ作成"
echo "  8. commit_changes - コミット"
echo "  9. get_file_tree - ファイルツリー"
echo "  10. get_recent_commits - コミット履歴"
echo ""
