/**
 * JWT認証ミドルウェア
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../utils/jwt.js';
import type { ApiError, AuthenticatedUser } from '../types.js';

/**
 * Expressのリクエストを拡張してuserプロパティを追加
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * JWT認証ミドルウェア
 * Authorization: Bearer <token> ヘッダーからJWTを検証
 */
export function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    const error: ApiError = {
      error: 'Authorization header is required',
      code: 'UNAUTHORIZED',
      statusCode: 401,
    };
    res.status(401).json(error);
    return;
  }

  // Bearer トークンを抽出
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    const error: ApiError = {
      error: 'Invalid authorization header format',
      code: 'UNAUTHORIZED',
      statusCode: 401,
    };
    res.status(401).json(error);
    return;
  }

  // JWTを検証
  const payload = verifyAccessToken(token);
  if (!payload) {
    const error: ApiError = {
      error: 'Invalid or expired token',
      code: 'UNAUTHORIZED',
      statusCode: 401,
    };
    res.status(401).json(error);
    return;
  }

  // リクエストにユーザー情報を追加
  req.user = {
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
  };

  next();
}

/**
 * 管理者権限チェックミドルウェア
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    const error: ApiError = {
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
      statusCode: 401,
    };
    res.status(401).json(error);
    return;
  }

  if (req.user.role !== 'admin') {
    const error: ApiError = {
      error: 'Admin privileges required',
      code: 'FORBIDDEN',
      statusCode: 403,
    };
    res.status(403).json(error);
    return;
  }

  next();
}

/**
 * オプショナル認証ミドルウェア
 * トークンがあれば検証するが、なくてもエラーにしない
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    next();
    return;
  }

  const payload = verifyAccessToken(token);
  if (payload) {
    req.user = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    };
  }

  next();
}
