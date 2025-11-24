#!/usr/bin/env tsx
/**
 * アプリ開発ドメインのシステムプロンプトを日本語応答に更新するスクリプト
 */

import { initDatabase } from '../src/utils/database.js';

console.log('🔄 システムプロンプトを更新します...\n');

const db = initDatabase();

try {
  db.exec('BEGIN TRANSACTION');

  // 既存のアプリ開発ドメインプロンプトを削除
  const result = db.prepare('DELETE FROM domain_prompts WHERE domain_mode_id = 2').run();
  console.log(`✓ 既存のドメインプロンプトを削除しました (${result.changes}件)`);

  db.exec('COMMIT');

  console.log('\n✅ 削除完了');
  console.log('\n次のステップ:');
  console.log('  npx tsx scripts/migrate-add-app-dev-domain.ts');
  console.log('\nこれで日本語応答が設定されたプロンプトが追加されます。');

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ エラー:', error);
  process.exit(1);
} finally {
  db.close();
}
