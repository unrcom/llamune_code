/**
 * Rate Limiting ミドルウェア
 * ブルートフォース攻撃対策
 */

import rateLimit from 'express-rate-limit';

// 開発環境では制限を緩和
const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * ログインエンドポイント用のRate Limiter
 * 本番: 15分間に5回まで
 * 開発: 15分間に100回まで
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: isDevelopment ? 100 : 5,
  message: {
    error: 'Too many login attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
  // デフォルトでreq.ipを使用（IPv6対応）
});

/**
 * ユーザー登録エンドポイント用のRate Limiter
 * 本番: 1時間に3回まで
 * 開発: 1時間に100回まで
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1時間
  max: isDevelopment ? 100 : 3,
  message: {
    error: 'Too many registration attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * パスワード変更エンドポイント用のRate Limiter
 * 本番: 1時間に5回まで
 * 開発: 1時間に100回まで
 */
export const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1時間
  max: isDevelopment ? 100 : 5,
  message: {
    error: 'Too many password change attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 一般的なAPI用のRate Limiter
 * 本番: 15分間に100回まで
 * 開発: 15分間に1000回まで
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: isDevelopment ? 1000 : 100,
  message: {
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
