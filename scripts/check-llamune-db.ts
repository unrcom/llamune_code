#!/usr/bin/env tsx
import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

const DB_FILE = join(homedir(), '.llamune', 'history.db');

if (!existsSync(DB_FILE)) {
  console.log('ℹ️  llamune データベースが見つかりません:', DB_FILE);
  console.log('   llamune がインストールされていないか、まだ使用されていません');
  process.exit(0);
}

console.log('📂 Database:', DB_FILE);
console.log('');

const db = new Database(DB_FILE);

// 全テーブル一覧を取得
console.log('📋 テーブル一覧:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>;
tables.forEach((table) => {
  console.log(`  - ${table.name}`);
});

console.log('');

// user_repositories テーブルの存在確認
const repoTableExists = tables.some((t) => t.name === 'user_repositories');
if (repoTableExists) {
  console.log('⚠️  user_repositories テーブルが存在します');
  const repoCount = db.prepare('SELECT COUNT(*) as count FROM user_repositories').get() as { count: number };
  console.log(`   レコード数: ${repoCount.count}`);
} else {
  console.log('✅ user_repositories テーブルは存在しません（正常）');
}

console.log('');

// sessions テーブルの構造確認
console.log('📋 sessions テーブルの構造:');
const sessionsTableInfo = db.pragma('table_info(sessions)') as Array<{
  name: string;
  type: string;
  notnull: number;
}>;

const hasRepositoryId = sessionsTableInfo.some((col) => col.name === 'repository_id');
const hasWorkingBranch = sessionsTableInfo.some((col) => col.name === 'working_branch');

sessionsTableInfo.forEach((col) => {
  const marker = (col.name === 'repository_id' || col.name === 'working_branch') ? ' ⚠️' : '';
  console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${marker}`);
});

console.log('');

if (hasRepositoryId) {
  console.log('⚠️  repository_id カラムが存在します');
} else {
  console.log('✅ repository_id カラムは存在しません（正常）');
}

if (hasWorkingBranch) {
  console.log('⚠️  working_branch カラムが存在します');
} else {
  console.log('✅ working_branch カラムは存在しません（正常）');
}

db.close();
