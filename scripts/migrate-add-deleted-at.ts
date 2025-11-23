#!/usr/bin/env tsx

/**
 * マイグレーション: messagesテーブルにdeleted_atカラムを追加
 *
 * 論理削除機能のために deleted_at カラムを追加します。
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const configDir = join(homedir(), '.llamune');
const dbPath = join(configDir, 'history.db');

// ディレクトリが存在しない場合は作成
if (!existsSync(configDir)) {
  mkdirSync(configDir, { recursive: true });
}

console.log('📂 Database:', dbPath);
console.log('');

const db = new Database(dbPath);

try {
  console.log('🔄 マイグレーションを実行します...');
  console.log('');

  // deleted_at カラムが存在するか確認
  const tableInfo = db.pragma('table_info(messages)') as Array<{ name: string }>;
  const hasDeletedAtColumn = tableInfo.some((col) => col.name === 'deleted_at');

  if (hasDeletedAtColumn) {
    console.log('✅ deleted_at カラムは既に存在します');
    console.log('');
  } else {
    // deleted_at カラムを追加
    db.exec('ALTER TABLE messages ADD COLUMN deleted_at TEXT');
    console.log('✅ deleted_at カラムを追加しました');
    console.log('');
  }

  // テーブル構造を表示
  console.log('📊 更新後のテーブル構造:');
  const updatedTableInfo = db.pragma('table_info(messages)') as Array<{
    name: string;
    type: string;
  }>;
  updatedTableInfo.forEach((col) => {
    const nullable = col.name === 'deleted_at' || col.name === 'model' ? '' : ' NOT NULL';
    console.log(`  ${col.name}: ${col.type}${nullable}`);
  });
  console.log('');

  console.log('✅ マイグレーション完了');
} catch (error) {
  console.error('❌ マイグレーションに失敗しました');
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
