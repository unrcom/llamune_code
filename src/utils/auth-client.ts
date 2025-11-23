/**
 * CLI認証クライアントユーティリティ
 * トークンの保存、読み込み、削除を管理
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const AUTH_FILE = join(homedir(), '.llamune', 'auth.json');
const API_BASE_URL = process.env.LLAMUNE_API_URL || 'http://localhost:3000';

/**
 * 保存するトークン情報
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
}

/**
 * トークンをファイルに保存
 */
export function saveAuthTokens(tokens: AuthTokens): void {
  try {
    writeFileSync(AUTH_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save auth tokens: ${error}`);
  }
}

/**
 * トークンをファイルから読み込み
 */
export function loadAuthTokens(): AuthTokens | null {
  try {
    if (!existsSync(AUTH_FILE)) {
      return null;
    }
    const content = readFileSync(AUTH_FILE, 'utf-8');
    return JSON.parse(content) as AuthTokens;
  } catch (error) {
    return null;
  }
}

/**
 * トークンファイルを削除
 */
export function deleteAuthTokens(): void {
  try {
    if (existsSync(AUTH_FILE)) {
      unlinkSync(AUTH_FILE);
    }
  } catch (error) {
    throw new Error(`Failed to delete auth tokens: ${error}`);
  }
}

/**
 * ログインしているかチェック
 */
export function isLoggedIn(): boolean {
  return loadAuthTokens() !== null;
}

/**
 * Authorizationヘッダーを取得
 */
export function getAuthHeaders(): Record<string, string> {
  const tokens = loadAuthTokens();
  if (!tokens) {
    throw new Error('Not logged in. Please run: llamune login');
  }
  return {
    'Authorization': `Bearer ${tokens.accessToken}`,
  };
}

/**
 * トークンをリフレッシュして保存
 */
export async function refreshAndSaveToken(): Promise<AuthTokens> {
  const tokens = loadAuthTokens();
  if (!tokens) {
    throw new Error('Not logged in. Please run: llamune login');
  }

  try {
    // リフレッシュトークンで新しいトークンペアを取得
    const newTokens = await refreshTokenApi(tokens.refreshToken);

    // 新しいトークンを保存
    const updatedTokens: AuthTokens = {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      user: tokens.user, // ユーザー情報は保持
    };
    saveAuthTokens(updatedTokens);

    return updatedTokens;
  } catch (error) {
    // リフレッシュ失敗時はトークンを削除
    deleteAuthTokens();
    throw new Error('Token refresh failed. Please login again: llamune login');
  }
}

/**
 * API fetch with automatic token refresh on 401
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // 最初のリクエスト
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...getAuthHeaders(),
    },
  });

  // 401 エラーの場合、トークンをリフレッシュしてリトライ
  if (response.status === 401) {
    try {
      await refreshAndSaveToken();

      // リトライ
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...getAuthHeaders(),
        },
      });
    } catch (error) {
      // リフレッシュ失敗時はそのまま 401 レスポンスを返す
      throw error;
    }
  }

  return response;
}

/**
 * ユーザー登録API呼び出し
 */
export async function registerApi(
  username: string,
  password: string,
  role: 'admin' | 'user' = 'user'
): Promise<AuthTokens> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data = await response.json();
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to connect to API server');
  }
}

/**
 * ログインAPI呼び出し
 */
export async function loginApi(username: string, password: string): Promise<AuthTokens> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to connect to API server');
  }
}

/**
 * ログアウトAPI呼び出し
 */
export async function logoutApi(refreshToken: string, accessToken: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (error) {
    // ログアウトAPIが失敗してもローカルのトークンは削除する
    console.warn('Warning: Failed to logout from server');
  }
}

/**
 * ユーザー情報取得API呼び出し
 */
export async function getMeApi(accessToken: string): Promise<{
  id: number;
  username: string;
  role: string;
  created_at: string;
  updated_at: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get user info');
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to connect to API server');
  }
}

/**
 * トークンリフレッシュAPI呼び出し
 */
export async function refreshTokenApi(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Token refresh failed');
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to connect to API server');
  }
}
