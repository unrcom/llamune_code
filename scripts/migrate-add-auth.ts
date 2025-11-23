#!/usr/bin/env tsx
/**
 * 認証機能のためのマイグレーションスクリプト
 * - usersテーブルを作成
 * - refresh_tokensテーブルを作成
 * - sessionsテーブルにuser_idカラムを追加
 * - デフォルト管理者ユーザーを作成
 * - 既存セッションをデフォルトユーザーに紐付け
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { hashSync } from 'bcrypt';

const DB_DIR = join(homedir(), '.llamune');
const DB_FILE = join(DB_DIR, 'history.db');

// ディレクトリがなければ作成
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

console.log('📂 Database:', DB_FILE);
console.log('');

const db = new Database(DB_FILE);

console.log('🔄 認証機能のマイグレーションを実行します...');
console.log('');

try {
  // トランザクション開始
  db.exec('BEGIN TRANSACTION');

  // ========================================
  // 1. usersテーブルを作成
  // ========================================
  const userTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    .get();

  if (userTableExists) {
    console.log('✅ usersテーブルは既に存在します');
  } else {
    console.log('➕ usersテーブルを作成します...');

    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // インデックス作成
    db.exec('CREATE UNIQUE INDEX idx_users_username ON users(username)');

    console.log('✅ usersテーブルを作成しました');

    // デフォルト管理者ユーザーを作成
    console.log('');
    console.log('👤 デフォルト管理者ユーザーを作成します...');

    const defaultPassword = 'admin'; // 初回パスワード
    const passwordHash = hashSync(defaultPassword, 12);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin', passwordHash, 'admin', now, now);

    console.log('✅ デフォルトユーザーを作成しました');
    console.log('');
    console.log('⚠️  重要: デフォルト認証情報');
    console.log('   Username: admin');
    console.log('   Password: admin');
    console.log('   ログイン後、すぐにパスワードを変更してください！');
    console.log('');
  }

  // ========================================
  // 2. refresh_tokensテーブルを作成
  // ========================================
  const refreshTokenTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='refresh_tokens'")
    .get();

  if (refreshTokenTableExists) {
    console.log('✅ refresh_tokensテーブルは既に存在します');
  } else {
    console.log('➕ refresh_tokensテーブルを作成します...');

    db.exec(`
      CREATE TABLE refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // インデックス作成
    db.exec('CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id)');
    db.exec('CREATE UNIQUE INDEX idx_refresh_tokens_token ON refresh_tokens(token)');

    console.log('✅ refresh_tokensテーブルを作成しました');
  }

  // ========================================
  // 3. sessionsテーブルにuser_idカラムを追加
  // ========================================
  const sessionsTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
    .get();

  if (!sessionsTableExists) {
    console.log('⚠️ sessionsテーブルが存在しません');
    console.log('最初にCLIを実行してデータベースを初期化してください:');
    console.log('  llmn ls');
    db.exec('ROLLBACK');
    process.exit(0);
  }

  // user_idカラムが存在するかチェック
  const tableInfo = db.pragma('table_info(sessions)') as Array<{ name: string }>;
  const hasUserIdColumn = tableInfo.some((col) => col.name === 'user_id');

  if (hasUserIdColumn) {
    console.log('✅ user_idカラムは既に存在します');
  } else {
    console.log('➕ sessionsテーブルにuser_idカラムを追加します...');

    // user_idカラムを追加
    db.exec('ALTER TABLE sessions ADD COLUMN user_id INTEGER REFERENCES users(id)');

    // インデックス作成
    db.exec('CREATE INDEX idx_sessions_user_id ON sessions(user_id)');

    console.log('✅ user_idカラムを追加しました');

    // 既存セッションをデフォルトユーザー（admin）に紐付け
    console.log('');
    console.log('🔄 既存セッションをデフォルトユーザーに紐付けます...');

    const adminUser = db
      .prepare("SELECT id FROM users WHERE username = 'admin'")
      .get() as { id: number } | undefined;

    if (adminUser) {
      const result = db
        .prepare('UPDATE sessions SET user_id = ? WHERE user_id IS NULL')
        .run(adminUser.id);

      console.log(`✅ ${result.changes}件のセッションを紐付けました`);
    }
  }

  // トランザクションコミット
  db.exec('COMMIT');

  console.log('');
  console.log('📊 更新後のテーブル構造:');
  console.log('');

  // usersテーブル
  console.log('📋 users テーブル:');
  const usersTableInfo = db.pragma('table_info(users)') as Array<{
    name: string;
    type: string;
    notnull: number;
  }>;
  usersTableInfo.forEach((col) => {
    console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}`);
  });

  console.log('');

  // refresh_tokensテーブル
  console.log('📋 refresh_tokens テーブル:');
  const refreshTokensTableInfo = db.pragma('table_info(refresh_tokens)') as Array<{
    name: string;
    type: string;
    notnull: number;
  }>;
  refreshTokensTableInfo.forEach((col) => {
    console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}`);
  });

  console.log('');

  // sessionsテーブル
  console.log('📋 sessions テーブル:');
  const sessionsTableInfo = db.pragma('table_info(sessions)') as Array<{
    name: string;
    type: string;
    notnull: number;
  }>;
  sessionsTableInfo.forEach((col) => {
    console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}`);
  });

  console.log('');
  console.log('✅ マイグレーション完了');
  console.log('');
  console.log('🔐 次のステップ:');
  console.log('1. API サーバーを起動: npm run api');
  console.log('2. デフォルトユーザーでログイン: llamune login');
  console.log('3. パスワードを変更してください');
} catch (error) {
  console.error('❌ マイグレーションに失敗しました');
  console.error(error);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}
