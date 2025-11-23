#!/usr/bin/env tsx
/**
 * データベースの内容を確認するスクリプト
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const DB_FILE = join(homedir(), '.llamune', 'history.db');

console.log('📂 Database:', DB_FILE);
console.log('');

const db = new Database(DB_FILE, { readonly: true });

// 推奨モデルを表示
console.log('🎯 推奨モデルテーブル:');
console.log('');

const models = db
  .prepare(
    `
    SELECT
      id,
      min_memory_gb,
      max_memory_gb,
      model_name,
      model_size,
      description,
      priority
    FROM recommended_models
    ORDER BY min_memory_gb, priority
  `
  )
  .all();

if (models.length === 0) {
  console.log('  (データがありません)');
} else {
  models.forEach((model: any) => {
    const maxMem = model.max_memory_gb === null ? '∞' : model.max_memory_gb;
    console.log(`ID: ${model.id}`);
    console.log(`  メモリ範囲: ${model.min_memory_gb}GB - ${maxMem}GB`);
    console.log(`  モデル: ${model.model_name} (${model.model_size})`);
    console.log(`  説明: ${model.description}`);
    console.log(`  優先度: ${model.priority}`);
    console.log('');
  });
}

console.log(`合計: ${models.length} 件`);
console.log('');

// セッション数を表示
const sessionCount = db
  .prepare('SELECT COUNT(*) as count FROM sessions')
  .get() as { count: number };

console.log(`💬 会話セッション: ${sessionCount.count} 件`);

// メッセージ数を表示
const messageCount = db
  .prepare('SELECT COUNT(*) as count FROM messages')
  .get() as { count: number };

console.log(`📝 メッセージ: ${messageCount.count} 件`);

db.close();
