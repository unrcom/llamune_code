#!/usr/bin/env tsx
/**
 * リポジトリ連携機能のクリーンアップマイグレーション
 * - user_repositoriesテーブルを削除
 * - sessionsテーブルからrepository_idカラムを削除
 *
 * 理由: リポジトリ管理をDBベースから動的スキャン方式に変更したため
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

const DB_DIR = join(homedir(), '.llamune_code');
const DB_FILE = join(DB_DIR, 'history.db');

if (!existsSync(DB_FILE)) {
  console.error('❌ データベースが見つかりません:', DB_FILE);
  process.exit(1);
}

console.log('📂 Database:', DB_FILE);
console.log('');

const db = new Database(DB_FILE);

console.log('🔄 リポジトリ連携機能のクリーンアップマイグレーションを実行します...');
console.log('⚠️  user_repositoriesテーブルとsessions.repository_idカラムを削除します');
console.log('');

try {
  // トランザクション開始
  db.exec('BEGIN TRANSACTION');

  // ========================================
  // 1. user_repositoriesテーブルを削除
  // ========================================
  const repoTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_repositories'")
    .get();

  if (repoTableExists) {
    console.log('🗑️  user_repositoriesテーブルを削除します...');
    db.exec('DROP TABLE IF EXISTS user_repositories');
    console.log('✅ user_repositoriesテーブルを削除しました');
  } else {
    console.log('ℹ️  user_repositoriesテーブルは既に存在しません');
  }

  // ========================================
  // 2. sessionsテーブルからrepository_idカラムを削除
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
    console.log('🗑️  sessionsテーブルからrepository_idカラムを削除します...');

    // SQLiteではALTER TABLE DROP COLUMNが使えない場合があるため、テーブルを再作成
    // 1. 既存データを退避
    // 2. テーブルを削除
    // 3. repository_idなしで再作成
    // 4. データを復元

    // repository_id以外のカラム名を取得
    const columnsToKeep = sessionsTableInfo
      .filter((col) => col.name !== 'repository_id')
      .map((col) => col.name);

    const columnList = columnsToKeep.join(', ');

    // 一時テーブルを作成してデータを退避
    db.exec(`CREATE TABLE sessions_backup AS SELECT ${columnList} FROM sessions`);

    // 元のテーブルを削除
    db.exec('DROP TABLE sessions');

    // 新しいテーブルを作成（repository_idなし）
    // 元のテーブル定義を再現
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
        working_branch TEXT
      )
    `);

    // データを復元
    db.exec(`INSERT INTO sessions (${columnList}) SELECT ${columnList} FROM sessions_backup`);

    // バックアップテーブルを削除
    db.exec('DROP TABLE sessions_backup');

    // インデックスを再作成
    db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');

    console.log('✅ repository_idカラムを削除しました');
  } else {
    console.log('ℹ️  repository_idカラムは既に存在しません');
  }

  // トランザクションコミット
  db.exec('COMMIT');

  console.log('');
  console.log('📊 更新後のsessionsテーブル構造:');
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
  console.log('✅ マイグレーション完了');
  console.log('');
  console.log('📝 変更内容:');
  console.log('  - user_repositoriesテーブル: 削除');
  console.log('  - sessions.repository_id: 削除');
  console.log('');
  console.log('ℹ️  リポジトリは起動時に自動スキャンされます');
} catch (error) {
  console.error('❌ マイグレーションに失敗しました');
  console.error(error);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}
