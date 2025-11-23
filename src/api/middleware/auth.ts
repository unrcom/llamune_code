/**
 * 認証ミドルウェア
 */

import { Request, Response, NextFunction } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ApiKeysConfig, ApiError } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let apiKeysConfig: ApiKeysConfig | null = null;

/**
 * APIキー設定を読み込む
 */
function loadApiKeysConfig(): ApiKeysConfig {
  if (apiKeysConfig) {
    return apiKeysConfig;
  }

  try {
    const configPath = join(__dirname, '../../../config/api-keys.json');
    const configContent = readFileSync(configPath, 'utf-8');
    apiKeysConfig = JSON.parse(configContent) as ApiKeysConfig;
    return apiKeysConfig;
  } catch (error) {
    console.warn('⚠️  APIキー設定ファイルが見つかりません。認証を無効化します。');
    return {
      enabled: false,
      keys: [],
    };
  }
}

/**
 * 認証ミドルウェア
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const config = loadApiKeysConfig();

  // 認証が無効の場合はスキップ
  if (!config.enabled) {
    next();
    return;
  }

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

  // トークンを検証
  const validKey = config.keys.find((k) => k.key === token);
  if (!validKey) {
    const error: ApiError = {
      error: 'Invalid API key',
      code: 'UNAUTHORIZED',
      statusCode: 401,
    };
    res.status(401).json(error);
    return;
  }

  // 認証成功
  (req as any).apiKey = validKey;
  next();
}
