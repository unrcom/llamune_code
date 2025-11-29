#!/bin/bash
# 修正後の動作確認テスト

set -e

echo "========================================="
echo "🧪 repositoryPath バグ修正の動作確認"
echo "========================================="
echo ""

# 前提条件チェック
echo "📋 前提条件チェック..."
echo ""

# 1. APIサーバーが起動しているか
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/system/info 2>/dev/null || echo "000")
if [ "$API_STATUS" = "401" ] || [ "$API_STATUS" = "200" ]; then
  echo "✅ APIサーバー起動中 (Port 3000)"
else
  echo "❌ APIサーバーが起動していません"
  echo "   起動方法: npm run api"
  exit 1
fi

# 2. Ollamaが起動しているか
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "❌ Ollamaが起動していません"
  echo "   起動方法: ollama serve"
  exit 1
fi
echo "✅ Ollama起動中 (Port 11434)"

# 3. モデルが存在するか
MODEL_COUNT=$(curl -s http://localhost:11434/api/tags 2>/dev/null | jq '.models | length' 2>/dev/null || echo "0")
if [ "$MODEL_COUNT" = "0" ]; then
  echo "❌ Ollamaモデルがインストールされていません"
  echo "   インストール方法: ollama pull gemma2:9b"
  exit 1
fi
AVAILABLE_MODELS=$(curl -s http://localhost:11434/api/tags | jq -r '.models[].name' | head -3 | tr '\n' ', ')
echo "✅ 利用可能なモデル: $AVAILABLE_MODELS"
echo ""

# テスト開始
echo "========================================="
echo "🔬 テスト実行"
echo "========================================="
echo ""

# 管理者ログイン
echo "1️⃣  管理者ログイン中..."
LOGIN_RESPONSE=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -s)

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken // empty')

if [ -z "$TOKEN" ]; then
  echo "❌ ログイン失敗"
  echo "   管理ユーザーを作成してください: npx tsx scripts/setup-admin.ts"
  exit 1
fi
echo "✅ ログイン成功"
echo ""

# リポジトリスキャン（修正後のAPI）
echo "2️⃣  Gitリポジトリスキャン..."
REPOS=$(curl -s http://localhost:3000/api/git-repos \
  -H "Authorization: Bearer $TOKEN")

REPO_COUNT=$(echo "$REPOS" | jq '.repositories | length' 2>/dev/null || echo "0")
echo "✅ 検出されたリポジトリ: $REPO_COUNT 個"

if [ "$REPO_COUNT" = "0" ]; then
  echo "⚠️  リポジトリが検出されませんでした"
  REPO_PATH="$(pwd)"
else
  REPO_PATH=$(echo "$REPOS" | jq -r '.repositories[0].path')
  REPO_NAME=$(echo "$REPOS" | jq -r '.repositories[0].name')
  echo "   パス: $REPO_PATH"
  echo "   名前: $REPO_NAME"
fi
echo ""

# モデル選択
MODEL_NAME=$(curl -s http://localhost:11434/api/tags | jq -r '.models[0].name')
echo "3️⃣  使用モデル: $MODEL_NAME"
echo ""

# ツール呼び出しテスト
echo "========================================="
echo "🤖 ツール呼び出しテスト"
echo "========================================="
echo ""
echo "質問: 'package.jsonを読んで、プロジェクト名を教えてください'"
echo ""
echo "⏳ LLMが応答を生成中（repositoryPathが正しく設定されているか確認）..."
echo ""

# DEBUG_TOOL_CALLING=true で実行して、ツールが有効化されているか確認
TEMP_FILE=$(mktemp)
DEBUG_TOOL_CALLING=true curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"package.jsonを読んで、プロジェクト名を教えてください\",
    \"modelName\": \"$MODEL_NAME\",
    \"repositoryPath\": \"$REPO_PATH\",
    \"workingBranch\": \"main\"
  }" \
  -N 2>&1 | tee /tmp/llm_response.log | while IFS= read -r line; do
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
echo "📊 LLMの応答:"
echo "---"
cat "$TEMP_FILE"
echo ""
echo "---"
rm -f "$TEMP_FILE"

echo ""
echo "🔍 デバッグログを確認（ツールが有効化されているか）:"
if grep -q "Tools enabled, repository path:" /tmp/llm_response.log 2>/dev/null; then
  echo "✅ ツールが有効化されています"
  grep "Tools enabled" /tmp/llm_response.log | head -1
else
  echo "⚠️  ツールが有効化されていない可能性があります"
  echo "   repositoryPath が正しく設定されているか確認してください"
fi

echo ""
echo "========================================="
echo "✅ テスト完了"
echo "========================================="
echo ""
echo "📝 確認事項:"
echo "  1. ツールが有効化されている"
echo "  2. LLMがファイルを読み取れている"
echo "  3. エラーが発生していない"
echo ""
