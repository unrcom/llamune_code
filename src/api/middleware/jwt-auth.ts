/**
 * JWT認証ミドルウェア
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../../utils/jwt.js';
import type { ApiError } from '../types.js';

// Requestを拡張してuserプロパティを追加
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * JWT認証ミドルウェア
 * Authorization: Bearer <JWT_TOKEN> 形式のヘッダーを検証
 */
export function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Authorization ヘッダーを確認
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
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error: ApiError = {
      error: 'Invalid authorization header format. Expected: Bearer <token>',
      code: 'UNAUTHORIZED',
      statusCode: 401,
    };
    res.status(401).json(error);
    return;
  }

  const token = match[1];

  // JWTトークンを検証
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

  // 認証成功 - ユーザー情報をリクエストに添付
  req.user = payload;
  next();
}

/**
 * 管理者権限チェックミドルウェア
 * authenticateJWT の後に使用すること
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
      error: 'Admin access required',
      code: 'FORBIDDEN',
      statusCode: 403,
    };
    res.status(403).json(error);
    return;
  }

  next();
}
