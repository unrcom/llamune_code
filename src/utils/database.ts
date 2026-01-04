/**
 * データベース管理ユーティリティ
 * SQLiteを使用して会話履歴を保存
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { ChatMessage } from './ollama.js';
import { encrypt, decrypt, isEncrypted } from './encryption.js';


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
  project_path?: string | null; // プロジェクトディレクトリパス
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
 * デフォルトプロンプトの型定義
 */
export interface DefaultPrompt {
  id: number;
  system_prompt: string;
  description: string | null;
  updated_at: string;
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

  // user_idカラムがなければ追加
  const hasUserIdColumn = tableInfo.some((col) => col.name === 'user_id');
  if (!hasUserIdColumn) {
    db.exec('ALTER TABLE sessions ADD COLUMN user_id INTEGER');
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
export function createSession(
  model: string
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  const result = db
    .prepare('INSERT INTO sessions (model, created_at, updated_at) VALUES (?, ?, ?)')
    .run(model, now, now);

  db.close();
  return result.lastInsertRowid as number;
}
/**
 * メッセージを保存（暗号化付き）
 */
export function saveMessage(
  sessionId: number,
  role: string,
  content: string,
  model?: string,
  thinking?: string
): void {
  const db = initDatabase();
  const now = new Date().toISOString();

  // contentとthinkingを暗号化
  const encryptedContent = encrypt(content);
  const encryptedThinking = thinking ? encrypt(thinking) : null;

  db.prepare(
    'INSERT INTO messages (session_id, role, content, created_at, model, thinking) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(sessionId, role, encryptedContent, now, model || null, encryptedThinking);

  // セッションの更新日時を更新
  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

  // 最初のユーザーメッセージの場合、タイトルを自動設定（暗号化前のcontentを使用）
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
 * 会話全体を保存（暗号化付き）
 */
export function saveConversation(
  model: string,
  messages: ChatMessage[],
  userId?: number,
  projectPath?: string,
  domainPromptId?: number,
  systemPrompt?: string
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  // セッションを作成（システムプロンプトのスナップショットを保存）
  const sessionResult = db
    .prepare('INSERT INTO sessions (model, user_id, project_path, domain_prompt_id, system_prompt_snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(model, userId || null, projectPath || null, domainPromptId || null, systemPrompt || null, now, now);

  const sessionId = sessionResult.lastInsertRowid as number;

  // 最初のユーザーメッセージからタイトルを自動生成
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    const title = firstUserMessage.content.length > 30 
      ? firstUserMessage.content.substring(0, 30) + '...' 
      : firstUserMessage.content;
    db.prepare('UPDATE sessions SET title = ? WHERE id = ?').run(title, sessionId);
  }

  // メッセージを一括保存（暗号化付き）
  const insertMessage = db.prepare(
    'INSERT INTO messages (session_id, role, content, created_at, model, thinking) VALUES (?, ?, ?, ?, ?, ?)'
  );

  for (const message of messages) {
    console.log('🔍 Saving message:', { role: message.role, model: message.model, preset_id: (message as any).preset_id });
    const encryptedContent = encrypt(message.content);
    const encryptedThinking = message.thinking ? encrypt(message.thinking) : null;
    insertMessage.run(sessionId, message.role, encryptedContent, now, message.model || null, encryptedThinking);
  }

  db.close();
  return sessionId;
}

/**
 * 既存セッションにメッセージを追加（暗号化付き）
 */
export function appendMessagesToSession(
  sessionId: number,
  messages: ChatMessage[]
): void {
  const db = initDatabase();
  const now = new Date().toISOString();

  // メッセージを一括追加（暗号化付き）
  const insertMessage = db.prepare(
    'INSERT INTO messages (session_id, role, content, created_at, model, thinking, preset_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  for (const message of messages) {
    console.log('🔍 Saving message:', { role: message.role, model: message.model, preset_id: (message as any).preset_id });
    const encryptedContent = encrypt(message.content);
    const encryptedThinking = message.thinking ? encrypt(message.thinking) : null;
    insertMessage.run(
      sessionId,
      message.role,
      encryptedContent,
      now,
      message.model || null,
      encryptedThinking,
      (message as any).preset_id || null
    );
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
  
  // previewを復号
  return sessions.map(session => {
    if (session.preview) {
      try {
        session.preview = decrypt(session.preview);
      } catch (error) {
        console.error('Failed to decrypt preview:', error);
        // 復号に失敗した場合は元のままにする
      }
    }
    return session;
  });
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
  session: ChatSession & { user_id?: number };
  messages: ChatMessage[];
  systemPrompt?: string;
} | null {
  const db = initDatabase();

  // セッション情報を取得（domain_prompt_id、system_prompt_snapshotも取得）
  const session = db
    .prepare(
      `
      SELECT
        s.id,
        s.model,
        s.created_at,
        s.updated_at,
        s.title,
        s.project_path,
        s.domain_prompt_id,
        s.system_prompt_snapshot,
        COUNT(m.id) as message_count,
        s.user_id,
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
    .get(sessionId) as (ChatSession & { user_id?: number; domain_prompt_id?: number; system_prompt_snapshot?: string }) | undefined;

  if (!session) {
    db.close();
    return null;
  }

  // 所有者チェック（userIdが指定されている場合）
  if (userId !== undefined) {
    // user_idとuserIdが一致するか確認
    // Note: user_id が null の場合もチェックを行う
    if (session.user_id !== userId) {
      db.close();
      return null;
    }
  }

  // プレビューを復号
  if (session.preview) {
    try {
      session.preview = decrypt(session.preview);
    } catch (error) {
      console.error('Failed to decrypt preview:', error);
    }
  }

  // システムプロンプトを取得
  // 優先順位: 1. system_prompt_snapshot（保存時のスナップショット）, 2. domain_promptsから取得
  let systemPrompt: string | undefined;
  if (session.system_prompt_snapshot) {
    // スナップショットがあればそれを使用（セッション作成時のプロンプトを正確に再現）
    systemPrompt = session.system_prompt_snapshot;
  } else if (session.domain_prompt_id) {
    // スナップショットがない場合（既存セッション）はdomain_promptsから取得
    const domainPrompt = db
      .prepare('SELECT system_prompt FROM domain_prompts WHERE id = ?')
      .get(session.domain_prompt_id) as { system_prompt?: string } | undefined;
    systemPrompt = domainPrompt?.system_prompt;
  }

  // メッセージを取得（論理削除されていないもののみ、thinkingも含む）
  const messagesRaw = db
    .prepare(
      `
      SELECT role, content, model, thinking
      FROM messages
      WHERE session_id = ? AND deleted_at IS NULL
      ORDER BY id ASC
    `
    )
    .all(sessionId) as Array<{
      role: string;
      content: string;
      model?: string;
      thinking?: string;
    }>;

  // メッセージを復号
  const messages: ChatMessage[] = messagesRaw.map((msg) => ({
    role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
    content: decrypt(msg.content),
    model: msg.model,
    thinking: msg.thinking ? decrypt(msg.thinking) : undefined,
  }));

  db.close();

  return {
    session,
    messages,
    systemPrompt,
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
      s.updated_at,
      s.title,
      s.project_path,
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
  
  // previewを復号
  return sessions.map(session => {
    if (session.preview) {
      try {
        session.preview = decrypt(session.preview);
      } catch (error) {
        console.error('Failed to decrypt preview:', error);
        // 復号に失敗した場合は元のままにする
      }
    }
    return session;
  });
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
  expiresAt: string,
  deviceFingerprint?: string,
  deviceType?: string,
  createdVia: 'login' | 'refresh' = 'login'
): number {
  const db = initDatabase();
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare(
        `INSERT INTO refresh_tokens 
        (user_id, token, expires_at, created_at, device_fingerprint, device_type, last_used_at, created_via) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(userId, token, expiresAt, now, deviceFingerprint, deviceType, now, createdVia);

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
    
    // システムプロンプトは平文で保存されているため、復号化不要
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
    
    if (!prompt) return null;
    
    // システムプロンプトは平文で保存されているため、復号化不要
    return prompt;
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
    
    if (!prompt) return null;
    
    // system_promptを復号（暗号化されている場合のみ）
    if (prompt.system_prompt && isEncrypted(prompt.system_prompt)) {
      try {
        prompt.system_prompt = decrypt(prompt.system_prompt);
      } catch (error) {
        console.error('Failed to decrypt system_prompt:', error);
      }
    }
    
    return prompt;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * デフォルトプロンプトを取得
 */
export function getDefaultPrompt(): DefaultPrompt | null {
  const db = initDatabase();

  try {
    const prompt = db
      .prepare('SELECT * FROM default_prompt WHERE id = 1')
      .get() as DefaultPrompt | undefined;

    db.close();
    return prompt || null;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * デフォルトプロンプトを更新
 */
export function updateDefaultPrompt(systemPrompt: string, description?: string): boolean {
  const db = initDatabase();

  try {
    const stmt = db.prepare(`
      UPDATE default_prompt 
      SET system_prompt = ?, 
          description = ?,
          updated_at = datetime('now')
      WHERE id = 1
    `);

    const result = stmt.run(systemPrompt, description || null);
    db.close();
    return result.changes > 0;
  } catch (error) {
    db.close();
    throw error;
  }
}


/**
 * セッションの最後から2番目のアシスタントメッセージを削除（Retry採用時）
 */
export function deleteSecondLastAssistantMessage(sessionId: number): boolean {
  const db = initDatabase();
  try {
    // セッションの全アシスタントメッセージを取得
    const assistantMessages = db
      .prepare('SELECT id FROM messages WHERE session_id = ? AND role = ? ORDER BY id DESC LIMIT 2')
      .all(sessionId, 'assistant') as { id: number }[];

    if (assistantMessages.length < 2) {
      console.warn('No second-last assistant message to delete');
      return false;
    }

    // 最後から2番目のメッセージを削除
    const secondLastMessageId = assistantMessages[1].id;
    db.prepare('DELETE FROM messages WHERE id = ?').run(secondLastMessageId);
    
    console.log(`🗑️ Deleted second-last assistant message: ${secondLastMessageId}`);
    return true;
  } finally {
    db.close();
  }
}

/**
 * セッションの最後のアシスタントメッセージを削除（Retry破棄時）
 */
export function deleteLastAssistantMessage(sessionId: number): boolean {
  const db = initDatabase();
  try {
    // セッションの最後のアシスタントメッセージを取得
    const lastMessage = db
      .prepare('SELECT id FROM messages WHERE session_id = ? AND role = ? ORDER BY id DESC LIMIT 1')
      .get(sessionId, 'assistant') as { id: number } | undefined;

    if (!lastMessage) {
      console.warn('No assistant message to delete');
      return false;
    }

    // 最後のメッセージを削除
    db.prepare('DELETE FROM messages WHERE id = ?').run(lastMessage.id);
    
    console.log(`🗑️ Deleted last assistant message: ${lastMessage.id}`);
    return true;
  } finally {
    db.close();
  }
}
