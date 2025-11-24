#!/usr/bin/env tsx
/**
 * 管理ユーザーを作成するスクリプト
 */

import { initDatabase, createUser } from '../src/utils/database.js';

console.log('🔐 管理ユーザーを作成します...\n');

const db = initDatabase();

try {
  // 既存の admin ユーザーをチェック
  const existingAdmin = db.prepare('SELECT id, username FROM users WHERE username = ?').get('admin');

  if (existingAdmin) {
    console.log('⚠️  管理ユーザー "admin" は既に存在します');
    console.log(`   User ID: ${(existingAdmin as any).id}`);
    console.log('');
    console.log('既存のユーザーを削除して再作成する場合：');
    console.log('  DELETE FROM users WHERE username = "admin";');
  } else {
    // 管理ユーザーを作成
    const userId = createUser('admin', 'admin', 'admin');

    console.log('✅ 管理ユーザーを作成しました');
    console.log('');
    console.log('ログイン情報:');
    console.log('  Username: admin');
    console.log('  Password: admin');
    console.log('  User ID: ' + userId);
    console.log('  Role: admin');
  }
} catch (error) {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
} finally {
  db.close();
}

console.log('');
console.log('🎉 セットアップ完了！');
console.log('');
console.log('次のステップ:');
console.log('  1. APIサーバーを起動: npm run api');
console.log('  2. テストを実行: ./scripts/test-tool-calling.sh');
