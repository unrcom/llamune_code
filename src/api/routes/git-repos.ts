/**
 * Gitリポジトリスキャン用API
 */

import { Router, Request, Response } from 'express';
import { scanGitRepositories } from '../../utils/git-scanner.js';
import { authenticateJWT } from '../middleware/jwt-auth.js';

const router = Router();

/**
 * GET /api/git-repos
 * ローカルのGitリポジトリを検出
 */
router.get('/', authenticateJWT, async (req: Request, res: Response) => {
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

/**
 * GET /api/git-repos/branches
 * 指定されたリポジトリのブランチ一覧を取得
 */
router.get('/branches', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { path } = req.query;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        error: 'Repository path is required',
      });
    }

    const { listBranches } = await import('../../utils/git.js');
    const branches = await listBranches(path);

    res.json({
      branches,
    });
  } catch (error) {
    console.error('Failed to list branches:', error);
    res.status(500).json({
      error: 'Failed to list branches',
    });
  }
});

export default router;
