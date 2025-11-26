#!/usr/bin/env tsx
/**
 * llamune データベース復元スクリプト
 *
 * llamune_code で誤って削除してしまった以下を復元します：
 * - user_repositories テーブル
 * - sessions.repository_id カラム
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

const DB_DIR = join(homedir(), '.llamune');
const DB_FILE = join(DB_DIR, 'history.db');

if (!existsSync(DB_FILE)) {
  console.error('❌ llamune データベースが見つかりません:', DB_FILE);
  console.log('');
  console.log('ℹ️  llamune がインストールされていない可能性があります');
  process.exit(1);
}

console.log('📂 Database:', DB_FILE);
console.log('');
console.log('🔄 llamune データベースを復元します...');
console.log('');

const db = new Database(DB_FILE);

try {
  // トランザクション開始
  db.exec('BEGIN TRANSACTION');

  // ========================================
  // 1. user_repositories テーブルを復元
  // ========================================
  const repoTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_repositories'")
    .get();

  if (repoTableExists) {
    console.log('✅ user_repositories テーブルは既に存在します');
  } else {
    console.log('➕ user_repositories テーブルを作成します...');

    db.exec(`
      CREATE TABLE user_repositories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        local_path TEXT NOT NULL,
        description TEXT,
        default_branch TEXT NOT NULL DEFAULT 'main',
        primary_language TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // インデックス作成
    db.exec('CREATE INDEX idx_user_repositories_user_id ON user_repositories(user_id)');
    db.exec('CREATE UNIQUE INDEX idx_user_repositories_user_path ON user_repositories(user_id, local_path)');

    console.log('✅ user_repositories テーブルを作成しました');
  }

  // ========================================
  // 2. sessions.repository_id カラムを復元
  // ========================================
  const sessionsTableInfo = db.pragma('table_info(sessions)') as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: any;
    pk: number;
  }>;

  const hasRepositoryIdColumn = sessionsTableInfo.some((col) => col.name === 'repository_id');

  if (hasRepositoryIdColumn) {
    console.log('✅ repository_id カラムは既に存在します');
  } else {
    console.log('➕ sessions テーブルに repository_id カラムを追加します...');

    // sessionsテーブルを再作成（repository_id を含む）
    const columnList = sessionsTableInfo.map((col) => col.name).join(', ');

    // 一時テーブルを作成してデータを退避
    db.exec(`CREATE TABLE sessions_backup AS SELECT ${columnList} FROM sessions`);

    // 元のテーブルを削除
    db.exec('DROP TABLE sessions');

    // 新しいテーブルを作成（repository_id を含む）
    db.exec(`
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        title TEXT,
        user_id INTEGER REFERENCES users(id),
        domain_mode_id INTEGER REFERENCES domain_modes(id),
        domain_prompt_id INTEGER REFERENCES domain_prompts(id),
        repository_id INTEGER REFERENCES user_repositories(id),
        working_branch TEXT
      )
    `);

    // データを復元
    db.exec(`INSERT INTO sessions (${columnList}) SELECT ${columnList} FROM sessions_backup`);

    // バックアップテーブルを削除
    db.exec('DROP TABLE sessions_backup');

    // インデックスを再作成
    db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_repository_id ON sessions(repository_id)');

    console.log('✅ repository_id カラムを追加しました');
  }

  // トランザクションコミット
  db.exec('COMMIT');

  console.log('');
  console.log('📊 復元後の sessions テーブル構造:');
  console.log('');

  const updatedSessionsInfo = db.pragma('table_info(sessions)') as Array<{
    name: string;
    type: string;
    notnull: number;
  }>;

  updatedSessionsInfo.forEach((col) => {
    console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}`);
  });

  console.log('');
  console.log('✅ llamune データベースの復元完了');
  console.log('');
  console.log('📝 復元内容:');
  console.log('  - user_repositories テーブル: 復元');
  console.log('  - sessions.repository_id カラム: 復元');
  console.log('');
  console.log('ℹ️  llamune は元の状態で動作します');
} catch (error) {
  console.error('❌ 復元に失敗しました');
  console.error(error);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}
