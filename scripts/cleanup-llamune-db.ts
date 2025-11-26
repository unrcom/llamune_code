#!/usr/bin/env tsx
/**
 * llamune データベースクリーンアップスクリプト
 *
 * llamune_code で誤って追加してしまったテーブル/カラムを削除します：
 * - user_repositories テーブル（llamune_code の機能）
 * - sessions.repository_id カラム（llamune_code の機能）
 * - sessions.working_branch カラム（llamune_code の機能）
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

const DB_FILE = join(homedir(), '.llamune', 'history.db');

if (!existsSync(DB_FILE)) {
  console.log('ℹ️  llamune データベースが見つかりません:', DB_FILE);
  console.log('   クリーンアップは不要です');
  process.exit(0);
}

console.log('📂 Database:', DB_FILE);
console.log('');

const db = new Database(DB_FILE);

try {
  db.exec('BEGIN TRANSACTION');

  // user_repositories テーブルを削除
  const repoTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_repositories'")
    .get();

  if (repoTableExists) {
    console.log('🗑️  user_repositories テーブルを削除します...');
    db.exec('DROP TABLE user_repositories');
    console.log('✅ 削除完了');
  } else {
    console.log('ℹ️  user_repositories テーブルは存在しません');
  }

  // sessions テーブルから repository_id と working_branch を削除
  const sessionsTableInfo = db.pragma('table_info(sessions)') as Array<{
    name: string;
    type: string;
  }>;

  const hasRepositoryId = sessionsTableInfo.some((col) => col.name === 'repository_id');
  const hasWorkingBranch = sessionsTableInfo.some((col) => col.name === 'working_branch');

  if (hasRepositoryId || hasWorkingBranch) {
    console.log('');
    console.log('🗑️  sessions テーブルから repository_id, working_branch カラムを削除します...');

    // repository_id と working_branch 以外のカラムを取得
    const columnsToKeep = sessionsTableInfo
      .filter((col) => col.name !== 'repository_id' && col.name !== 'working_branch')
      .map((col) => col.name);

    const columnList = columnsToKeep.join(', ');

    // 一時テーブルにデータをコピー
    db.exec(`CREATE TABLE sessions_backup AS SELECT ${columnList} FROM sessions`);

    // 元のテーブルを削除
    db.exec('DROP TABLE sessions');

    // 新しいテーブルを作成（repository_id と working_branch なし）
    db.exec(`
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        title TEXT,
        user_id INTEGER REFERENCES users(id),
        domain_mode_id INTEGER REFERENCES domain_modes(id),
        domain_prompt_id INTEGER REFERENCES domain_prompts(id)
      )
    `);

    // データを復元
    db.exec(`INSERT INTO sessions (${columnList}) SELECT ${columnList} FROM sessions_backup`);

    // バックアップテーブルを削除
    db.exec('DROP TABLE sessions_backup');

    // インデックスを再作成
    db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');

    console.log('✅ 削除完了');
  } else {
    console.log('');
    console.log('ℹ️  repository_id, working_branch カラムは存在しません');
  }

  db.exec('COMMIT');

  console.log('');
  console.log('✅ llamune データベースのクリーンアップ完了');
  console.log('');
  console.log('📋 現在の sessions テーブル構造:');
  const updatedSessionsInfo = db.pragma('table_info(sessions)') as Array<{
    name: string;
    type: string;
    notnull: number;
  }>;
  updatedSessionsInfo.forEach((col) => {
    console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}`);
  });

} catch (error) {
  console.error('❌ クリーンアップに失敗しました');
  console.error(error);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}
