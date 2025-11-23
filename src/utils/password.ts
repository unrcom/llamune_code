/**
 * パスワード管理ユーティリティ
 * bcrypt を使用したパスワードのハッシュ化と検証
 */

import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * パスワードをハッシュ化
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * パスワードを検証
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * パスワードの強度を検証
 */
export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  // 最小4文字
  if (password.length < 4) {
    return {
      valid: false,
      error: 'Password must be at least 4 characters',
    };
  }

  // 最大128文字（bcryptの制限）
  if (password.length > 128) {
    return {
      valid: false,
      error: 'Password must be at most 128 characters',
    };
  }

  return { valid: true };
}

/**
 * ユーザー名の検証
 */
export interface UsernameValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUsername(username: string): UsernameValidationResult {
  // 最小3文字
  if (username.length < 3) {
    return {
      valid: false,
      error: 'Username must be at least 3 characters',
    };
  }

  // 最大32文字
  if (username.length > 32) {
    return {
      valid: false,
      error: 'Username must be at most 32 characters',
    };
  }

  // 英数字、ハイフン、アンダースコアのみ
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validPattern.test(username)) {
    return {
      valid: false,
      error: 'Username can only contain letters, numbers, hyphens, and underscores',
    };
  }

  return { valid: true };
}
