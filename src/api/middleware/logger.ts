/**
 * API リクエスト・レスポンスロギングミドルウェア
 */

import { Request, Response, NextFunction } from 'express';

/**
 * リクエスト・レスポンスをログ出力するミドルウェア
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // リクエスト情報をログ出力
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📨 ${req.method} ${req.url}`);
  console.log(`⏰ ${new Date().toISOString()}`);

  // クエリパラメータがある場合
  if (Object.keys(req.query).length > 0) {
    console.log(`🔍 Query:`, req.query);
  }

  // リクエストヘッダー（Authorization はマスク）
  const headers = { ...req.headers };
  if (headers.authorization) {
    const authHeader = headers.authorization as string;
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      headers.authorization = `Bearer ${token.substring(0, 10)}...(masked)`;
    }
  }
  if (headers.cookie) {
    headers.cookie = headers.cookie.substring(0, 50) + '...(masked)';
  }
  console.log(`📋 Headers: ${JSON.stringify(headers)}`);

  // リクエストボディ（パスワードはマスク）
  if (req.body && Object.keys(req.body).length > 0) {
    const body = { ...req.body };
    if (body.password) {
      body.password = '***masked***';
    }
    if (body.refreshToken) {
      body.refreshToken = `${body.refreshToken.substring(0, 10)}...(masked)`;
    }
    console.log(`📦 Body: ${JSON.stringify(body)}`);
  }

  // レスポンス情報をログ出力するために res.json をフック
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const duration = Date.now() - startTime;

    console.log('');
    console.log(`📤 Response: ${res.statusCode} ${res.statusMessage || ''}`);
    console.log(`⏱️  Duration: ${duration}ms`);

    // レスポンスボディ（トークンはマスク）
    if (body) {
      const responseBody = JSON.parse(JSON.stringify(body));
      if (responseBody.accessToken) {
        responseBody.accessToken = `${responseBody.accessToken.substring(0, 10)}...(masked)`;
      }
      if (responseBody.refreshToken) {
        responseBody.refreshToken = `${responseBody.refreshToken.substring(0, 10)}...(masked)`;
      }
      console.log(`📦 Response Body: ${JSON.stringify(responseBody)}`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    return originalJson(body);
  };

  // レスポンスが終了したときのログ（res.json が呼ばれなかった場合用）
  res.on('finish', () => {
    if (!res.headersSent) {
      return;
    }

    // res.json が呼ばれていない場合（SSE など）
    if (res.getHeader('Content-Type')?.toString().includes('text/event-stream')) {
      const duration = Date.now() - startTime;
      console.log('');
      console.log(`📤 Response: ${res.statusCode} (SSE Stream)`);
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    }
  });

  next();
}
