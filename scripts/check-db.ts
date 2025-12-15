#!/usr/bin/env tsx
/**
 * データベースの内容を確認するスクリプト
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const DB_FILE = join(homedir(), '.llamune_code', 'history.db');

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

// デフォルトプロンプトを表示
console.log('💬 デフォルトプロンプト:');
console.log('');

try {
  const defaultPrompt = db
    .prepare('SELECT * FROM default_prompt WHERE id = 1')
    .get() as any;

  if (defaultPrompt) {
    console.log(`ID: ${defaultPrompt.id}`);
    console.log(`内容: ${defaultPrompt.system_prompt.substring(0, 100)}${defaultPrompt.system_prompt.length > 100 ? '...' : ''}`);
    if (defaultPrompt.description) {
      console.log(`説明: ${defaultPrompt.description}`);
    }
    console.log(`更新日時: ${defaultPrompt.updated_at}`);
  } else {
    console.log('  (データがありません)');
  }
} catch (error) {
  console.log('  (テーブルが存在しません)');
}

console.log('');

// ドメインモードを表示
console.log('🎯 ドメインモード:');
console.log('');

try {
  const domainModes = db
    .prepare('SELECT * FROM domain_modes ORDER BY id')
    .all() as any[];

  if (domainModes.length === 0) {
    console.log('  (データがありません)');
  } else {
    for (const domain of domainModes) {
      // 各ドメインのプロンプト数を取得
      const promptCount = db
        .prepare('SELECT COUNT(*) as count FROM domain_prompts WHERE domain_mode_id = ?')
        .get(domain.id) as { count: number };

      console.log(`ID: ${domain.id}`);
      console.log(`  名前: ${domain.name}`);
      console.log(`  表示名: ${domain.display_name}`);
      if (domain.description) {
        console.log(`  説明: ${domain.description}`);
      }
      console.log(`  有効: ${domain.enabled === 1 ? 'はい' : 'いいえ'}`);
      console.log(`  プロンプト数: ${promptCount.count}`);
      console.log('');
    }
  }

  console.log(`合計: ${domainModes.length} 件`);
} catch (error) {
  console.log('  (テーブルが存在しません)');
}

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
