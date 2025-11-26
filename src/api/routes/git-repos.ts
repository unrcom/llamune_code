/**
 * Gitリポジトリスキャン用API
 */

import { Router, Request, Response } from 'express';
import { scanGitRepositories } from '../../utils/git-scanner.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/git-repos
 * ローカルのGitリポジトリを検出
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const repos = scanGitRepositories();

    res.json({
      repositories: repos,
    });
  } catch (error) {
    console.error('Failed to scan git repositories:', error);
    res.status(500).json({
      error: 'Failed to scan repositories',
    });
  }
});

export default router;
