/**
 * レガシーセッション移行スクリプト
 * user_idがnullの古いセッションを指定ユーザーに割り当てる
 */

import Database from 'better-sqlite3';
import { getUserByUsername } from '../src/utils/database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const username = process.argv[2];

  if (!username) {
    console.error('❌ Usage: npm run migrate-sessions <username>');
    console.error('   Example: npm run migrate-sessions admin');
    process.exit(1);
  }

  // ユーザーを検索
  const user = getUserByUsername(username);
  if (!user) {
    console.error(`❌ User "${username}" not found`);
    process.exit(1);
  }

  // データベースに接続
  const dbPath = path.join(__dirname, '..', 'data', 'chat.db');
  const db = Database(dbPath);

  // user_idがnullのセッションを数える
  const countResult = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id IS NULL').get() as { count: number };
  const nullSessionCount = countResult.count;

  if (nullSessionCount === 0) {
    console.log('✅ No legacy sessions found (all sessions have user_id)');
    db.close();
    process.exit(0);
  }

  console.log(`📊 Found ${nullSessionCount} legacy session(s) without user_id`);
  console.log(`👤 Assigning them to user: ${user.username} (ID: ${user.id})`);
  console.log('');

  // user_idがnullのセッションを更新
  const result = db.prepare('UPDATE sessions SET user_id = ? WHERE user_id IS NULL').run(user.id);

  console.log(`✅ Successfully assigned ${result.changes} session(s) to ${user.username}`);
  console.log('');
  console.log('You can now access these sessions in the GUI.');

  db.close();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
