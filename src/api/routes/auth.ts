/**
 * 認証エンドポイント
 */

import { Router, Request, Response } from 'express';
import {
  getUserByUsername,
  getUserById,
  createUser,
  getAllUsers,
  updateUserPassword,
  deleteUser,
  saveRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
  deleteAllRefreshTokensForUser,
  cleanupExpiredRefreshTokens,
} from '../../utils/database.js';
import { hashPassword, verifyPassword, validatePassword, validateUsername } from '../../utils/password.js';
import { generateTokenPair, getRefreshTokenExpiry, generateAccessToken } from '../../utils/jwt.js';
import { getDeviceInfo } from '../../utils/device.js';
import { authenticateJWT, requireAdmin } from '../middleware/jwt.js';
import {
  loginLimiter,
  registerLimiter,
  passwordChangeLimiter,
} from '../middleware/rateLimit.js';
import type {
  ApiError,
  RegisterRequest,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  LogoutRequest,
  UserResponse,
  ChangePasswordRequest,
} from '../types.js';

const router = Router();

// ========================================
// POST /api/auth/register - ユーザー登録
// ========================================
router.post('/register', registerLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password, role }: RegisterRequest = req.body;

    // バリデーション
    if (!username || !password) {
      const error: ApiError = {
        error: 'Username and password are required',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // ユーザー名の検証
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      const error: ApiError = {
        error: usernameValidation.error!,
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // パスワードの検証
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      const error: ApiError = {
        error: passwordValidation.error!,
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // ユーザー名の重複チェック
    const existingUser = getUserByUsername(username);
    if (existingUser) {
      const error: ApiError = {
        error: 'Username already exists',
        code: 'USER_EXISTS',
        statusCode: 409,
      };
      res.status(409).json(error);
      return;
    }

    // パスワードをハッシュ化
    const passwordHash = await hashPassword(password);

    // ユーザーを作成（roleは管理者のみ指定可能、デフォルトは'user'）
    const userRole = role || 'user';
    const userId = createUser(username, passwordHash, userRole);

    // トークンペアを生成
    const tokens = generateTokenPair({
      userId,
      username,
      role: userRole,
    });

    // リフレッシュトークンをデータベースに保存
    const expiresAt = getRefreshTokenExpiry();
    saveRefreshToken(userId, tokens.refreshToken, expiresAt.toISOString());

    // レスポンス
    const response: LoginResponse = {
      user: {
        id: userId,
        username,
        role: userRole,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Registration error:', error);
    const apiError: ApiError = {
      error: 'Failed to register user',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

// ========================================
// POST /api/auth/login - ログイン
// ========================================
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password }: LoginRequest = req.body;

    // バリデーション
    if (!username || !password) {
      const error: ApiError = {
        error: 'Username and password are required',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // ユーザーを検索
    const user = getUserByUsername(username);
    if (!user) {
      const error: ApiError = {
        error: 'Invalid username or password',
        code: 'INVALID_CREDENTIALS',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    // パスワードを検証
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      const error: ApiError = {
        error: 'Invalid username or password',
        code: 'INVALID_CREDENTIALS',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    // トークンペアを生成
    const tokens = generateTokenPair({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // デバイス情報を取得
    const deviceInfo = getDeviceInfo(req);

    // リフレッシュトークンをデータベースに保存
    const expiresAt = getRefreshTokenExpiry();
    saveRefreshToken(
      user.id,
      tokens.refreshToken,
      expiresAt.toISOString(),
      deviceInfo.fingerprint,
      deviceInfo.type,
      'login'
    );

    // 期限切れトークンをクリーンアップ
    cleanupExpiredRefreshTokens();

    // レスポンス
    const response: LoginResponse = {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Login error:', error);
    const apiError: ApiError = {
      error: 'Failed to login',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

// ========================================
// POST /api/auth/refresh - トークンリフレッシュ
// ========================================
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken }: RefreshTokenRequest = req.body;

    if (!refreshToken) {
      const error: ApiError = {
        error: 'Refresh token is required',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // リフレッシュトークンを検証
    const storedToken = getRefreshToken(refreshToken);
    if (!storedToken) {
      const error: ApiError = {
        error: 'Invalid refresh token',
        code: 'INVALID_TOKEN',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    // 有効期限を確認
    const now = new Date();
    const expiresAt = new Date(storedToken.expires_at);
    if (now > expiresAt) {
      // 期限切れのトークンを削除
      deleteRefreshToken(refreshToken);

      const error: ApiError = {
        error: 'Refresh token expired',
        code: 'TOKEN_EXPIRED',
        statusCode: 401,
      };
      res.status(401).json(error);
      return;
    }

    // ユーザー情報を取得
    const user = getUserById(storedToken.user_id);
    if (!user) {
      const error: ApiError = {
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    // 新しいトークンペアを生成
    const tokens = generateTokenPair({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // 古いリフレッシュトークンを削除
    deleteRefreshToken(refreshToken);

    // デバイス情報を取得
    const deviceInfo = getDeviceInfo(req);

    // 新しいリフレッシュトークンを保存
    const newExpiresAt = getRefreshTokenExpiry();
    saveRefreshToken(
      user.id,
      tokens.refreshToken,
      newExpiresAt.toISOString(),
      deviceInfo.fingerprint,
      deviceInfo.type,
      'refresh'
    );
    
    // レスポンス
    const response: RefreshTokenResponse = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Token refresh error:', error);
    const apiError: ApiError = {
      error: 'Failed to refresh token',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

// ========================================
// POST /api/auth/logout - ログアウト
// ========================================
router.post('/logout', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { refreshToken }: LogoutRequest = req.body;

    if (refreshToken) {
      // リフレッシュトークンを削除
      deleteRefreshToken(refreshToken);
    }

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    const apiError: ApiError = {
      error: 'Failed to logout',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

// ========================================
// GET /api/auth/me - 現在のユーザー情報を取得
// ========================================
router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = getUserById(userId);
    if (!user) {
      const error: ApiError = {
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const response: UserResponse = {
      id: user.id,
      username: user.username,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get user error:', error);
    const apiError: ApiError = {
      error: 'Failed to get user information',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

// ========================================
// POST /api/auth/change-password - パスワード変更
// ========================================
router.post(
  '/change-password',
  authenticateJWT,
  passwordChangeLimiter,
  async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword }: ChangePasswordRequest = req.body;
      const userId = req.user!.userId;

      // バリデーション
      if (!currentPassword || !newPassword) {
        const error: ApiError = {
          error: 'Current password and new password are required',
          code: 'VALIDATION_ERROR',
          statusCode: 400,
        };
        res.status(400).json(error);
        return;
      }

      // 新しいパスワードの検証
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        const error: ApiError = {
          error: passwordValidation.error!,
          code: 'VALIDATION_ERROR',
          statusCode: 400,
        };
        res.status(400).json(error);
        return;
      }

      // ユーザー情報を取得
      const user = getUserById(userId);
      if (!user) {
        const error: ApiError = {
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          statusCode: 404,
        };
        res.status(404).json(error);
        return;
      }

      // 現在のパスワードを検証
      const isValidPassword = await verifyPassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        const error: ApiError = {
          error: 'Current password is incorrect',
          code: 'INVALID_PASSWORD',
          statusCode: 401,
        };
        res.status(401).json(error);
        return;
      }

      // 新しいパスワードをハッシュ化
      const newPasswordHash = await hashPassword(newPassword);

      // パスワードを更新
      const success = updateUserPassword(userId, newPasswordHash);
      if (!success) {
        const error: ApiError = {
          error: 'Failed to update password',
          code: 'UPDATE_FAILED',
          statusCode: 500,
        };
        res.status(500).json(error);
        return;
      }

      // すべてのリフレッシュトークンを削除（再ログインを強制）
      deleteAllRefreshTokensForUser(userId);

      res.status(200).json({ message: 'Password changed successfully. Please login again.' });
    } catch (error) {
      console.error('Change password error:', error);
      const apiError: ApiError = {
        error: 'Failed to change password',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
      };
      res.status(500).json(apiError);
    }
  }
);

// ========================================
// GET /api/auth/users - 全ユーザーを取得（管理者のみ）
// ========================================
router.get('/users', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = getAllUsers();

    // password_hashを除外してレスポンス
    const response = users.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    res.status(200).json({ users: response });
  } catch (error) {
    console.error('Get users error:', error);
    const apiError: ApiError = {
      error: 'Failed to get users',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

// ========================================
// DELETE /api/auth/users/:id - ユーザー削除（管理者のみ）
// ========================================
router.delete('/users/:id', authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const currentUserId = req.user!.userId;

    if (isNaN(userId)) {
      const error: ApiError = {
        error: 'Invalid user ID',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // 自分自身を削除しようとしている
    if (userId === currentUserId) {
      const error: ApiError = {
        error: 'Cannot delete your own account',
        code: 'FORBIDDEN',
        statusCode: 403,
      };
      res.status(403).json(error);
      return;
    }

    // ユーザーを削除
    const success = deleteUser(userId);
    if (!success) {
      const error: ApiError = {
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    const apiError: ApiError = {
      error: 'Failed to delete user',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

export default router;
