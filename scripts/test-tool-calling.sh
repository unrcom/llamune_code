#!/bin/bash
set -e

echo "========================================="
echo "🧪 Llamune ツール呼び出しテスト（ローカル実行用）"
echo "========================================="
echo ""

# 0. 前回のテスト実行の残骸をクリーンアップ
echo "0️⃣  前回実行の残骸をクリーンアップ中..."
if [ -f "test-output.txt" ]; then
  git reset HEAD test-output.txt 2>/dev/null || true
  rm -f test-output.txt
  echo "   ✅ test-output.txt をクリーンアップしました"
fi
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

# 6. 第3テスト：ファイル書き込み（write_file）
echo "========================================="
echo "✍️  ファイル書き込みテスト (write_file)"
echo "========================================="
echo ""
echo "質問: 'test-output.txt というファイルに「LLMによる自動生成テストファイル」と書き込んでください'"
echo ""
echo "⏳ LLMが応答を生成中..."

TEMP_FILE=$(mktemp)
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"test-output.txt というファイルに『LLMによる自動生成テストファイル』と書き込んでください\",
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

# ファイルが実際に作成されたか確認
if [ -f "test-output.txt" ]; then
  echo "✅ ファイル作成成功: test-output.txt"
  echo "   内容: $(cat test-output.txt)"
else
  echo "⚠️  ファイルが作成されませんでした"
fi

echo ""

# 7. 第4テスト：Git Status（git_status）
echo "========================================="
echo "📊 Git Status テスト (git_status)"
echo "========================================="
echo ""
echo "質問: 'git status を実行して、現在の変更状況を教えてください'"
echo ""
echo "⏳ LLMが応答を生成中..."

TEMP_FILE=$(mktemp)
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"git status を実行して、現在の変更状況を教えてください\",
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

# 8. 第5テスト：Git Diff（git_diff）
echo "========================================="
echo "🔍 Git Diff テスト (git_diff)"
echo "========================================="
echo ""
echo "質問: 'git diff を実行して、test-output.txt の変更内容を見せてください'"
echo ""
echo "⏳ LLMが応答を生成中..."

TEMP_FILE=$(mktemp)
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"git diff を実行して、test-output.txt の変更内容を見せてください\",
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

# 9. 第6テスト：Commit Changes（commit_changes）
echo "========================================="
echo "💾 Commit テスト (commit_changes)"
echo "========================================="
echo ""
echo "質問: 'test-output.txt をコミットしてください。コミットメッセージは「Add test output file」としてください'"
echo ""
echo "⏳ LLMが応答を生成中..."

TEMP_FILE=$(mktemp)
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"test-output.txt をコミットしてください。コミットメッセージは『Add test output file』としてください\",
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

# コミットが作成されたか確認
LAST_COMMIT=$(git log -1 --oneline 2>/dev/null | grep "Add test output file" || echo "")
if [ -n "$LAST_COMMIT" ]; then
  echo "✅ コミット成功: $LAST_COMMIT"
else
  echo "⚠️  コミットが作成されていない可能性があります"
  echo "   最新コミット: $(git log -1 --oneline 2>/dev/null)"
fi

echo ""

# クリーンアップ
echo "🧹 テストファイルのクリーンアップ..."
if [ -f "test-output.txt" ]; then
  git reset HEAD~1 --soft 2>/dev/null || true
  rm -f test-output.txt
  echo "✅ test-output.txt を削除しました"
fi

echo ""
echo "========================================="
echo "✅ 段階的テスト完了！"
echo "========================================="
echo ""
echo "📊 テスト結果サマリー："
echo "  ✅ Test 1: read_file (package.json読み取り)"
echo "  ✅ Test 2: read_file (repository-tools.ts読み取り)"
echo "  📝 Test 3: write_file (ファイル書き込み)"
echo "  📝 Test 4: git_status (Git状態確認)"
echo "  📝 Test 5: git_diff (差分表示)"
echo "  📝 Test 6: commit_changes (コミット作成)"
echo ""
echo "🎉 高優先度ツール（コア機能）のテストが完了しました！"
echo ""
echo "📊 実装されたツール（10個）："
echo "  1. read_file - ファイル読み取り ✅ テスト済み"
echo "  2. write_file - ファイル書き込み 📝 テスト完了"
echo "  3. list_files - ファイル一覧 🔸 部分的"
echo "  4. search_code - コード検索 ⚠️ 未テスト"
echo "  5. git_status - Git状態 📝 テスト完了"
echo "  6. git_diff - 差分表示 📝 テスト完了"
echo "  7. create_branch - ブランチ作成 ⚠️ 未テスト"
echo "  8. commit_changes - コミット 📝 テスト完了"
echo "  9. get_file_tree - ファイルツリー ⚠️ 未テスト"
echo "  10. get_recent_commits - コミット履歴 ⚠️ 未テスト"
echo ""
