#!/usr/bin/env tsx

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';

// データベースのパスを取得（~/.llamune_code/history.db）
const dbPath = join(homedir(), '.llamune_code', 'history.db');
const db = new Database(dbPath);

console.log(`📂 Database: ${dbPath}`);

console.log('🔄 マイグレーション: 「事務的」プリセットを削除');
console.log('');

try {
  // 「事務的」プリセット（precise）を削除
  const result = db.prepare(`
    DELETE FROM parameter_presets WHERE name = ?
  `).run('precise');

  console.log(`✅ 削除完了: ${result.changes} 件のプリセットを削除しました`);
  console.log('');

  // 残っているプリセットを確認
  const presets = db.prepare(`
    SELECT id, name, display_name FROM parameter_presets ORDER BY id ASC
  `).all();

  console.log('📋 残りのプリセット:');
  presets.forEach((preset: any) => {
    console.log(`  ${preset.id}. ${preset.display_name} (${preset.name})`);
  });
  console.log('');
} catch (error) {
  console.error('❌ マイグレーション失敗:', error);
  process.exit(1);
} finally {
  db.close();
}

console.log('✅ マイグレーション完了');
