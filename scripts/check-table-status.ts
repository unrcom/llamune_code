#!/usr/bin/env tsx

import { initDatabase } from '../src/utils/database.js';

const db = initDatabase();

try {
  const checkTables = ['parameter_presets', 'users', 'domain_modes', 'domain_prompts'];

  console.log('📊 認証・プリセット・ドメイン関連テーブルの存在確認:\n');

  for (const tableName of checkTables) {
    const result = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(tableName) as { name: string } | undefined;

    const status = result ? '✅ 存在' : '❌ 未作成';
    console.log(`${tableName}: ${status}`);

    if (result) {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
      console.log(`  → データ件数: ${count.count} 件`);
    }
  }

  console.log('');
} catch (error) {
  console.error('❌ エラー:', error);
  process.exit(1);
} finally {
  db.close();
}
