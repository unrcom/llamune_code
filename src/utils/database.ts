/**
 * データベース管理ユーティリティ
 * SQLiteを使用して会話履歴を保存
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { ChatMessage } from './ollama.js';

// データベースファイルのパス
const DB_DIR = join(homedir(), '.llamune_code');
const DB_FILE = join(DB_DIR, 'history.db');

/**
 * 会話セッションの型定義
 */
export interface ChatSession {
  id: number;
  model: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string; // 最初のユーザーメッセージのプレビュー
  title: string | null; // セッションのタイトル
}

/**
 * 推奨モデルの型定義
 */
export interface RecommendedModel {
  id: number;
  min_memory_gb: number;
  max_memory_gb: number | null;
  model_name: string;
  model_size: string;
  description: string;
  priority: number;
}

/**
 * パラメータプリセットの型定義
 */
export interface ParameterPreset {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  temperature: number | null;
  top_p: number | null;
  top_k: number | null;
  repeat_penalty: number | null;
  num_ctx: number | null;
  created_at: string;
}

/**
 * ユーザーの型定義
 */
export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

/**
 * リフレッシュトークンの型定義
 */
export interface RefreshToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

/**
 * ドメインモードの型定義
 */
export interface DomainMode {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  enabled: number;
  created_at: string;
}

/**
 * ドメインプロンプトの型定義
 */
export interface DomainPrompt {
  id: number;
  domain_mode_id: number;
  name: string;
  display_name: string;
  description: string | null;
  system_prompt: string | null;
  recommended_model: string | null;
  preset_id: number | null;
  is_default: number;
  created_at: string;
}

/**
 * データベースを初期化
 */
export function initDatabase(): Database.Database {
  // ディレクトリがなければ作成
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_FILE);

  // セッションテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      title TEXT
    )
  `);

  // 既存のテーブルにtitleカラムがなければ追加
  const tableInfo = db.pragma('table_info(sessions)') as { name: string }[];
  const hasTitleColumn = tableInfo.some((col) => col.name === 'title');
  if (!hasTitleColumn) {
    db.exec('ALTER TABLE sessions ADD COLUMN title TEXT');
  }

  // メッセージテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      model TEXT,
      deleted_at TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  // 推奨モデルテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS recommended_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      min_memory_gb INTEGER NOT NULL,
      max_memory_gb INTEGER,
      model_name TEXT NOT NULL,
      model_size TEXT NOT NULL,
      description TEXT NOT NULL,
      priority INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  return db;
}

/**
 * 新しいセッションを作成
 */
export function createSession(model: string): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  const result = db
    .prepare('INSERT INTO sessions (model, created_at, updated_at) VALUES (?, ?, ?)')
    .run(model, now, now);

  db.close();
  return result.lastInsertRowid as number;
}

/**
 * メッセージを保存
 */
export function saveMessage(
  sessionId: number,
  role: string,
  content: string,
  model?: string
): void {
  const db = initDatabase();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO messages (session_id, role, content, created_at, model) VALUES (?, ?, ?, ?, ?)'
  ).run(sessionId, role, content, now, model || null);

  // セッションの更新日時を更新
  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

  // 最初のユーザーメッセージの場合、タイトルを自動設定
  if (role === 'user') {
    const session = db
      .prepare('SELECT title FROM sessions WHERE id = ?')
      .get(sessionId) as { title: string | null } | undefined;

    if (session && !session.title) {
      const title =
        content.length > 30 ? content.substring(0, 30) + '...' : content;
      db.prepare('UPDATE sessions SET title = ? WHERE id = ?').run(title, sessionId);
    }
  }

  db.close();
}

/**
 * 会話全体を保存
 */
export function saveConversation(
  model: string,
  messages: ChatMessage[],
  userId?: number
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  // セッションを作成
  const sessionResult = db
    .prepare('INSERT INTO sessions (model, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(model, userId || null, now, now);

  const sessionId = sessionResult.lastInsertRowid as number;

  // メッセージを一括保存
  const insertMessage = db.prepare(
    'INSERT INTO messages (session_id, role, content, created_at, model) VALUES (?, ?, ?, ?, ?)'
  );

  for (const message of messages) {
    insertMessage.run(sessionId, message.role, message.content, now, message.model || null);
  }

  db.close();
  return sessionId;
}

/**
 * 既存セッションにメッセージを追加
 */
export function appendMessagesToSession(
  sessionId: number,
  messages: ChatMessage[]
): void {
  const db = initDatabase();
  const now = new Date().toISOString();

  // メッセージを一括追加
  const insertMessage = db.prepare(
    'INSERT INTO messages (session_id, role, content, created_at, model) VALUES (?, ?, ?, ?, ?)'
  );

  for (const message of messages) {
    insertMessage.run(sessionId, message.role, message.content, now, message.model || null);
  }

  // セッションの更新日時を更新
  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

  db.close();
}

/**
 * セッション一覧を取得
 */
export function listSessions(limit = 200, userId?: number): ChatSession[] {
  const db = initDatabase();

  let query = `
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
  `;

  if (userId !== undefined) {
    query += `
      WHERE s.user_id = ?
    `;
  }

  query += `
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT ?
    ) ORDER BY created_at ASC
  `;

  const sessions = userId !== undefined
    ? db.prepare(query).all(userId, limit) as ChatSession[]
    : db.prepare(query).all(limit) as ChatSession[];

  db.close();
  return sessions;
}

/**
 * セッションのタイトルを更新
 */
export function updateSessionTitle(sessionId: number, title: string, userId?: number): boolean {
  const db = initDatabase();

  let query = 'UPDATE sessions SET title = ? WHERE id = ?';
  let params: any[] = [title, sessionId];

  if (userId !== undefined) {
    query = 'UPDATE sessions SET title = ? WHERE id = ? AND user_id = ?';
    params = [title, sessionId, userId];
  }

  const result = db.prepare(query).run(...params);

  db.close();
  return result.changes > 0;
}

/**
 * セッションの詳細を取得
 * @param sessionId - セッションID
 * @param userId - ユーザーID（指定された場合、所有者チェックを行う）
 */
export function getSession(sessionId: number, userId?: number): {
  session: ChatSession & { user_id?: number; repository_id?: number; working_branch?: string };
  messages: ChatMessage[];
} | null {
  const db = initDatabase();

  // セッション情報を取得
  const session = db
    .prepare(
      `
      SELECT
        s.id,
        s.model,
        s.user_id,
        s.repository_id,
        s.working_branch,
        s.created_at,
        s.updated_at,
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
      WHERE s.id = ?
      GROUP BY s.id
    `
    )
    .get(sessionId) as (ChatSession & { user_id?: number; repository_id?: number; working_branch?: string }) | undefined;

  if (!session) {
    db.close();
    return null;
  }

  // 所有者チェック（userIdが指定されている場合）
  if (userId !== undefined && session.user_id !== userId) {
    db.close();
    return null;
  }

  // メッセージを取得（論理削除されていないもののみ）
  const messages = db
    .prepare(
      `
      SELECT role, content, model
      FROM messages
      WHERE session_id = ? AND deleted_at IS NULL
      ORDER BY id ASC
    `
    )
    .all(sessionId) as ChatMessage[];

  db.close();

  return {
    session,
    messages,
  };
}

/**
 * デフォルトの推奨モデルを初期化
 */
export function initializeDefaultRecommendedModels(): void {
  const db = initDatabase();

  // 既にデータがあるかチェック
  const count = db
    .prepare('SELECT COUNT(*) as count FROM recommended_models')
    .get() as { count: number };

  if (count.count > 0) {
    // 既にデータがあれば何もしない
    db.close();
    return;
  }

  const now = new Date().toISOString();

  // デフォルトの推奨モデルデータ
  const defaultModels = [
    // 8GB以下
    { min: 0, max: 8, name: 'gemma2:2b', size: '1.6 GB', desc: '軽量で高速。低スペックPCに最適', priority: 1 },
    { min: 0, max: 8, name: 'qwen2.5:3b', size: '2.0 GB', desc: 'コンパクトながら高性能', priority: 2 },
    // 9-16GB
    { min: 9, max: 16, name: 'gemma2:9b', size: '5.4 GB', desc: 'バランス型。品質と速度を両立', priority: 1 },
    { min: 9, max: 16, name: 'qwen2.5:7b', size: '4.7 GB', desc: '日本語性能が高い', priority: 2 },
    // 17GB以上
    { min: 17, max: null, name: 'gemma2:27b', size: '16 GB', desc: '最高性能。複雑なタスクを高精度で処理', priority: 1 },
    { min: 17, max: null, name: 'qwen2.5:14b', size: '8.5 GB', desc: '高性能。日本語処理に優れる', priority: 2 },
    { min: 17, max: null, name: 'deepseek-r1:7b', size: '4.7 GB', desc: '推論特化。思考プロセスを表示', priority: 3 },
  ];

  const insert = db.prepare(
    'INSERT INTO recommended_models (min_memory_gb, max_memory_gb, model_name, model_size, description, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  for (const model of defaultModels) {
    insert.run(
      model.min,
      model.max,
      model.name,
      model.size,
      model.desc,
      model.priority,
      now
    );
  }

  db.close();
}

/**
 * システムメモリに基づいて推奨モデルを取得
 */
export function getRecommendedModelsByMemory(memoryGB: number): RecommendedModel[] {
  const db = initDatabase();

  const models = db
    .prepare(
      `
      SELECT *
      FROM recommended_models
      WHERE min_memory_gb <= ?
        AND (max_memory_gb IS NULL OR max_memory_gb >= ?)
      ORDER BY priority ASC
    `
    )
    .all(memoryGB, memoryGB) as RecommendedModel[];

  db.close();
  return models;
}

/**
 * すべての推奨モデルを取得
 */
export function getAllRecommendedModels(): RecommendedModel[] {
  const db = initDatabase();

  const models = db
    .prepare(
      `
      SELECT *
      FROM recommended_models
      ORDER BY min_memory_gb ASC, priority ASC
    `
    )
    .all() as RecommendedModel[];

  db.close();
  return models;
}

/**
 * メッセージを往復単位で取得（IDと共に）
 */
export interface MessageWithId extends ChatMessage {
  id: number;
}

export interface MessageTurn {
  turnNumber: number;
  user: MessageWithId;
  assistant: MessageWithId;
}

export function getSessionMessagesWithTurns(sessionId: number): MessageTurn[] {
  const db = initDatabase();

  // 論理削除されていないメッセージを取得
  const messages = db
    .prepare(
      `
      SELECT id, role, content, model
      FROM messages
      WHERE session_id = ? AND deleted_at IS NULL
      ORDER BY id ASC
    `
    )
    .all(sessionId) as MessageWithId[];

  db.close();

  // user-assistant のペアに変換
  const turns: MessageTurn[] = [];
  for (let i = 0; i < messages.length; i += 2) {
    if (i + 1 < messages.length && messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
      turns.push({
        turnNumber: Math.floor(i / 2) + 1,
        user: messages[i],
        assistant: messages[i + 1],
      });
    }
  }

  return turns;
}

/**
 * 指定した往復番号以降のメッセージを論理削除
 */
export function logicalDeleteMessagesAfterTurn(sessionId: number, turnNumber: number): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  // 論理削除されていないメッセージを取得
  const messages = db
    .prepare(
      `
      SELECT id
      FROM messages
      WHERE session_id = ? AND deleted_at IS NULL
      ORDER BY id ASC
    `
    )
    .all(sessionId) as Array<{ id: number }>;

  // 削除するメッセージのIDを計算（往復番号 * 2 以降）
  const deleteFromIndex = turnNumber * 2;
  const messageIdsToDelete = messages.slice(deleteFromIndex).map((m) => m.id);

  if (messageIdsToDelete.length === 0) {
    db.close();
    return 0;
  }

  // 論理削除を実行
  const placeholders = messageIdsToDelete.map(() => '?').join(',');
  const result = db
    .prepare(`UPDATE messages SET deleted_at = ? WHERE id IN (${placeholders})`)
    .run(now, ...messageIdsToDelete);

  // セッションの更新日時を更新
  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

  db.close();
  return result.changes;
}

/**
 * すべてのパラメータプリセットを取得
 */
export function getAllParameterPresets(): ParameterPreset[] {
  const db = initDatabase();

  const presets = db
    .prepare(
      `
      SELECT *
      FROM parameter_presets
      ORDER BY id ASC
    `
    )
    .all() as ParameterPreset[];

  db.close();
  return presets;
}

/**
 * 名前でパラメータプリセットを取得
 */
export function getParameterPresetByName(name: string): ParameterPreset | null {
  const db = initDatabase();

  const preset = db
    .prepare(
      `
      SELECT *
      FROM parameter_presets
      WHERE name = ?
    `
    )
    .get(name) as ParameterPreset | undefined;

  db.close();
  return preset || null;
}

/**
 * IDでパラメータプリセットを取得
 */
export function getParameterPresetById(id: number): ParameterPreset | null {
  const db = initDatabase();

  const preset = db
    .prepare(
      `
      SELECT *
      FROM parameter_presets
      WHERE id = ?
    `
    )
    .get(id) as ParameterPreset | undefined;

  db.close();
  return preset || null;
}

/**
 * すべてのセッションを取得（プレビュー付き）
 * @param userId - ユーザーID（指定された場合、そのユーザーのセッションのみ取得）
 */
export function getAllSessions(userId?: number): ChatSession[] {
  const db = initDatabase();

  let query = `
    SELECT
      s.id,
      s.model,
      s.created_at,
      s.title,
      COUNT(m.id) as message_count,
      (SELECT content FROM messages WHERE session_id = s.id AND role = 'user' AND deleted_at IS NULL ORDER BY id ASC LIMIT 1) as preview
    FROM sessions s
    LEFT JOIN messages m ON s.id = m.session_id AND m.deleted_at IS NULL
  `;

  if (userId !== undefined) {
    query += ` WHERE s.user_id = ?`;
  }

  query += `
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `;

  const sessions = userId !== undefined
    ? db.prepare(query).all(userId) as ChatSession[]
    : db.prepare(query).all() as ChatSession[];

  db.close();
  return sessions;
}

/**
 * セッションのモデルを更新
 */
export function updateSessionModel(sessionId: number, modelName: string): boolean {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare('UPDATE sessions SET model = ?, updated_at = ? WHERE id = ?')
      .run(modelName, now, sessionId);

    db.close();
    return result.changes > 0;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * セッションを削除
 */
export function deleteSession(sessionId: number, userId?: number): boolean {
  const db = initDatabase();

  try {
    // ユーザー所有権チェック
    if (userId !== undefined) {
      const session = db
        .prepare('SELECT user_id FROM sessions WHERE id = ?')
        .get(sessionId) as { user_id?: number } | undefined;

      if (!session || session.user_id !== userId) {
        db.close();
        return false; // セッションが存在しないか、所有者ではない
      }
    }

    // メッセージを削除
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);

    // セッションを削除
    const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);

    db.close();
    return result.changes > 0;
  } catch (error) {
    db.close();
    throw error;
  }
}

// ========================================
// ユーザー管理
// ========================================

/**
 * ユーザーを作成
 */
export function createUser(
  username: string,
  passwordHash: string,
  role: 'admin' | 'user' = 'user'
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare(
        'INSERT INTO users (username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(username, passwordHash, role, now, now);

    db.close();
    return result.lastInsertRowid as number;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * ユーザー名でユーザーを取得
 */
export function getUserByUsername(username: string): User | null {
  const db = initDatabase();

  try {
    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as User | undefined;

    db.close();
    return user || null;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * IDでユーザーを取得
 */
export function getUserById(userId: number): User | null {
  const db = initDatabase();

  try {
    const user = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as User | undefined;

    db.close();
    return user || null;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * すべてのユーザーを取得（管理者用）
 */
export function getAllUsers(): User[] {
  const db = initDatabase();

  try {
    const users = db
      .prepare('SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at DESC')
      .all() as User[];

    db.close();
    return users;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * ユーザーのパスワードを更新
 */
export function updateUserPassword(userId: number, newPasswordHash: string): boolean {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(newPasswordHash, now, userId);

    db.close();
    return result.changes > 0;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * ユーザーを削除
 */
export function deleteUser(userId: number): boolean {
  const db = initDatabase();

  try {
    // カスケード削除により、関連するsessions, refresh_tokensも削除される
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    db.close();
    return result.changes > 0;
  } catch (error) {
    db.close();
    throw error;
  }
}

// ========================================
// リフレッシュトークン管理
// ========================================

/**
 * リフレッシュトークンを保存
 */
export function saveRefreshToken(
  userId: number,
  token: string,
  expiresAt: string
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare(
        'INSERT INTO refresh_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)'
      )
      .run(userId, token, expiresAt, now);

    db.close();
    return result.lastInsertRowid as number;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * リフレッシュトークンを取得
 */
export function getRefreshToken(token: string): RefreshToken | null {
  const db = initDatabase();

  try {
    const refreshToken = db
      .prepare('SELECT * FROM refresh_tokens WHERE token = ?')
      .get(token) as RefreshToken | undefined;

    db.close();
    return refreshToken || null;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * ユーザーのリフレッシュトークンを削除
 */
export function deleteRefreshToken(token: string): boolean {
  const db = initDatabase();

  try {
    const result = db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token);

    db.close();
    return result.changes > 0;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * ユーザーのすべてのリフレッシュトークンを削除
 */
export function deleteAllRefreshTokensForUser(userId: number): number {
  const db = initDatabase();

  try {
    const result = db
      .prepare('DELETE FROM refresh_tokens WHERE user_id = ?')
      .run(userId);

    db.close();
    return result.changes;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * 期限切れのリフレッシュトークンを削除
 */
export function cleanupExpiredRefreshTokens(): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare('DELETE FROM refresh_tokens WHERE expires_at < ?')
      .run(now);

    db.close();
    return result.changes;
  } catch (error) {
    db.close();
    throw error;
  }
}

// ========================================
// ドメインモード管理
// ========================================

/**
 * すべてのドメインモードを取得
 */
export function getAllDomainModes(): DomainMode[] {
  const db = initDatabase();

  try {
    const domainModes = db
      .prepare('SELECT * FROM domain_modes WHERE enabled = 1 ORDER BY id ASC')
      .all() as DomainMode[];

    db.close();
    return domainModes;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * IDでドメインモードを取得
 */
export function getDomainModeById(id: number): DomainMode | null {
  const db = initDatabase();

  try {
    const domainMode = db
      .prepare('SELECT * FROM domain_modes WHERE id = ? AND enabled = 1')
      .get(id) as DomainMode | undefined;

    db.close();
    return domainMode || null;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * 名前でドメインモードを取得
 */
export function getDomainModeByName(name: string): DomainMode | null {
  const db = initDatabase();

  try {
    const domainMode = db
      .prepare('SELECT * FROM domain_modes WHERE name = ? AND enabled = 1')
      .get(name) as DomainMode | undefined;

    db.close();
    return domainMode || null;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * ドメインIDに紐づくプロンプト一覧を取得
 */
export function getDomainPromptsByDomainId(domainId: number): DomainPrompt[] {
  const db = initDatabase();

  try {
    const prompts = db
      .prepare('SELECT * FROM domain_prompts WHERE domain_mode_id = ? ORDER BY id ASC')
      .all(domainId) as DomainPrompt[];

    db.close();
    return prompts;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * IDでドメインプロンプトを取得
 */
export function getDomainPromptById(id: number): DomainPrompt | null {
  const db = initDatabase();

  try {
    const prompt = db
      .prepare('SELECT * FROM domain_prompts WHERE id = ?')
      .get(id) as DomainPrompt | undefined;

    db.close();
    return prompt || null;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * ドメインのデフォルトプロンプトを取得
 */
export function getDefaultDomainPrompt(domainId: number): DomainPrompt | null {
  const db = initDatabase();

  try {
    const prompt = db
      .prepare('SELECT * FROM domain_prompts WHERE domain_mode_id = ? AND is_default = 1')
      .get(domainId) as DomainPrompt | undefined;

    db.close();
    return prompt || null;
  } catch (error) {
    db.close();
    throw error;
  }
}

// ========================================
// リポジトリ管理
// ========================================

/**
 * ユーザーリポジトリの型定義
 */
export interface UserRepository {
  id: number;
  user_id: number;
  name: string;
  local_path: string;
  description: string | null;
  default_branch: string;
  primary_language: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * リポジトリを作成
 */
export function createRepository(
  userId: number,
  name: string,
  localPath: string,
  description?: string,
  defaultBranch: string = 'main',
  primaryLanguage?: string
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare(`
        INSERT INTO user_repositories (
          user_id, name, local_path, description, default_branch, primary_language, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(userId, name, localPath, description || null, defaultBranch, primaryLanguage || null, now, now);

    db.close();
    return result.lastInsertRowid as number;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * ユーザーのリポジトリ一覧を取得
 */
export function getUserRepositories(userId: number): UserRepository[] {
  const db = initDatabase();

  try {
    const repos = db
      .prepare('SELECT * FROM user_repositories WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as UserRepository[];

    db.close();
    return repos;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * リポジトリをIDで取得
 */
export function getRepositoryById(id: number): UserRepository | null {
  const db = initDatabase();

  try {
    const repo = db
      .prepare('SELECT * FROM user_repositories WHERE id = ?')
      .get(id) as UserRepository | undefined;

    db.close();
    return repo || null;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * リポジトリを更新
 */
export function updateRepository(
  id: number,
  updates: {
    name?: string;
    description?: string;
    default_branch?: string;
    primary_language?: string;
  }
): boolean {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.default_branch !== undefined) {
      fields.push('default_branch = ?');
      values.push(updates.default_branch);
    }
    if (updates.primary_language !== undefined) {
      fields.push('primary_language = ?');
      values.push(updates.primary_language);
    }

    if (fields.length === 0) {
      db.close();
      return false;
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const result = db
      .prepare(`UPDATE user_repositories SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values);

    db.close();
    return result.changes > 0;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * リポジトリを削除
 */
export function deleteRepository(id: number): boolean {
  const db = initDatabase();

  try {
    const result = db
      .prepare('DELETE FROM user_repositories WHERE id = ?')
      .run(id);

    db.close();
    return result.changes > 0;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * セッションのリポジトリを設定
 */
export function setSessionRepository(
  sessionId: number,
  repositoryId: number | null,
  workingBranch?: string
): boolean {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare(`
        UPDATE sessions
        SET repository_id = ?, working_branch = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(repositoryId, workingBranch || null, now, sessionId);

    db.close();
    return result.changes > 0;
  } catch (error) {
    db.close();
    throw error;
  }
}
