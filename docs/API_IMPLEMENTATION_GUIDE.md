# Llamune API 実装ガイド

## 実装完了済み

✅ 依存関係インストール (express, cors, @types/express, @types/cors)
✅ Ollama モデル削除機能 (`src/utils/ollama.ts`: `deleteModel`)
✅ CLI `rm` コマンド (`src/index.ts`)
✅ プロジェクト構造作成
✅ APIキー設定ファイル (`config/api-keys.json`)
✅ 認証ミドルウェア (`src/api/middleware/auth.ts`)
✅ コアビジネスロジック (`src/core/chat-session.ts`)
✅ API型定義 (`src/api/types.ts`)

## 残りの実装タスク

### 1. APIルーティング実装

#### `src/api/routes/models.ts`
```typescript
import { Router, Request, Response } from 'express';
import { listModels, pullModel, deleteModel, OllamaError } from '../../utils/ollama.js';
import { getSystemSpec, getRecommendedModels } from '../../utils/system.js';
import type { ApiError, PullModelRequest, DeleteModelRequest } from '../types.js';

const router = Router();

// GET /api/models - モデル一覧
router.get('/', async (req: Request, res: Response) => {
  try {
    const models = await listModels();
    res.json({ models });
  } catch (error) {
    if (error instanceof OllamaError) {
      const apiError: ApiError = {
        error: error.message,
        code: 'OLLAMA_ERROR',
        statusCode: 500,
      };
      res.status(500).json(apiError);
    } else {
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR', statusCode: 500 });
    }
  }
});

// POST /api/models/pull - モデルダウンロード
router.post('/pull', async (req: Request, res: Response) => {
  try {
    const { modelName } = req.body as PullModelRequest;
    if (!modelName) {
      const apiError: ApiError = {
        error: 'modelName is required',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(apiError);
      return;
    }

    await pullModel(modelName);
    res.json({ success: true, modelName });
  } catch (error) {
    if (error instanceof OllamaError) {
      const apiError: ApiError = {
        error: error.message,
        code: 'OLLAMA_ERROR',
        statusCode: 500,
      };
      res.status(500).json(apiError);
    } else {
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR', statusCode: 500 });
    }
  }
});

// DELETE /api/models - モデル削除
router.delete('/', async (req: Request, res: Response) => {
  try {
    const { modelName } = req.body as DeleteModelRequest;
    if (!modelName) {
      const apiError: ApiError = {
        error: 'modelName is required',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(apiError);
      return;
    }

    await deleteModel(modelName);
    res.json({ success: true, modelName });
  } catch (error) {
    if (error instanceof OllamaError) {
      const apiError: ApiError = {
        error: error.message,
        code: 'OLLAMA_ERROR',
        statusCode: 500,
      };
      res.status(500).json(apiError);
    } else {
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR', statusCode: 500 });
    }
  }
});

// GET /api/models/recommended - 推奨モデル
router.get('/recommended', (req: Request, res: Response) => {
  try {
    const spec = getSystemSpec();
    const recommended = getRecommendedModels(spec);
    res.json({ spec, recommended });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR', statusCode: 500 });
  }
});

export default router;
```

#### `src/api/routes/presets.ts`
```typescript
import { Router, Request, Response } from 'express';
import { getAllParameterPresets } from '../../utils/database.js';

const router = Router();

// GET /api/presets - プリセット一覧
router.get('/', (req: Request, res: Response) => {
  try {
    const presets = getAllParameterPresets();
    res.json({ presets });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR', statusCode: 500 });
  }
});

export default router;
```

#### `src/api/routes/system.ts`
```typescript
import { Router, Request, Response } from 'express';
import { getSystemSpec } from '../../utils/system.js';
import { checkOllamaStatus } from '../../utils/ollama.js';

const router = Router();

// GET /api/system/spec - システムスペック
router.get('/spec', (req: Request, res: Response) => {
  try {
    const spec = getSystemSpec();
    res.json(spec);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR', statusCode: 500 });
  }
});

// GET /api/system/health - ヘルスチェック
router.get('/health', async (req: Request, res: Response) => {
  const ollamaRunning = await checkOllamaStatus();
  res.json({
    status: 'ok',
    ollama: ollamaRunning ? 'running' : 'stopped',
  });
});

export default router;
```

### 2. APIサーバー実装

#### `src/api/server.ts`
```typescript
import express from 'express';
import cors from 'cors';
import { authenticate } from './middleware/auth.js';
import modelsRouter from './routes/models.js';
import presetsRouter from './routes/presets.js';
import systemRouter from './routes/system.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(express.json());

// 認証ミドルウェアを全エンドポイントに適用
app.use('/api', authenticate);

// ルーティング
app.use('/api/models', modelsRouter);
app.use('/api/presets', presetsRouter);
app.use('/api/system', systemRouter);

// ヘルスチェック（認証不要）
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 Llamune API Server running on http://localhost:${PORT}`);
  console.log(`📝 API Documentation: http://localhost:${PORT}/api`);
});
```

### 3. package.json にスクリプト追加
```json
{
  "scripts": {
    ...
    "api": "tsx src/api/server.ts",
    "api:build": "tsc && node dist/api/server.js"
  }
}
```

### 4. ビルドとテスト
```bash
npm run build
npm run api  # APIサーバー起動
```

### 5. テスト方法
```bash
# ヘルスチェック
curl http://localhost:3000/health

# モデル一覧（認証あり）
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/models

# プリセット一覧
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/presets

# システムスペック
curl -H "Authorization: Bearer sk_llamune_default_key_change_this" \
  http://localhost:3000/api/system/spec
```

## 注意事項

1. **APIキーの変更**: `config/api-keys.json` のデフォルトキーを必ず変更してください
2. **CORS設定**: 本番環境では適切なオリジンを設定してください
3. **エラーハンドリング**: 各エンドポイントで適切にエラーをハンドリングしています
4. **ストリーミング**: チャット関連のストリーミング実装は複雑なため、まずは基本的なエンドポイントから実装することを推奨

## 次のステップ

1. 上記ファイルを作成
2. `npm run build` でビルド
3. `npm run api` でAPIサーバー起動
4. curlやPostmanでテスト
5. チャット関連のストリーミングエンドポイントを追加実装（オプション）
