import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { authenticateJWT } from './middleware/jwt-auth.js';
import { requestLogger } from './middleware/logger.js';
import { validateJwtConfig } from '../utils/jwt.js';
import modelsRouter from './routes/models.js';
import presetsRouter from './routes/presets.js';
import systemRouter from './routes/system.js';
import chatRouter from './routes/chat.js';
import authRouter from './routes/auth.js';
import domainsRouter from './routes/domains.js';

// package.json を読み込む
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);

// JWT設定を検証
const jwtValidation = validateJwtConfig();
if (!jwtValidation.valid) {
  console.warn('⚠️  JWT Configuration Warnings:');
  jwtValidation.errors.forEach((error) => {
    console.warn(`   - ${error}`);
  });
  console.warn('');
}

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(requestLogger); // リクエスト・レスポンスのロギング

// API メタ情報（認証不要）
app.get('/api', (req, res) => {
  res.json({
    name: 'Llamune API',
    version: packageJson.version,
    description: packageJson.description,
    platform: 'Closed Network LLM Platform',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh',
        me: 'GET /api/auth/me',
        changePassword: 'POST /api/auth/change-password',
        users: 'GET /api/auth/users (admin only)',
        deleteUser: 'DELETE /api/auth/users/:id (admin only)',
      },
      models: {
        list: 'GET /api/models',
        pull: 'POST /api/models/pull',
        delete: 'DELETE /api/models',
        recommended: 'GET /api/models/recommended',
      },
      chat: {
        sendMessage: 'POST /api/chat/messages',
        retry: 'POST /api/chat/retry',
        listSessions: 'GET /api/chat/sessions',
        getSession: 'GET /api/chat/sessions/:id',
        rewind: 'DELETE /api/chat/sessions/:id/rewind',
        switchModel: 'PUT /api/chat/sessions/:id/model',
      },
      system: {
        spec: 'GET /api/system/spec',
        health: 'GET /api/system/health',
      },
      presets: {
        list: 'GET /api/presets',
      },
      domains: {
        list: 'GET /api/domains',
        get: 'GET /api/domains/:id',
        prompts: 'GET /api/domains/:id/prompts',
        getPrompt: 'GET /api/domains/prompts/:id',
      },
    },
    documentation: {
      main: 'https://github.com/unrcom/llamune/blob/main/docs/API_SPECIFICATION.md',
      chat: 'https://github.com/unrcom/llamune/blob/main/docs/API_CHAT_ENDPOINTS.md',
      setup: 'https://github.com/unrcom/llamune/blob/main/docs/SETUP.md',
      auth: 'https://github.com/unrcom/llamune/blob/main/docs/AUTHENTICATION_ARCHITECTURE.md',
    },
    authentication: {
      type: 'JWT Bearer Token',
      header: 'Authorization: Bearer {ACCESS_TOKEN}',
      setup: 'See docs/AUTHENTICATION_ARCHITECTURE.md for configuration',
      endpoints: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
      },
    },
  });
});

// 認証ルート（認証不要）
app.use('/api/auth', authRouter);

// JWT認証ミドルウェアを他のAPIエンドポイントに適用
app.use('/api', authenticateJWT);

// ルーティング
app.use('/api/models', modelsRouter);
app.use('/api/presets', presetsRouter);
app.use('/api/system', systemRouter);
app.use('/api/chat', chatRouter);
app.use('/api/domains', domainsRouter);

// ヘルスチェック（認証不要）
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 Llamune API Server running on http://localhost:${PORT}`);
  console.log(`📝 API Documentation: http://localhost:${PORT}/api`);
});
