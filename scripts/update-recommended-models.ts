#!/usr/bin/env tsx
/**
 * 推奨モデルのメモリ範囲を更新するスクリプト
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const DB_FILE = join(homedir(), '.llamune_code', 'history.db');

console.log('📂 Database:', DB_FILE);
console.log('');

const db = new Database(DB_FILE);

console.log('🔄 推奨モデルのメモリ範囲を更新します...');
console.log('');

// 更新前の状態を表示
console.log('【更新前】');
const before = db
  .prepare('SELECT id, min_memory_gb, max_memory_gb, model_name FROM recommended_models ORDER BY min_memory_gb, priority')
  .all();
before.forEach((row: any) => {
  const maxMem = row.max_memory_gb === null ? '∞' : row.max_memory_gb;
  console.log(`ID: ${row.id} | ${row.min_memory_gb}GB - ${maxMem}GB | ${row.model_name}`);
});
console.log('');

// 更新を実行
db.prepare('UPDATE recommended_models SET max_memory_gb = 31 WHERE id IN (3, 4)').run();
db.prepare('UPDATE recommended_models SET min_memory_gb = 32 WHERE id IN (5, 6, 7)').run();

console.log('✅ 更新完了');
console.log('');

// 更新後の状態を表示
console.log('【更新後】');
const after = db
  .prepare('SELECT id, min_memory_gb, max_memory_gb, model_name FROM recommended_models ORDER BY min_memory_gb, priority')
  .all();
after.forEach((row: any) => {
  const maxMem = row.max_memory_gb === null ? '∞' : row.max_memory_gb;
  console.log(`ID: ${row.id} | ${row.min_memory_gb}GB - ${maxMem}GB | ${row.model_name}`);
});
console.log('');

console.log('新しいメモリ範囲:');
console.log('  0-8GB: 軽量モデル');
console.log('  9-31GB: バランス型モデル (Macの24GBをカバー)');
console.log('  32GB以上: 高性能モデル');

db.close();
