import { Router, Request, Response } from 'express';
import {
  getAllDomainModes,
  getDomainModeById,
  getDomainPromptsByDomainId,
  getDomainPromptById,
} from '../../utils/database.js';

const router = Router();

/**
 * GET /api/domains
 * ドメインモード一覧を取得
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const domains = getAllDomainModes();
    res.json({ domains });
  } catch (error) {
    console.error('Error fetching domain modes:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    });
  }
});

/**
 * GET /api/domains/:id
 * 特定のドメインモードを取得
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        error: 'Invalid domain ID',
        code: 'INVALID_DOMAIN_ID',
        statusCode: 400,
      });
    }

    const domain = getDomainModeById(id);

    if (!domain) {
      return res.status(404).json({
        error: 'Domain not found',
        code: 'DOMAIN_NOT_FOUND',
        statusCode: 404,
      });
    }

    res.json({ domain });
  } catch (error) {
    console.error('Error fetching domain mode:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    });
  }
});

/**
 * GET /api/domains/:id/prompts
 * 特定のドメインモードのプロンプト一覧を取得
 */
router.get('/:id/prompts', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        error: 'Invalid domain ID',
        code: 'INVALID_DOMAIN_ID',
        statusCode: 400,
      });
    }

    // ドメインが存在するか確認
    const domain = getDomainModeById(id);
    if (!domain) {
      return res.status(404).json({
        error: 'Domain not found',
        code: 'DOMAIN_NOT_FOUND',
        statusCode: 404,
      });
    }

    const prompts = getDomainPromptsByDomainId(id);
    res.json({ prompts });
  } catch (error) {
    console.error('Error fetching domain prompts:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    });
  }
});

/**
 * GET /api/domain-prompts/:id
 * 特定のドメインプロンプトを取得
 */
router.get('/prompts/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        error: 'Invalid prompt ID',
        code: 'INVALID_PROMPT_ID',
        statusCode: 400,
      });
    }

    const prompt = getDomainPromptById(id);

    if (!prompt) {
      return res.status(404).json({
        error: 'Prompt not found',
        code: 'PROMPT_NOT_FOUND',
        statusCode: 404,
      });
    }

    res.json({ prompt });
  } catch (error) {
    console.error('Error fetching domain prompt:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    });
  }
});

export default router;
