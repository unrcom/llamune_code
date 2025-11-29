# バグ修正の動作確認手順

## 修正内容

### 致命的なバグ: repositoryId → repositoryPath

**問題**: `src/core/chat-session.ts` の99行目で、存在しない `this.repositoryId` を参照していた

```typescript
// 修正前（バグ）
if (this.repositoryId) {  // ← repositoryIdプロパティは存在しない
  request.tools = repositoryTools;
}

// 修正後
if (this.repositoryPath) {  // ✅ 正しいプロパティ名
  request.tools = repositoryTools;
}
```

**影響**: リポジトリパスを設定してもツールが一切有効化されず、**LLMはファイル操作やGit操作が全くできない**状態でした。

---

## 動作確認手順（ローカル環境）

### 前提条件

1. **Node.js v22.21.1** がインストールされている
2. **Ollama** がインストールされている
3. **LLMモデル**（gemma2:9b など）がインストールされている

### ステップ1: 環境準備

```bash
cd llamune_code

# 依存関係インストール（初回のみ）
npm install

# データベース初期化（初回のみ）
npx tsx scripts/init-base-db.ts
npx tsx scripts/migrate-add-parameter-presets.ts
npx tsx scripts/migrate-add-session-title.ts
npx tsx scripts/migrate-add-auth.ts
npx tsx scripts/migrate-add-domain-modes.ts
npx tsx scripts/migrate-add-app-dev-domain.ts
npx tsx scripts/migrate-remove-repositories.ts

# 管理ユーザー作成（初回のみ）
npx tsx scripts/setup-admin.ts
```

### ステップ2: サービス起動

**ターミナル1: Ollama**
```bash
ollama serve
```

**ターミナル2: APIサーバー**
```bash
npm run api
```

### ステップ3: 簡易テスト実行

**ターミナル3: テストスクリプト**
```bash
./scripts/test-bug-fix.sh
```

### 期待される出力

```
=========================================
🧪 repositoryPath バグ修正の動作確認
=========================================

📋 前提条件チェック...

✅ APIサーバー起動中 (Port 3000)
✅ Ollama起動中 (Port 11434)
✅ 利用可能なモデル: gemma2:9b, ...

=========================================
🔬 テスト実行
=========================================

1️⃣  管理者ログイン中...
✅ ログイン成功

2️⃣  Gitリポジトリスキャン...
✅ 検出されたリポジトリ: 1 個
   パス: /path/to/llamune_code
   名前: llamune_code

3️⃣  使用モデル: gemma2:9b

=========================================
🤖 ツール呼び出しテスト
=========================================

質問: 'package.jsonを読んで、プロジェクト名を教えてください'

⏳ LLMが応答を生成中（repositoryPathが正しく設定されているか確認）...

📊 LLMの応答:
---
package.jsonを読み取りました。プロジェクト名は「llamune」です。
---

🔍 デバッグログを確認（ツールが有効化されているか）:
✅ ツールが有効化されています
[DEBUG] Tools enabled, repository path: /path/to/llamune_code

=========================================
✅ テスト完了
=========================================
```

---

## 詳細テスト（全10ツール）

全てのツールをテストする場合：

```bash
./scripts/test-tool-calling.sh
```

このスクリプトは以下をテストします：

1. ✅ **read_file** - package.json読み取り
2. ✅ **read_file** - repository-tools.ts読み取り
3. ✅ **write_file** - ファイル書き込み
4. ✅ **git_status** - Git状態確認
5. ✅ **git_diff** - 差分表示
6. ✅ **commit_changes** - コミット作成
7. ✅ **list_files** - ファイル一覧
8. ✅ **search_code** - コード検索
9. ✅ **get_file_tree** - ファイルツリー
10. ✅ **get_recent_commits** - コミット履歴

---

## トラブルシューティング

### ❌ "Tools enabled" が表示されない

**原因**: repositoryPathが設定されていない

**確認方法**:
```bash
# APIリクエストにrepositoryPathが含まれているか確認
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "test",
    "modelName": "gemma2:9b",
    "repositoryPath": "/path/to/repo",  # ← これが必須
    "workingBranch": "main"
  }'
```

### ❌ LLMがファイルを読めない

**原因1**: ツールが有効化されていない
- 上記の確認方法で repositoryPath を確認

**原因2**: パスが間違っている
```bash
# 正しいリポジトリパスを確認
pwd
```

**原因3**: Ollamaのモデルがツール呼び出しに対応していない
```bash
# ツール対応モデルを使用
ollama pull gemma2:9b      # 推奨
ollama pull qwen2.5:14b    # 推奨
ollama pull llama3.1:8b    # 対応
```

---

## コードレベルでの確認

```bash
# repositoryPath が正しく使われているか
grep -n "this.repositoryPath" src/core/chat-session.ts

# 期待される出力:
# 53:    this.repositoryPath = repositoryPath;
# 99:      if (this.repositoryPath) {
# 102:          console.log('[DEBUG] Tools enabled, repository path:', this.repositoryPath);
# 206:                      this.repositoryPath!,
# 456:    this.repositoryPath = repositoryPath;

# TypeScriptビルドエラーがないか確認
npm run build
```

---

## 次のステップ

修正が確認できたら：

1. ✅ バグ修正完了
2. 🚀 Web UIでの動作確認
3. 📝 他の機能の開発継続

---

**最終更新**: 2025-11-29
**修正コミット**: b9a031a
