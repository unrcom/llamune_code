#!/usr/bin/env tsx
/**
 * sessionsテーブルにtitleカラムを追加するマイグレーションスクリプト
 * 既存セッションには最初のユーザーメッセージから自動生成
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const DB_DIR = join(homedir(), '.llamune_code');
const DB_FILE = join(DB_DIR, 'history.db');

// ディレクトリがなければ作成
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

console.log('📂 Database:', DB_FILE);
console.log('');

const db = new Database(DB_FILE);

console.log('🔄 マイグレーションを実行します...');
console.log('');

try {
  // sessionsテーブルが存在するかチェック
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
    .all();

  if (tables.length === 0) {
    console.log('⚠️ sessionsテーブルが存在しません');
    console.log('最初にCLIを実行してデータベースを初期化してください:');
    console.log('  llmn ls');
    process.exit(0);
  }

  // sessionsテーブルにtitleカラムがあるかチェック
  const tableInfo = db.pragma('table_info(sessions)');
  const hasTitleColumn = tableInfo.some((col: any) => col.name === 'title');

  if (hasTitleColumn) {
    console.log('✅ titleカラムは既に存在します');
  } else {
    console.log('➕ titleカラムを追加します...');

    // titleカラムを追加
    db.exec('ALTER TABLE sessions ADD COLUMN title TEXT');

    console.log('✅ titleカラムを追加しました');

    // 既存セッションのタイトルを自動生成
    console.log('');
    console.log('🔄 既存セッションのタイトルを生成します...');

    const sessions = db
      .prepare('SELECT id FROM sessions WHERE title IS NULL')
      .all() as { id: number }[];

    const updateTitle = db.prepare('UPDATE sessions SET title = ? WHERE id = ?');
    const getFirstMessage = db.prepare(
      `SELECT content FROM messages
       WHERE session_id = ? AND role = 'user' AND deleted_at IS NULL
       ORDER BY id ASC LIMIT 1`
    );

    let updatedCount = 0;
    for (const session of sessions) {
      const message = getFirstMessage.get(session.id) as { content: string } | undefined;
      if (message) {
        // 最初の30文字をタイトルとして使用
        const title = message.content.length > 30
          ? message.content.substring(0, 30) + '...'
          : message.content;
        updateTitle.run(title, session.id);
        updatedCount++;
      }
    }

    console.log(`✅ ${updatedCount}件のセッションにタイトルを設定しました`);
  }

  console.log('');
  console.log('📊 更新後のテーブル構造:');

  const updatedTableInfo = db.pragma('table_info(sessions)');
  updatedTableInfo.forEach((col: any) => {
    console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}`);
  });

  console.log('');
  console.log('✅ マイグレーション完了');
} catch (error) {
  console.error('❌ マイグレーションに失敗しました');
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
