#!/usr/bin/env tsx

/**
 * マイグレーション: defaultプリセットをシステムデフォルトに変更
 *
 * 既存の「デフォルト」プリセットの全パラメータをnullに設定し、
 * Ollamaのシステムデフォルト値を使用するように変更します。
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

  // 現在のdefaultプリセットを確認
  const currentDefault = db
    .prepare('SELECT * FROM parameter_presets WHERE name = ?')
    .get('default') as any;

  if (!currentDefault) {
    console.log('⚠️  defaultプリセットが見つかりません');
    console.log('');
    process.exit(0);
  }

  console.log('📋 現在のdefaultプリセット:');
  console.log(`  temperature: ${currentDefault.temperature}`);
  console.log(`  top_p: ${currentDefault.top_p}`);
  console.log(`  top_k: ${currentDefault.top_k}`);
  console.log(`  repeat_penalty: ${currentDefault.repeat_penalty}`);
  console.log(`  num_ctx: ${currentDefault.num_ctx}`);
  console.log('');

  // defaultプリセットを更新（全てnullに）
  const update = db.prepare(`
    UPDATE parameter_presets
    SET
      display_name = ?,
      description = ?,
      temperature = NULL,
      top_p = NULL,
      top_k = NULL,
      repeat_penalty = NULL,
      num_ctx = NULL
    WHERE name = ?
  `);

  update.run(
    'デフォルト',
    'Ollamaのシステムデフォルト値を使用（パラメータ未指定）',
    'default'
  );

  console.log('✅ defaultプリセットを更新しました');
  console.log('');

  // 更新後の内容を確認
  const updatedDefault = db
    .prepare('SELECT * FROM parameter_presets WHERE name = ?')
    .get('default') as any;

  console.log('📋 更新後のdefaultプリセット:');
  console.log(`  display_name: ${updatedDefault.display_name}`);
  console.log(`  description: ${updatedDefault.description}`);
  console.log(`  temperature: ${updatedDefault.temperature}`);
  console.log(`  top_p: ${updatedDefault.top_p}`);
  console.log(`  top_k: ${updatedDefault.top_k}`);
  console.log(`  repeat_penalty: ${updatedDefault.repeat_penalty}`);
  console.log(`  num_ctx: ${updatedDefault.num_ctx}`);
  console.log('');

  console.log('ℹ️  変更内容:');
  console.log('  - パラメータが全てnullになりました');
  console.log('  - Ollamaに送信する際、これらのパラメータは含まれません');
  console.log('  - Ollamaのシステムデフォルト値が使用されます');
  console.log('');

  console.log('✅ マイグレーション完了');
} catch (error) {
  console.error('❌ マイグレーションに失敗しました');
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
