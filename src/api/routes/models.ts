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
router.get('/recommended', async (req: Request, res: Response) => {
  try {
    const spec = await getSystemSpec();
    const recommended = getRecommendedModels(spec);
    res.json({ spec, recommended });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR', statusCode: 500 });
  }
});

export default router;
