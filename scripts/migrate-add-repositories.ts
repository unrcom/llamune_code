#!/usr/bin/env tsx
/**
 * リポジトリ連携機能のためのマイグレーションスクリプト
 * - user_repositoriesテーブルを作成
 * - sessionsテーブルにrepository_id, working_branchカラムを追加
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const DB_DIR = join(homedir(), '.llamune_code');
const DB_FILE = join(DB_DIR, 'history.db');

// ディレクトリがなければ作成
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

console.log('📂 Database:', DB_FILE);
console.log('');

const db = new Database(DB_FILE);

console.log('🔄 リポジトリ連携機能のマイグレーションを実行します...');
console.log('');

try {
  // トランザクション開始
  db.exec('BEGIN TRANSACTION');

  // ========================================
  // 1. user_repositoriesテーブルを作成
  // ========================================
  const repoTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_repositories'")
    .get();

  if (repoTableExists) {
    console.log('✅ user_repositoriesテーブルは既に存在します');
  } else {
    console.log('➕ user_repositoriesテーブルを作成します...');

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

    console.log('✅ user_repositoriesテーブルを作成しました');
  }

  // ========================================
  // 2. sessionsテーブルにrepository_idカラムを追加
  // ========================================
  const sessionsTableInfo = db.pragma('table_info(sessions)') as Array<{ name: string }>;
  const hasRepositoryIdColumn = sessionsTableInfo.some((col) => col.name === 'repository_id');

  if (hasRepositoryIdColumn) {
    console.log('✅ repository_idカラムは既に存在します');
  } else {
    console.log('➕ sessionsテーブルにrepository_idカラムを追加します...');

    db.exec('ALTER TABLE sessions ADD COLUMN repository_id INTEGER REFERENCES user_repositories(id)');
    db.exec('CREATE INDEX idx_sessions_repository_id ON sessions(repository_id)');

    console.log('✅ repository_idカラムを追加しました');
  }

  // ========================================
  // 3. sessionsテーブルにworking_branchカラムを追加
  // ========================================
  const hasWorkingBranchColumn = sessionsTableInfo.some((col) => col.name === 'working_branch');

  if (hasWorkingBranchColumn) {
    console.log('✅ working_branchカラムは既に存在します');
  } else {
    console.log('➕ sessionsテーブルにworking_branchカラムを追加します...');

    db.exec('ALTER TABLE sessions ADD COLUMN working_branch TEXT');

    console.log('✅ working_branchカラムを追加しました');
  }

  // トランザクションコミット
  db.exec('COMMIT');

  console.log('');
  console.log('📊 更新後のテーブル構造:');
  console.log('');

  // user_repositoriesテーブル
  console.log('📋 user_repositories テーブル:');
  const repoTableInfo = db.pragma('table_info(user_repositories)') as Array<{
    name: string;
    type: string;
    notnull: number;
  }>;
  repoTableInfo.forEach((col) => {
    console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}`);
  });

  console.log('');

  // sessionsテーブル（更新後）
  console.log('📋 sessions テーブル（リポジトリ関連カラム）:');
  const updatedSessionsInfo = db.pragma('table_info(sessions)') as Array<{
    name: string;
    type: string;
    notnull: number;
  }>;
  const repoColumns = updatedSessionsInfo.filter(
    (col) => col.name === 'repository_id' || col.name === 'working_branch'
  );
  repoColumns.forEach((col) => {
    console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}`);
  });

  console.log('');
  console.log('✅ マイグレーション完了');
  console.log('');
  console.log('🔧 次のステップ:');
  console.log('1. リポジトリを登録: Web UIまたはAPI経由');
  console.log('2. チャットセッションでリポジトリを選択');
  console.log('3. LLMがリポジトリのコードを参照・編集可能に');
} catch (error) {
  console.error('❌ マイグレーションに失敗しました');
  console.error(error);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}
