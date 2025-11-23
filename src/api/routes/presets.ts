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
