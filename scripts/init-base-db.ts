#!/usr/bin/env tsx
/**
 * データベースの基本テーブルを初期化するスクリプト
 */

import { initDatabase } from '../src/utils/database.js';

console.log('🔄 データベースを初期化します...');
const db = initDatabase();
console.log('✅ データベースを初期化しました');

// テーブル一覧を表示
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
console.log('\n📋 作成されたテーブル:');
tables.forEach(table => {
  console.log(`  - ${table.name}`);
});

db.close();
