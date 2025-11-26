#!/usr/bin/env tsx
/**
 * 指定したセッションIDを削除するスクリプト
 *
 * 使用方法:
 *   npm run delete-sessions -- 1 2 3       # セッション1,2,3を削除
 *   npm run delete-sessions -- 1-10        # セッション1から10を削除
 *   npm run delete-sessions -- --confirm 1 2 3  # 確認なしで削除
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const DB_FILE = join(homedir(), '.llamune_code', 'history.db');

console.log('📂 Database:', DB_FILE);
console.log('');

// コマンドライン引数からセッションIDを取得
const args = process.argv.slice(2);
const confirmFlag = args.includes('--confirm');
const sessionArgs = args.filter((arg) => arg !== '--confirm');

if (sessionArgs.length === 0) {
  console.log('❌ セッションIDを指定してください');
  console.log('');
  console.log('使用方法:');
  console.log('  npm run delete-sessions -- 1 2 3       # セッション1,2,3を削除');
  console.log('  npm run delete-sessions -- 1-10        # セッション1から10を削除');
  console.log('  npm run delete-sessions -- --confirm 1 # 確認なしで削除');
  console.log('');
  console.log('セッション一覧を確認:');
  console.log('  npm run check-sessions');
  process.exit(1);
}

// セッションID配列を展開（1-10のような範囲指定に対応）
const sessionIds: number[] = [];
for (const arg of sessionArgs) {
  if (arg.includes('-')) {
    const [start, end] = arg.split('-').map(Number);
    if (isNaN(start) || isNaN(end)) {
      console.log(`❌ 無効な範囲指定: ${arg}`);
      process.exit(1);
    }
    for (let i = start; i <= end; i++) {
      sessionIds.push(i);
    }
  } else {
    const id = Number(arg);
    if (isNaN(id)) {
      console.log(`❌ 無効なセッションID: ${arg}`);
      process.exit(1);
    }
    sessionIds.push(id);
  }
}

// 重複を削除してソート
const uniqueSessionIds = Array.from(new Set(sessionIds)).sort((a, b) => a - b);

console.log(`🎯 削除対象セッションID: ${uniqueSessionIds.join(', ')}`);
console.log('');

const db = new Database(DB_FILE);

try {
  // 各セッションの詳細を表示
  console.log('📋 セッション詳細:');
  const sessionDetails: Array<{ id: number; user_id: number; model: string; title: string | null; message_count: number; created_at: string }> = [];

  for (const sessionId of uniqueSessionIds) {
    const session = db
      .prepare(
        `
      SELECT s.id, s.user_id, s.model, s.title, s.created_at, COUNT(m.id) as message_count
      FROM sessions s
      LEFT JOIN messages m ON s.id = m.session_id
      WHERE s.id = ?
      GROUP BY s.id
    `
      )
      .get(sessionId) as { id: number; user_id: number; model: string; title: string | null; message_count: number; created_at: string } | undefined;

    if (session) {
      sessionDetails.push(session);
      const title = session.title ? ` "${session.title}"` : '';
      console.log(`  - ID ${session.id}${title}: ${session.message_count} messages (${session.model}, ${session.created_at})`);
    } else {
      console.log(`  - ID ${sessionId}: ⚠️  セッションが見つかりません`);
    }
  }

  if (sessionDetails.length === 0) {
    console.log('');
    console.log('❌ 削除可能なセッションがありません');
    process.exit(1);
  }

  const totalMessages = sessionDetails.reduce((sum, s) => sum + s.message_count, 0);

  console.log('');
  console.log(`📝 合計: ${sessionDetails.length} セッション、${totalMessages} メッセージ`);
  console.log('');

  if (!confirmFlag) {
    console.log('⚠️  この操作は取り消せません！');
    console.log('');
    console.log('削除を実行するには、以下のコマンドを再度実行してください:');
    console.log('');
    console.log(`  npm run delete-sessions -- --confirm ${uniqueSessionIds.join(' ')}`);
    console.log('');
    process.exit(0);
  }

  // 削除実行
  console.log('🗑️  削除を実行します...');
  console.log('');

  db.prepare('BEGIN').run();

  try {
    // メッセージを削除
    const placeholders = uniqueSessionIds.map(() => '?').join(',');
    const deletedMessages = db.prepare(`DELETE FROM messages WHERE session_id IN (${placeholders})`).run(...uniqueSessionIds);

    console.log(`✅ ${deletedMessages.changes} 件のメッセージを削除しました`);

    // セッションを削除
    const deletedSessions = db.prepare(`DELETE FROM sessions WHERE id IN (${placeholders})`).run(...uniqueSessionIds);

    console.log(`✅ ${deletedSessions.changes} 件のセッションを削除しました`);

    db.prepare('COMMIT').run();

    console.log('');
    console.log('✨ 削除が完了しました！');
  } catch (error) {
    db.prepare('ROLLBACK').run();
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
} finally {
  db.close();
}
