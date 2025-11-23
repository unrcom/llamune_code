import { Router, Request, Response } from 'express';
import { getSystemSpec } from '../../utils/system.js';
import { checkOllamaStatus } from '../../utils/ollama.js';

const router = Router();

// GET /api/system/spec - システムスペック
router.get('/spec', async (req: Request, res: Response) => {
  try {
    const spec = await getSystemSpec();
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
