/**
 * リポジトリ管理APIルート
 */

import { Router, Request, Response } from 'express';
import {
  createRepository,
  getUserRepositories,
  getRepositoryById,
  updateRepository,
  deleteRepository,
  setSessionRepository,
} from '../../utils/database.js';
import {
  isGitRepository,
  listBranches,
  getCurrentBranch,
  createBranch,
  checkoutBranch,
  getCommitHistory,
  getStatus,
  addFiles,
  commit,
  getDiff,
  getFileTree,
  getFileContent,
  detectPrimaryLanguage,
  GitError,
} from '../../utils/git.js';
import type { ApiError } from '../types.js';

const router = Router();

// ========================================
// リポジトリ管理
// ========================================

/**
 * POST /api/repositories - リポジトリ登録
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const { name, localPath, description, defaultBranch } = req.body;

    if (!name || !localPath) {
      const error: ApiError = {
        error: 'name and localPath are required',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // リポジトリが有効なGitリポジトリかチェック
    const isValid = await isGitRepository(localPath);
    if (!isValid) {
      const error: ApiError = {
        error: 'Invalid Git repository',
        code: 'INVALID_REPOSITORY',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // 言語を検出
    const primaryLanguage = await detectPrimaryLanguage(localPath);

    // リポジトリを登録
    const repoId = createRepository(
      userId,
      name,
      localPath,
      description,
      defaultBranch || 'main',
      primaryLanguage || undefined
    );

    // 登録したリポジトリを取得
    const repository = getRepositoryById(repoId);

    res.status(201).json({ repository });
  } catch (error: any) {
    console.error('Failed to create repository:', error);
    const apiError: ApiError = {
      error: error.message || 'Failed to create repository',
      code: 'CREATE_REPOSITORY_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * GET /api/repositories - ユーザーのリポジトリ一覧
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repositories = getUserRepositories(userId);
    res.json({ repositories });
  } catch (error: any) {
    console.error('Failed to get repositories:', error);
    const apiError: ApiError = {
      error: error.message || 'Failed to get repositories',
      code: 'GET_REPOSITORIES_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * GET /api/repositories/:id - リポジトリ詳細
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repoId = parseInt(req.params.id, 10);
    const repository = getRepositoryById(repoId);

    if (!repository) {
      const error: ApiError = {
        error: 'Repository not found',
        code: 'REPOSITORY_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    // 所有権チェック
    if (repository.user_id !== userId) {
      const error: ApiError = {
        error: 'Forbidden',
        code: 'FORBIDDEN',
        statusCode: 403,
      };
      res.status(403).json(error);
      return;
    }

    res.json({ repository });
  } catch (error: any) {
    console.error('Failed to get repository:', error);
    const apiError: ApiError = {
      error: error.message || 'Failed to get repository',
      code: 'GET_REPOSITORY_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * PUT /api/repositories/:id - リポジトリ更新
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repoId = parseInt(req.params.id, 10);
    const repository = getRepositoryById(repoId);

    if (!repository) {
      const error: ApiError = {
        error: 'Repository not found',
        code: 'REPOSITORY_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    // 所有権チェック
    if (repository.user_id !== userId) {
      const error: ApiError = {
        error: 'Forbidden',
        code: 'FORBIDDEN',
        statusCode: 403,
      };
      res.status(403).json(error);
      return;
    }

    const { name, description, default_branch, primary_language } = req.body;

    const updated = updateRepository(repoId, {
      name,
      description,
      default_branch,
      primary_language,
    });

    if (!updated) {
      const error: ApiError = {
        error: 'No changes made',
        code: 'NO_CHANGES',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    const updatedRepo = getRepositoryById(repoId);
    res.json({ repository: updatedRepo });
  } catch (error: any) {
    console.error('Failed to update repository:', error);
    const apiError: ApiError = {
      error: error.message || 'Failed to update repository',
      code: 'UPDATE_REPOSITORY_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * DELETE /api/repositories/:id - リポジトリ削除
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repoId = parseInt(req.params.id, 10);
    const repository = getRepositoryById(repoId);

    if (!repository) {
      const error: ApiError = {
        error: 'Repository not found',
        code: 'REPOSITORY_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    // 所有権チェック
    if (repository.user_id !== userId) {
      const error: ApiError = {
        error: 'Forbidden',
        code: 'FORBIDDEN',
        statusCode: 403,
      };
      res.status(403).json(error);
      return;
    }

    deleteRepository(repoId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete repository:', error);
    const apiError: ApiError = {
      error: error.message || 'Failed to delete repository',
      code: 'DELETE_REPOSITORY_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

// ========================================
// ブランチ操作
// ========================================

/**
 * GET /api/repositories/:id/branches - ブランチ一覧
 */
router.get('/:id/branches', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repoId = parseInt(req.params.id, 10);
    const repository = getRepositoryById(repoId);

    if (!repository || repository.user_id !== userId) {
      const error: ApiError = {
        error: 'Repository not found',
        code: 'REPOSITORY_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const branches = await listBranches(repository.local_path);
    res.json({ branches });
  } catch (error: any) {
    if (error instanceof GitError) {
      const apiError: ApiError = {
        error: error.message,
        code: error.code,
        statusCode: 500,
      };
      res.status(500).json(apiError);
      return;
    }

    console.error('Failed to list branches:', error);
    const apiError: ApiError = {
      error: 'Failed to list branches',
      code: 'LIST_BRANCHES_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * GET /api/repositories/:id/branches/current - 現在のブランチ
 */
router.get('/:id/branches/current', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repoId = parseInt(req.params.id, 10);
    const repository = getRepositoryById(repoId);

    if (!repository || repository.user_id !== userId) {
      const error: ApiError = {
        error: 'Repository not found',
        code: 'REPOSITORY_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const branch = await getCurrentBranch(repository.local_path);
    res.json({ branch });
  } catch (error: any) {
    if (error instanceof GitError) {
      const apiError: ApiError = {
        error: error.message,
        code: error.code,
        statusCode: 500,
      };
      res.status(500).json(apiError);
      return;
    }

    console.error('Failed to get current branch:', error);
    const apiError: ApiError = {
      error: 'Failed to get current branch',
      code: 'GET_CURRENT_BRANCH_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * POST /api/repositories/:id/branches - ブランチ作成
 */
router.post('/:id/branches', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repoId = parseInt(req.params.id, 10);
    const repository = getRepositoryById(repoId);

    if (!repository || repository.user_id !== userId) {
      const error: ApiError = {
        error: 'Repository not found',
        code: 'REPOSITORY_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const { branchName, fromBranch } = req.body;

    if (!branchName) {
      const error: ApiError = {
        error: 'branchName is required',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    await createBranch(repository.local_path, branchName, fromBranch);
    const currentBranch = await getCurrentBranch(repository.local_path);

    res.status(201).json({ success: true, branch: currentBranch });
  } catch (error: any) {
    if (error instanceof GitError) {
      const apiError: ApiError = {
        error: error.message,
        code: error.code,
        statusCode: 400,
      };
      res.status(400).json(apiError);
      return;
    }

    console.error('Failed to create branch:', error);
    const apiError: ApiError = {
      error: 'Failed to create branch',
      code: 'CREATE_BRANCH_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * PUT /api/repositories/:id/branches/checkout - ブランチ切り替え
 */
router.put('/:id/branches/checkout', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repoId = parseInt(req.params.id, 10);
    const repository = getRepositoryById(repoId);

    if (!repository || repository.user_id !== userId) {
      const error: ApiError = {
        error: 'Repository not found',
        code: 'REPOSITORY_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const { branchName } = req.body;

    if (!branchName) {
      const error: ApiError = {
        error: 'branchName is required',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    await checkoutBranch(repository.local_path, branchName);
    const currentBranch = await getCurrentBranch(repository.local_path);

    res.json({ success: true, branch: currentBranch });
  } catch (error: any) {
    if (error instanceof GitError) {
      const apiError: ApiError = {
        error: error.message,
        code: error.code,
        statusCode: 400,
      };
      res.status(400).json(apiError);
      return;
    }

    console.error('Failed to checkout branch:', error);
    const apiError: ApiError = {
      error: 'Failed to checkout branch',
      code: 'CHECKOUT_BRANCH_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

// ========================================
// ファイル操作
// ========================================

/**
 * GET /api/repositories/:id/tree - ファイルツリー取得
 */
router.get('/:id/tree', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repoId = parseInt(req.params.id, 10);
    const repository = getRepositoryById(repoId);

    if (!repository || repository.user_id !== userId) {
      const error: ApiError = {
        error: 'Repository not found',
        code: 'REPOSITORY_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const subPath = (req.query.path as string) || '';
    const tree = await getFileTree(repository.local_path, subPath);

    res.json({ tree });
  } catch (error: any) {
    if (error instanceof GitError) {
      const apiError: ApiError = {
        error: error.message,
        code: error.code,
        statusCode: 404,
      };
      res.status(404).json(apiError);
      return;
    }

    console.error('Failed to get file tree:', error);
    const apiError: ApiError = {
      error: 'Failed to get file tree',
      code: 'GET_FILE_TREE_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * GET /api/repositories/:id/files - ファイル内容取得
 */
router.get('/:id/files', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repoId = parseInt(req.params.id, 10);
    const repository = getRepositoryById(repoId);

    if (!repository || repository.user_id !== userId) {
      const error: ApiError = {
        error: 'Repository not found',
        code: 'REPOSITORY_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const filePath = req.query.path as string;

    if (!filePath) {
      const error: ApiError = {
        error: 'path query parameter is required',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    const content = getFileContent(repository.local_path, filePath);
    res.json({ path: filePath, content });
  } catch (error: any) {
    if (error instanceof GitError) {
      const apiError: ApiError = {
        error: error.message,
        code: error.code,
        statusCode: 404,
      };
      res.status(404).json(apiError);
      return;
    }

    console.error('Failed to get file content:', error);
    const apiError: ApiError = {
      error: 'Failed to get file content',
      code: 'GET_FILE_CONTENT_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

// ========================================
// Git操作
// ========================================

/**
 * GET /api/repositories/:id/commits - コミット履歴
 */
router.get('/:id/commits', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repoId = parseInt(req.params.id, 10);
    const repository = getRepositoryById(repoId);

    if (!repository || repository.user_id !== userId) {
      const error: ApiError = {
        error: 'Repository not found',
        code: 'REPOSITORY_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const limit = parseInt(req.query.limit as string, 10) || 50;
    const commits = await getCommitHistory(repository.local_path, limit);

    res.json({ commits });
  } catch (error: any) {
    if (error instanceof GitError) {
      const apiError: ApiError = {
        error: error.message,
        code: error.code,
        statusCode: 500,
      };
      res.status(500).json(apiError);
      return;
    }

    console.error('Failed to get commit history:', error);
    const apiError: ApiError = {
      error: 'Failed to get commit history',
      code: 'GET_COMMIT_HISTORY_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * GET /api/repositories/:id/status - Git status
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repoId = parseInt(req.params.id, 10);
    const repository = getRepositoryById(repoId);

    if (!repository || repository.user_id !== userId) {
      const error: ApiError = {
        error: 'Repository not found',
        code: 'REPOSITORY_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const status = await getStatus(repository.local_path);
    res.json({ status });
  } catch (error: any) {
    if (error instanceof GitError) {
      const apiError: ApiError = {
        error: error.message,
        code: error.code,
        statusCode: 500,
      };
      res.status(500).json(apiError);
      return;
    }

    console.error('Failed to get status:', error);
    const apiError: ApiError = {
      error: 'Failed to get status',
      code: 'GET_STATUS_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * GET /api/repositories/:id/diff - 差分表示
 */
router.get('/:id/diff', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repoId = parseInt(req.params.id, 10);
    const repository = getRepositoryById(repoId);

    if (!repository || repository.user_id !== userId) {
      const error: ApiError = {
        error: 'Repository not found',
        code: 'REPOSITORY_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const file = req.query.file as string | undefined;
    const staged = req.query.staged === 'true';

    const diff = await getDiff(repository.local_path, file, staged);
    res.json({ diff });
  } catch (error: any) {
    if (error instanceof GitError) {
      const apiError: ApiError = {
        error: error.message,
        code: error.code,
        statusCode: 500,
      };
      res.status(500).json(apiError);
      return;
    }

    console.error('Failed to get diff:', error);
    const apiError: ApiError = {
      error: 'Failed to get diff',
      code: 'GET_DIFF_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * POST /api/repositories/:id/commit - コミット実行
 */
router.post('/:id/commit', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const error: ApiError = {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    const repoId = parseInt(req.params.id, 10);
    const repository = getRepositoryById(repoId);

    if (!repository || repository.user_id !== userId) {
      const error: ApiError = {
        error: 'Repository not found',
        code: 'REPOSITORY_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const { message, files } = req.body;

    if (!message) {
      const error: ApiError = {
        error: 'message is required',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // ファイルを追加
    if (files && files.length > 0) {
      await addFiles(repository.local_path, files);
    }

    // コミット
    const result = await commit(repository.local_path, message);

    res.json({ success: true, result });
  } catch (error: any) {
    if (error instanceof GitError) {
      const apiError: ApiError = {
        error: error.message,
        code: error.code,
        statusCode: 400,
      };
      res.status(400).json(apiError);
      return;
    }

    console.error('Failed to commit:', error);
    const apiError: ApiError = {
      error: 'Failed to commit',
      code: 'COMMIT_FAILED',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

export default router;
