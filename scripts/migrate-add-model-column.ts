#!/usr/bin/env tsx
/**
 * messagesテーブルにmodelカラムを追加するマイグレーションスクリプト
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const DB_FILE = join(homedir(), '.llamune', 'history.db');

console.log('📂 Database:', DB_FILE);
console.log('');

const db = new Database(DB_FILE);

console.log('🔄 マイグレーションを実行します...');
console.log('');

try {
  // messagesテーブルにmodelカラムがあるかチェック
  const tableInfo = db.pragma('table_info(messages)');
  const hasModelColumn = tableInfo.some((col: any) => col.name === 'model');

  if (hasModelColumn) {
    console.log('✅ modelカラムは既に存在します');
  } else {
    console.log('➕ modelカラムを追加します...');

    // modelカラムを追加
    db.exec('ALTER TABLE messages ADD COLUMN model TEXT');

    console.log('✅ modelカラムを追加しました');
  }

  console.log('');
  console.log('📊 更新後のテーブル構造:');

  const updatedTableInfo = db.pragma('table_info(messages)');
  updatedTableInfo.forEach((col: any) => {
    console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}`);
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
