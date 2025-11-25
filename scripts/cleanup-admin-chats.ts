#!/usr/bin/env tsx
/**
 * adminユーザーのチャットログを削除するスクリプト
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const DB_FILE = join(homedir(), '.llamune', 'history.db');

console.log('📂 Database:', DB_FILE);
console.log('');

const db = new Database(DB_FILE);

try {
  // adminユーザーのIDを取得
  const adminUser = db.prepare('SELECT id, username FROM users WHERE username = ?').get('admin') as { id: number; username: string } | undefined;

  if (!adminUser) {
    console.log('⚠️  adminユーザーが見つかりません');
    process.exit(1);
  }

  console.log(`👤 ユーザー: ${adminUser.username} (ID: ${adminUser.id})`);
  console.log('');

  // adminユーザーのセッション数を確認
  const sessionCount = db
    .prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?')
    .get(adminUser.id) as { count: number };

  console.log(`📊 削除対象セッション数: ${sessionCount.count}`);

  if (sessionCount.count === 0) {
    console.log('✅ 削除対象のセッションはありません');
    process.exit(0);
  }

  // 各セッションのメッセージ数を確認
  const sessionDetails = db
    .prepare(
      `
    SELECT s.id, s.model, s.created_at, COUNT(m.id) as message_count
    FROM sessions s
    LEFT JOIN messages m ON s.id = m.session_id
    WHERE s.user_id = ?
    GROUP BY s.id
    ORDER BY s.created_at DESC
    `
    )
    .all(adminUser.id) as Array<{ id: number; model: string; created_at: string; message_count: number }>;

  console.log('');
  console.log('🗂️  セッション一覧:');
  sessionDetails.forEach((session) => {
    console.log(`  - Session ${session.id}: ${session.message_count} messages (${session.model}, ${session.created_at})`);
  });

  const totalMessages = sessionDetails.reduce((sum, s) => sum + s.message_count, 0);
  console.log('');
  console.log(`📝 合計メッセージ数: ${totalMessages}`);
  console.log('');

  // 確認プロンプト
  console.log('⚠️  この操作は取り消せません！');
  console.log('');
  console.log('削除を実行するには、以下のコマンドを再度実行してください:');
  console.log('');
  console.log('  npm run cleanup-admin-chats -- --confirm');
  console.log('');

  // --confirmフラグがあれば削除実行
  if (process.argv.includes('--confirm')) {
    console.log('🗑️  削除を実行します...');
    console.log('');

    // トランザクション開始
    db.prepare('BEGIN').run();

    try {
      // メッセージを削除
      const deletedMessages = db.prepare('DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)').run(adminUser.id);

      console.log(`✅ ${deletedMessages.changes} 件のメッセージを削除しました`);

      // セッションを削除
      const deletedSessions = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(adminUser.id);

      console.log(`✅ ${deletedSessions.changes} 件のセッションを削除しました`);

      // コミット
      db.prepare('COMMIT').run();

      console.log('');
      console.log('✨ 削除が完了しました！');
    } catch (error) {
      // エラー時はロールバック
      db.prepare('ROLLBACK').run();
      console.error('❌ エラーが発生しました:', error);
      process.exit(1);
    }
  }
} finally {
  db.close();
}
