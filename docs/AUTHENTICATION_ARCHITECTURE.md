# Llamune 認証・認可アーキテクチャ設計書

## 目次
1. [現状分析](#1-現状分析)
2. [要件定義](#2-要件定義)
3. [アーキテクチャ提案](#3-アーキテクチャ提案)
4. [推奨アプローチ](#4-推奨アプローチ)
5. [実装計画](#5-実装計画)
6. [セキュリティ考慮事項](#6-セキュリティ考慮事項)
7. [マイグレーション戦略](#7-マイグレーション戦略)

---

## 1. 現状分析

### 現在の認証実装

```typescript
// src/api/middleware/auth.ts
// - API Keyベースの簡易認証
// - config/api-keys.json から静的キーを読み込み
// - ユーザーの概念なし
```

**問題点**:
- ✗ ユーザー管理機能がない
- ✗ セッションが誰のものか識別できない
- ✗ 複数ユーザーが同時に使用すると、全員の会話が混在
- ✗ アクセス制御（認可）の仕組みがない
- ✗ CLI での認証方法が未定義

### 現在のデータベーススキーマ

```sql
-- sessions: ユーザーIDなし
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT
);

-- messages: ユーザーIDなし
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  model TEXT,
  deleted_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

---

## 2. 要件定義

### 機能要件

1. **ユーザー認証**
   - ユーザー登録（username + password）
   - ログイン/ログアウト
   - パスワード変更
   - セッショントークン管理

2. **ユーザー管理**
   - ユーザー一覧表示（管理者のみ）
   - ユーザー削除（管理者のみ）
   - ロール管理（admin, user）

3. **セッション分離**
   - 各ユーザーは自分のセッションのみアクセス可能
   - 他ユーザーのセッションは参照・変更不可

4. **CLI認証**
   - `llamune login` コマンド
   - トークンをローカルファイルに保存
   - `llamune logout` でトークン削除

5. **API認証**
   - JWT または Session Cookie
   - Web アプリとの統合

### 非機能要件

1. **セキュリティ**
   - パスワードのハッシュ化（bcrypt, argon2）
   - トークンの有効期限管理
   - CSRF対策（必要に応じて）
   - Rate limiting（ブルートフォース対策）

2. **ユーザビリティ**
   - CLI、API、Webアプリで統一された認証体験
   - トークン自動リフレッシュ
   - Remember me 機能（オプション）

3. **パフォーマンス**
   - トークン検証の高速化
   - データベースクエリの最適化

4. **互換性**
   - 既存データの移行（シングルユーザーモード対応）
   - 段階的な導入が可能

---

## 3. アーキテクチャ提案

### 提案A: JWT + bcrypt（推奨）

**特徴**: ステートレス、スケーラブル、クローズドネットワーク対応

```
┌─────────────┐
│   Client    │
│ (CLI/Web)   │
└──────┬──────┘
       │ 1. POST /api/auth/login
       │    { username, password }
       ▼
┌─────────────────────────────┐
│  API Server                 │
│  ┌─────────────────────┐   │
│  │ POST /auth/login    │   │
│  │ - Verify password   │   │
│  │ - Generate JWT      │   │
│  └─────────────────────┘   │
│           │                 │
│           ▼                 │
│  ┌─────────────────────┐   │
│  │ JWT Middleware      │   │
│  │ - Verify signature  │   │
│  │ - Extract user_id   │   │
│  │ - Set req.user      │   │
│  └─────────────────────┘   │
└──────────┬──────────────────┘
           │
           ▼
    ┌──────────────┐
    │   Database   │
    │  ┌────────┐  │
    │  │ users  │  │
    │  └────────┘  │
    └──────────────┘
```

#### データベーススキーマ

```sql
-- ユーザーテーブル
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'admin' or 'user'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- セッションテーブル（user_id 追加）
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- リフレッシュトークンテーブル（オプション）
CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 技術スタック

- **パスワードハッシュ化**: `bcrypt` (npmパッケージ: `bcrypt` or `bcryptjs`)
- **JWT**: `jsonwebtoken`
- **トークン有効期限**:
  - Access Token: 15分〜1時間
  - Refresh Token: 7日〜30日

#### メリット

✅ ステートレス（サーバー側でセッション管理不要）
✅ 拡張性が高い（将来的に複数サーバーに対応可能）
✅ トークンに任意のクレーム（user_id, role）を含められる
✅ クローズドネットワークでも動作
✅ 業界標準のアプローチ

#### デメリット

✗ トークン無効化が難しい（ログアウト時の対応）
✗ JWTのサイズが大きい（ヘッダーに含めると通信量増加）
✗ 実装が若干複雑

---

### 提案B: Session + Cookie

**特徴**: シンプル、サーバー側で完全制御

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. POST /api/auth/login
       │    { username, password }
       ▼
┌─────────────────────────────┐
│  API Server                 │
│  ┌─────────────────────┐   │
│  │ POST /auth/login    │   │
│  │ - Verify password   │   │
│  │ - Create session    │   │
│  │ - Set cookie        │   │
│  └─────────────────────┘   │
│           │                 │
│           ▼                 │
│  ┌─────────────────────┐   │
│  │ Session Middleware  │   │
│  │ - Verify session_id │   │
│  │ - Load user from DB │   │
│  │ - Set req.user      │   │
│  └─────────────────────┘   │
└──────────┬──────────────────┘
           │
           ▼
    ┌──────────────┐
    │   Database   │
    │  ┌────────┐  │
    │  │ users  │  │
    │  │sessions│  │
    │  └────────┘  │
    └──────────────┘
```

#### データベーススキーマ

```sql
-- ユーザーテーブル
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 認証セッションテーブル（新規）
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY, -- セッションID（UUID）
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- チャットセッションテーブル（user_id 追加）
CREATE TABLE chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 技術スタック

- **セッション管理**: `express-session`
- **セッションストア**: `better-sqlite3-session-store`（SQLiteに保存）
- **パスワードハッシュ化**: `bcrypt`

#### メリット

✅ 実装がシンプル
✅ セッションの即座な無効化が可能（ログアウト、強制ログアウト）
✅ サーバー側で完全制御
✅ デバッグしやすい

#### デメリット

✗ スケーラビリティに制限（セッションストアが単一障害点）
✗ ステートフル（サーバー側でセッション管理が必要）
✗ CLIとの統合がやや複雑（Cookieを扱う必要がある）

---

### 提案C: ハイブリッド（JWT + セッションテーブル）

**特徴**: JWTの利便性とセッション管理の柔軟性を両立

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. POST /api/auth/login
       │    { username, password }
       ▼
┌─────────────────────────────┐
│  API Server                 │
│  ┌─────────────────────┐   │
│  │ POST /auth/login    │   │
│  │ - Verify password   │   │
│  │ - Create session DB │   │
│  │ - Generate JWT      │   │
│  │   (session_id in it)│   │
│  └─────────────────────┘   │
│           │                 │
│           ▼                 │
│  ┌─────────────────────┐   │
│  │ JWT Middleware      │   │
│  │ - Verify JWT        │   │
│  │ - Check session DB  │◄──┼── セッション無効化可能
│  │ - Set req.user      │   │
│  └─────────────────────┘   │
└──────────┬──────────────────┘
           │
           ▼
    ┌──────────────┐
    │   Database   │
    │  ┌────────┐  │
    │  │ users  │  │
    │  │sessions│  │
    │  └────────┘  │
    └──────────────┘
```

#### データベーススキーマ

```sql
-- ユーザーテーブル
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 認証セッションテーブル（JWT管理用）
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY, -- セッションID（UUID）
  user_id INTEGER NOT NULL,
  jwt_token TEXT, -- JWTのハッシュ（オプション）
  expires_at TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- チャットセッションテーブル（user_id 追加）
CREATE TABLE chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### メリット

✅ JWTのステートレス性
✅ セッションの即座な無効化が可能
✅ ロングポーリング、WebSocketにも対応しやすい
✅ 監査ログを残せる（セッションテーブルに記録）

#### デメリット

✗ 実装の複雑性が最も高い
✗ データベースアクセスが増える（パフォーマンスへの影響）

---

## 4. 推奨アプローチ

### 🏆 推奨: **提案A（JWT + bcrypt）**

**理由**:
1. **シンプルさと拡張性のバランス**: Llamuneの現状に最適
2. **CLI統合が容易**: JWTトークンをファイルに保存するだけ
3. **クローズドネットワーク対応**: インターネット接続不要
4. **業界標準**: 多くのAPIで採用されている実績
5. **将来の拡張性**: 複数サーバー、マイクロサービス化も可能

**トークン無効化問題の対処**:
- Refresh Token ローテーション方式を採用
- ログアウト時にRefresh Tokenをデータベースから削除
- Access Tokenは短命（15分）にして自然失効を待つ
- 必要に応じて「ブラックリスト」テーブルを追加可能

---

## 5. 実装計画

### Phase 1: データベーススキーマ拡張

#### 1.1 マイグレーションスクリプト

```bash
scripts/migrations/001_add_users_and_auth.sql
```

```sql
-- ユーザーテーブル作成
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- sessions テーブルに user_id 追加
ALTER TABLE sessions ADD COLUMN user_id INTEGER REFERENCES users(id);

-- リフレッシュトークンテーブル
CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
```

#### 1.2 既存データの移行

```sql
-- デフォルトユーザーを作成
INSERT INTO users (username, password_hash, role, created_at, updated_at)
VALUES ('admin', '<bcrypt_hash>', 'admin', datetime('now'), datetime('now'));

-- 既存セッションをデフォルトユーザーに紐付け
UPDATE sessions SET user_id = 1 WHERE user_id IS NULL;
```

### Phase 2: API実装

#### 2.1 認証エンドポイント

**ファイル構成**:
```
src/api/
├── routes/
│   └── auth.ts          # 新規
├── middleware/
│   ├── auth.ts          # 既存（拡張）
│   └── jwt.ts           # 新規
└── utils/
    ├── jwt.ts           # 新規
    └── password.ts      # 新規
```

**エンドポイント**:
```typescript
// POST /api/auth/register
{
  username: string;
  password: string;
}

// POST /api/auth/login
{
  username: string;
  password: string;
}
// Response:
{
  user: { id, username, role },
  accessToken: string,
  refreshToken: string
}

// POST /api/auth/refresh
{
  refreshToken: string
}
// Response:
{
  accessToken: string,
  refreshToken: string
}

// POST /api/auth/logout
{
  refreshToken: string
}

// GET /api/auth/me (認証必須)
// Response:
{
  id: number,
  username: string,
  role: string
}
```

#### 2.2 JWT ミドルウェア

```typescript
// src/api/middleware/jwt.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}

export function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    (req as any).user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

#### 2.3 パスワード管理

```typescript
// src/api/utils/password.ts
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### Phase 3: CLI実装

#### 3.1 ログイン/ログアウトコマンド

```typescript
// src/commands/login.ts
import { Command } from 'commander';
import readline from 'readline/promises';
import { writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

async function loginCommand() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const username = await rl.question('Username: ');
  const password = await rl.question('Password: ', { hideEchoBack: true });
  rl.close();

  // API にログインリクエスト
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    console.error('❌ Login failed');
    return;
  }

  const { accessToken, refreshToken } = await response.json();

  // トークンをファイルに保存
  const tokenFile = join(homedir(), '.llamune', 'auth.json');
  writeFileSync(tokenFile, JSON.stringify({ accessToken, refreshToken }, null, 2));

  console.log('✅ Logged in successfully');
}

async function logoutCommand() {
  const tokenFile = join(homedir(), '.llamune', 'auth.json');

  try {
    const tokens = JSON.parse(readFileSync(tokenFile, 'utf-8'));

    // サーバーにログアウトリクエスト
    await fetch('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
  } catch (error) {
    // トークンファイルがない場合は無視
  }

  // ローカルのトークンファイルを削除
  if (existsSync(tokenFile)) {
    unlinkSync(tokenFile);
  }

  console.log('✅ Logged out successfully');
}

export function registerAuthCommands(program: Command) {
  program
    .command('login')
    .description('ログインして認証トークンを取得')
    .action(loginCommand);

  program
    .command('logout')
    .description('ログアウトして認証トークンを削除')
    .action(logoutCommand);
}
```

#### 3.2 既存コマンドの拡張

```typescript
// src/utils/auth.ts
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export function getAuthToken(): string | null {
  try {
    const tokenFile = join(homedir(), '.llamune', 'auth.json');
    const tokens = JSON.parse(readFileSync(tokenFile, 'utf-8'));
    return tokens.accessToken;
  } catch (error) {
    return null;
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not logged in. Please run: llamune login');
  }
  return {
    'Authorization': `Bearer ${token}`,
  };
}
```

### Phase 4: Web アプリ実装

#### 4.1 ログイン画面

```typescript
// web/src/components/Auth/LoginForm.tsx
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(username, password);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

#### 4.2 認証ストア

```typescript
// web/src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      login: async (username, password) => {
        const response = await fetch('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        if (!response.ok) throw new Error('Login failed');

        const { user, accessToken, refreshToken } = await response.json();
        set({ user, accessToken, refreshToken });
      },

      logout: async () => {
        const { refreshToken, accessToken } = get();

        if (refreshToken && accessToken) {
          await fetch('http://localhost:3000/api/auth/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ refreshToken }),
          });
        }

        set({ user: null, accessToken: null, refreshToken: null });
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) throw new Error('No refresh token');

        const response = await fetch('http://localhost:3000/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) throw new Error('Token refresh failed');

        const { accessToken, refreshToken: newRefreshToken } = await response.json();
        set({ accessToken, refreshToken: newRefreshToken });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

### Phase 5: セッション分離実装

#### 5.1 ミドルウェアでのフィルタリング

```typescript
// src/api/middleware/ownerCheck.ts
import { Request, Response, NextFunction } from 'express';
import { getSession } from '../../utils/database.js';

export function ensureOwner(req: Request, res: Response, next: NextFunction): void {
  const sessionId = parseInt(req.params.id);
  const userId = (req as any).user.userId;

  const session = getSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (session.session.user_id !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  next();
}
```

#### 5.2 データベースクエリの修正

```typescript
// src/utils/database.ts

// 修正前
export function listSessions(limit = 200): ChatSession[] {
  // ...
}

// 修正後
export function listSessions(userId: number, limit = 200): ChatSession[] {
  const db = initDatabase();

  const sessions = db
    .prepare(`
      SELECT * FROM (
        SELECT
          s.id,
          s.model,
          s.created_at,
          s.updated_at,
          s.title,
          COUNT(m.id) as message_count,
          (
            SELECT content
            FROM messages
            WHERE session_id = s.id AND role = 'user' AND deleted_at IS NULL
            ORDER BY id ASC
            LIMIT 1
          ) as preview
        FROM sessions s
        LEFT JOIN messages m ON s.id = m.session_id AND m.deleted_at IS NULL
        WHERE s.user_id = ?  -- ← 追加
        GROUP BY s.id
        ORDER BY s.created_at DESC
        LIMIT ?
      ) ORDER BY created_at ASC
    `)
    .all(userId, limit) as ChatSession[];

  db.close();
  return sessions;
}
```

---

## 6. セキュリティ考慮事項

### 6.1 パスワードポリシー

**実装すべきルール**:
- 最小8文字
- 英数字混在を推奨（必須ではない）
- よくあるパスワードのブラックリスト（オプション）

```typescript
// src/api/utils/password.ts
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  // オプション: より厳しいルール
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    return { valid: false, error: 'Password must contain letters and numbers' };
  }

  return { valid: true };
}
```

### 6.2 Rate Limiting

**ブルートフォース攻撃対策**:

```typescript
// src/api/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 5, // 最大5回まで
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
```

```typescript
// src/api/routes/auth.ts
import { loginLimiter } from '../middleware/rateLimit.js';

router.post('/login', loginLimiter, async (req, res) => {
  // ...
});
```

### 6.3 JWT Secret の管理

**環境変数で管理**:

```bash
# .env
JWT_SECRET=<256-bit-random-string>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

**生成方法**:

```bash
# OpenSSL
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 6.4 HTTPS の使用

クローズドネットワークでも、可能であれば自己署名証明書でHTTPSを使用することを推奨。

```typescript
// src/api/server.ts
import https from 'https';
import { readFileSync } from 'fs';

const options = {
  key: readFileSync('./certs/key.pem'),
  cert: readFileSync('./certs/cert.pem'),
};

https.createServer(options, app).listen(3000);
```

### 6.5 XSS/CSRF 対策

- **XSS**: すでにReactで対策済み（自動エスケープ）
- **CSRF**: JWTを使う場合、Cookieではなく`Authorization`ヘッダーで送信するため基本的に不要

---

## 7. マイグレーション戦略

### 7.1 後方互換性の維持

**ステップ1: マイグレーションモード**

```typescript
// src/api/middleware/auth.ts
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // 1. まずJWT認証を試みる
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');

    // JWTトークンかチェック
    if (token.includes('.')) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!);
        (req as any).user = payload;
        next();
        return;
      } catch (error) {
        // JWTが無効な場合、次へ
      }
    }

    // 2. 旧API Key認証を試みる（レガシー対応）
    const config = loadApiKeysConfig();
    if (config.enabled) {
      const validKey = config.keys.find((k) => k.key === token);
      if (validKey) {
        // レガシーモード: デフォルトユーザーとして認証
        (req as any).user = { userId: 1, username: 'legacy', role: 'admin' };
        next();
        return;
      }
    }
  }

  // 3. 認証失敗
  res.status(401).json({ error: 'Authentication required' });
}
```

**ステップ2: デフォルトユーザー作成**

初回起動時に自動的にデフォルトユーザーを作成：

```typescript
// src/utils/database.ts
export async function ensureDefaultUser(): Promise<void> {
  const db = initDatabase();

  const count = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

  if (count.count === 0) {
    const defaultPassword = 'admin'; // 初回パスワード
    const passwordHash = await hashPassword(defaultPassword);

    db.prepare(`
      INSERT INTO users (username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin', passwordHash, 'admin', new Date().toISOString(), new Date().toISOString());

    console.log('⚠️  Default user created:');
    console.log('   Username: admin');
    console.log('   Password: admin');
    console.log('   Please change the password immediately!');
  }

  db.close();
}
```

### 7.2 既存データの移行

```sql
-- scripts/migrations/002_migrate_existing_sessions.sql

-- すべての既存セッションをデフォルトユーザー（admin）に紐付け
UPDATE sessions
SET user_id = (SELECT id FROM users WHERE username = 'admin')
WHERE user_id IS NULL;
```

### 7.3 段階的ロールアウト

1. **Phase 1**: 認証機能を実装（オプション扱い）
2. **Phase 2**: ドキュメント更新、移行ガイド公開
3. **Phase 3**: デフォルトで認証を有効化
4. **Phase 4**: 旧API Key認証を廃止（メジャーバージョンアップ）

---

## 8. 実装チェックリスト

### データベース

- [ ] `users` テーブル作成
- [ ] `refresh_tokens` テーブル作成
- [ ] `sessions` に `user_id` カラム追加
- [ ] マイグレーションスクリプト作成
- [ ] 既存データの移行スクリプト

### API

- [ ] `bcrypt` パッケージインストール
- [ ] `jsonwebtoken` パッケージインストール
- [ ] `/api/auth/register` エンドポイント実装
- [ ] `/api/auth/login` エンドポイント実装
- [ ] `/api/auth/logout` エンドポイント実装
- [ ] `/api/auth/refresh` エンドポイント実装
- [ ] `/api/auth/me` エンドポイント実装
- [ ] JWT ミドルウェア実装
- [ ] Rate limiting ミドルウェア実装
- [ ] Owner check ミドルウェア実装
- [ ] 既存エンドポイントに `user_id` フィルタリング追加

### CLI

- [ ] `llamune login` コマンド実装
- [ ] `llamune logout` コマンド実装
- [ ] `llamune whoami` コマンド実装（現在のユーザー表示）
- [ ] トークンファイル管理機能
- [ ] トークン自動リフレッシュ機能
- [ ] 既存コマンドにトークン送信機能追加

### Web App

- [ ] ログイン画面実装
- [ ] 認証ストア（Zustand）実装
- [ ] トークン自動リフレッシュ機能
- [ ] ログアウト機能
- [ ] Protected Routes 実装
- [ ] APIクライアントにトークン送信機能追加

### ドキュメント

- [ ] 認証仕様書更新
- [ ] API仕様書更新
- [ ] セットアップガイド更新
- [ ] マイグレーションガイド作成
- [ ] セキュリティガイドライン作成

### テスト

- [ ] ユーザー登録のテスト
- [ ] ログイン/ログアウトのテスト
- [ ] トークンリフレッシュのテスト
- [ ] セッション分離のテスト
- [ ] 権限チェックのテスト
- [ ] Rate limiting のテスト

---

## 9. 参考実装

### 環境変数テンプレート

```bash
# .env.example
JWT_SECRET=your-256-bit-secret-here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
API_PORT=3000
```

### npm パッケージ

```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "express-rate-limit": "^7.1.5"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5"
  }
}
```

---

## 10. まとめ

### 推奨アプローチ: **JWT + bcrypt**

1. **ユーザー管理**: `users` テーブルでユーザーを管理
2. **認証**: JWT（Access Token + Refresh Token）
3. **パスワード**: bcrypt でハッシュ化
4. **セッション分離**: `user_id` で各ユーザーのデータを分離
5. **CLI認証**: トークンを `~/.llamune/auth.json` に保存
6. **Web認証**: LocalStorage または SessionStorage にトークン保存

### 実装の優先順位

1. **High Priority**: データベーススキーマ拡張、基本的な認証API
2. **Medium Priority**: CLI統合、Web App統合
3. **Low Priority**: Rate limiting、高度なセキュリティ機能

### セキュリティ

- パスワードは bcrypt でハッシュ化（Salt Rounds: 12）
- JWT Secret は環境変数で管理
- Access Token は短命（15分）
- Refresh Token でトークン更新
- Rate limiting でブルートフォース攻撃を防ぐ

---

**質問・フィードバック**

この設計書について質問やフィードバックがあれば、お気軽にお知らせください。
