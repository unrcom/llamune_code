# Llamune セットアップガイド

## 初期セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. APIキーの設定

**重要**: APIキーファイルは `.gitignore` に含まれており、リポジトリにコミットされません。

```bash
# テンプレートファイルをコピー
cp config/api-keys.json.example config/api-keys.json

# APIキーを編集（必ず変更してください）
# エディタで config/api-keys.json を開き、キーを変更
```

**APIキーの生成方法:**

セキュアなランダム文字列を生成してください：

```bash
# Linuxの場合
openssl rand -base64 32

# または
uuidgen

# 生成された文字列の前に "sk_llamune_" を付けて使用
# 例: sk_llamune_AbCd1234EfGh5678IjKl9012MnOp3456
```

`config/api-keys.json` の例：

```json
{
  "enabled": true,
  "keys": [
    {
      "key": "sk_llamune_AbCd1234EfGh5678IjKl9012MnOp3456",
      "name": "Production Key",
      "description": "本番環境用APIキー",
      "createdAt": "2025-01-17T00:00:00Z"
    }
  ]
}
```

### 3. データベースの初期化

```bash
# パラメータプリセットテーブルを作成
npm run migrate:presets

# データベースの状態を確認
npm run check-db
```

### 4. ビルド

```bash
npm run build
```

### 5. APIサーバーの起動

```bash
# 開発モード
npm run api

# または本番モード
npm run api:build
```

サーバーが起動すると、以下のメッセージが表示されます：

```
🚀 Llamune API Server running on http://localhost:3000
📝 API Documentation: http://localhost:3000/api
```

### 6. 動作確認

```bash
# ヘルスチェック（認証不要）
curl http://localhost:3000/health

# システムスペック（認証あり）
curl -H "Authorization: Bearer sk_llamune_YOUR_API_KEY" \
  http://localhost:3000/api/system/spec
```

---

## セキュリティベストプラクティス

### APIキー管理

1. **デフォルトキーを使用しない**
   - `sk_llamune_default_key_change_this` は絶対に使用しないでください
   - 必ず独自のランダムなキーを生成してください

2. **APIキーをコミットしない**
   - `config/api-keys.json` は `.gitignore` に含まれています
   - 絶対にリポジトリにコミットしないでください

3. **環境ごとに異なるキーを使用**
   - 開発環境、ステージング環境、本番環境で別々のキーを使用

4. **定期的にキーをローテーション**
   - セキュリティ向上のため、定期的にキーを変更してください

5. **キーの保管**
   - パスワードマネージャーなど、安全な場所に保管してください

### HTTPS使用

本番環境では必ずHTTPSを使用してください：

```bash
# リバースプロキシ（nginx等）を使用する例
server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### CORS設定

本番環境では適切なオリジンを設定してください：

`src/api/server.ts` を編集：

```typescript
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

---

## トラブルシューティング

### ポート3000が既に使用されている

環境変数でポートを変更できます：

```bash
PORT=8080 npm run api
```

### APIキーファイルが見つからない

```bash
cp config/api-keys.json.example config/api-keys.json
```

### データベースエラー

```bash
# データベースを削除して再作成
rm ~/.llamune/history.db
npm run migrate:presets
```

### Ollamaに接続できない

1. Ollamaが起動しているか確認: `ollama list`
2. Ollamaのポートを確認（デフォルト: 11434）
3. ファイアウォール設定を確認

---

## 次のステップ

- [API仕様書](./API_SPECIFICATION.md) を参照してAPIを使い始める
- [データベース設計書](./database.md) でデータ構造を理解する
- [API実装ガイド](../API_IMPLEMENTATION_GUIDE.md) で拡張方法を学ぶ
