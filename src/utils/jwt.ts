/**
 * JWT管理ユーティリティ
 */

import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import crypto from 'crypto';

// 環境変数から取得（デフォルト値は開発用のみ）
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-this';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

/**
 * JWTペイロードの型定義
 */
export interface JwtPayload {
  userId: number;
  username: string;
  role: 'admin' | 'user';
}

/**
 * トークンペアの型定義
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * アクセストークンを生成
 */
export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY as any,
    issuer: 'llamune-api',
  } as SignOptions);
}

/**
 * リフレッシュトークンを生成（ランダム文字列）
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

/**
 * トークンペアを生成
 */
export function generateTokenPair(payload: JwtPayload): TokenPair {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(),
  };
}

/**
 * アクセストークンを検証
 */
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'llamune-api',
    } as VerifyOptions) as JwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * リフレッシュトークンの有効期限を計算
 */
export function getRefreshTokenExpiry(): Date {
  const now = new Date();

  // JWT_REFRESH_EXPIRY から日数を抽出（例: "7d" -> 7）
  const match = JWT_REFRESH_EXPIRY.match(/^(\d+)d$/);
  const days = match ? parseInt(match[1]) : 7;

  now.setDate(now.getDate() + days);
  return now;
}

/**
 * JWT_SECRETが設定されているか確認
 */
export function isJwtSecretConfigured(): boolean {
  return process.env.JWT_SECRET !== undefined && process.env.JWT_SECRET !== '';
}

/**
 * JWT設定を検証
 */
export function validateJwtConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isJwtSecretConfigured()) {
    errors.push('JWT_SECRET is not configured in environment variables');
  }

  if (JWT_SECRET === 'development-secret-change-this') {
    errors.push('JWT_SECRET is using the default development value. Please change it in production.');
  }

  if (JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET should be at least 32 characters long');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
