# Llamune Web UI

LlamuneのWebインターフェースです。既存のExpress APIサーバーと連携して動作します。

## 技術スタック

- **フロントエンド**: React 18 + TypeScript
- **ビルドツール**: Vite
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand
- **Markdown表示**: react-markdown

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. APIサーバーの起動

別のターミナルで、親ディレクトリのAPIサーバーを起動してください：

```bash
cd ..
node src/api/server.js
```

APIサーバーは `http://localhost:3000` で起動します。

### 3. Web UIの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開いてください。

## 機能

### 実装済み

- ✅ **チャットUI**: メッセージの送受信
- ✅ **SSEストリーミング**: リアルタイムでLLMの応答を表示
- ✅ **セッション管理**: 会話履歴の保存・読み込み
- ✅ **Markdown表示**: レスポンスをMarkdownでレンダリング
- ✅ **ダークモード対応**: システム設定に自動適応

### 今後の実装予定

- ⏳ パラメータ調整UI (Temperature, Top-P, etc.)
- ⏳ モデル切り替え
- ⏳ リトライ機能
- ⏳ 会話の巻き戻し

## API認証

現在、APIリクエストには以下のヘッダーが必要です：

```
Authorization: Bearer your-api-key-here
```

API Key の設定方法については、親ディレクトリの `docs/SETUP.md` を参照してください。

## 開発

### ビルド

```bash
npm run build
```

ビルド成果物は `dist/` ディレクトリに生成されます。

### プレビュー

```bash
npm run preview
```

### リント

```bash
npm run lint
```

## ディレクトリ構造

```
web/
├── src/
│   ├── components/       # UIコンポーネント
│   │   ├── Chat/        # チャット関連
│   │   ├── Session/     # セッション管理
│   │   └── Settings/    # 設定（未実装）
│   ├── hooks/           # カスタムフック
│   │   └── useChat.ts   # チャット操作
│   ├── store/           # Zustand状態管理
│   │   └── chatStore.ts # チャット状態
│   ├── types/           # TypeScript型定義
│   │   └── index.ts     # 共通型
│   ├── utils/           # ユーティリティ
│   │   └── api.ts       # API通信
│   ├── App.tsx          # メインアプリ
│   └── main.tsx         # エントリーポイント
├── public/              # 静的ファイル
├── index.html           # HTMLテンプレート
├── vite.config.ts       # Vite設定
├── tailwind.config.js   # Tailwind設定
└── package.json         # 依存関係
```

## トラブルシューティング

### APIサーバーに接続できない

1. APIサーバーが起動しているか確認
   ```bash
   curl http://localhost:3000/api
   ```

2. プロキシ設定を確認 (`vite.config.ts`)
   ```typescript
   server: {
     proxy: {
       '/api': 'http://localhost:3000'
     }
   }
   ```

### セッション一覧が表示されない

APIキーが正しく設定されているか確認してください。
`src/utils/api.ts` の `Authorization` ヘッダーを確認してください。

## ライセンス

MIT
