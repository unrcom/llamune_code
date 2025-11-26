#!/usr/bin/env tsx
/**
 * データベース内のセッション情報を確認するスクリプト
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const DB_FILE = join(homedir(), '.llamune_code', 'history.db');

console.log('📂 Database:', DB_FILE);
console.log('');

const db = new Database(DB_FILE);

try {
  // すべてのユーザーを表示
  const users = db.prepare('SELECT id, username, role FROM users').all() as Array<{ id: number; username: string; role: string }>;

  console.log('👥 ユーザー一覧:');
  users.forEach((user) => {
    console.log(`  - ${user.username} (ID: ${user.id}, Role: ${user.role})`);
  });
  console.log('');

  // 各ユーザーのセッション数とメッセージ数を表示
  for (const user of users) {
    const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?').get(user.id) as { count: number };

    const messageCount = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM messages
      WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)
    `
      )
      .get(user.id) as { count: number };

    console.log(`📊 ${user.username}:`);
    console.log(`   セッション数: ${sessionCount.count}`);
    console.log(`   メッセージ数: ${messageCount.count}`);

    if (sessionCount.count > 0) {
      // 最近のセッション5件を表示
      const recentSessions = db
        .prepare(
          `
        SELECT s.id, s.model, s.created_at, s.title, COUNT(m.id) as message_count
        FROM sessions s
        LEFT JOIN messages m ON s.id = m.session_id
        WHERE s.user_id = ?
        GROUP BY s.id
        ORDER BY s.created_at DESC
        LIMIT 5
      `
        )
        .all(user.id) as Array<{ id: number; model: string; created_at: string; title: string | null; message_count: number }>;

      console.log('   最近のセッション:');
      recentSessions.forEach((session) => {
        const title = session.title ? ` "${session.title}"` : '';
        console.log(`   - ID: ${session.id}${title}: ${session.message_count} messages (${session.model}, ${session.created_at})`);
      });
    }
    console.log('');
  }

  // 合計
  const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
  const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };

  console.log('📈 合計:');
  console.log(`   セッション数: ${totalSessions.count}`);
  console.log(`   メッセージ数: ${totalMessages.count}`);
} finally {
  db.close();
}
