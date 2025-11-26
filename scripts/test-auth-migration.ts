#!/usr/bin/env tsx
/**
 * Phase 1 マイグレーション動作確認スクリプト
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

const DB_DIR = join(homedir(), '.llamune_code');
const DB_FILE = join(DB_DIR, 'history.db');

console.log('📂 Database:', DB_FILE);
console.log('');

if (!existsSync(DB_FILE)) {
  console.error('❌ データベースファイルが見つかりません');
  console.log('まずマイグレーションを実行してください: npm run migrate:auth');
  process.exit(1);
}

const db = new Database(DB_FILE);

console.log('🔍 Phase 1 マイグレーション確認を開始します...');
console.log('');

let allPassed = true;

// ========================================
// 1. usersテーブルの確認
// ========================================
console.log('1️⃣ usersテーブルの確認');

const usersTableExists = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
  .get();

if (usersTableExists) {
  console.log('   ✅ usersテーブルが存在します');

  // テーブル構造を確認
  const usersColumns = db.pragma('table_info(users)') as Array<{ name: string }>;
  const expectedColumns = ['id', 'username', 'password_hash', 'role', 'created_at', 'updated_at'];
  const actualColumns = usersColumns.map((col) => col.name);

  const missingColumns = expectedColumns.filter((col) => !actualColumns.includes(col));
  if (missingColumns.length === 0) {
    console.log('   ✅ 必要なカラムが全て存在します');
  } else {
    console.log(`   ❌ 不足しているカラム: ${missingColumns.join(', ')}`);
    allPassed = false;
  }

  // デフォルトユーザーの存在確認
  const adminUser = db
    .prepare("SELECT id, username, role FROM users WHERE username = 'admin'")
    .get() as { id: number; username: string; role: string } | undefined;

  if (adminUser) {
    console.log(`   ✅ デフォルトユーザーが存在します (ID: ${adminUser.id}, Role: ${adminUser.role})`);
  } else {
    console.log('   ❌ デフォルトユーザーが見つかりません');
    allPassed = false;
  }
} else {
  console.log('   ❌ usersテーブルが存在しません');
  allPassed = false;
}

console.log('');

// ========================================
// 2. refresh_tokensテーブルの確認
// ========================================
console.log('2️⃣ refresh_tokensテーブルの確認');

const refreshTokensTableExists = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='refresh_tokens'")
  .get();

if (refreshTokensTableExists) {
  console.log('   ✅ refresh_tokensテーブルが存在します');

  // テーブル構造を確認
  const refreshTokensColumns = db.pragma('table_info(refresh_tokens)') as Array<{
    name: string;
  }>;
  const expectedColumns = ['id', 'user_id', 'token', 'expires_at', 'created_at'];
  const actualColumns = refreshTokensColumns.map((col) => col.name);

  const missingColumns = expectedColumns.filter((col) => !actualColumns.includes(col));
  if (missingColumns.length === 0) {
    console.log('   ✅ 必要なカラムが全て存在します');
  } else {
    console.log(`   ❌ 不足しているカラム: ${missingColumns.join(', ')}`);
    allPassed = false;
  }

  // インデックスの確認
  const indexes = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='refresh_tokens'"
    )
    .all() as Array<{ name: string }>;

  if (indexes.some((idx) => idx.name.includes('token'))) {
    console.log('   ✅ tokenカラムにインデックスが設定されています');
  } else {
    console.log('   ⚠️  tokenカラムにインデックスが設定されていません（パフォーマンスに影響）');
  }
} else {
  console.log('   ❌ refresh_tokensテーブルが存在しません');
  allPassed = false;
}

console.log('');

// ========================================
// 3. sessionsテーブルのuser_idカラム確認
// ========================================
console.log('3️⃣ sessionsテーブルのuser_idカラム確認');

const sessionsTableExists = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
  .get();

if (sessionsTableExists) {
  console.log('   ✅ sessionsテーブルが存在します');

  // user_idカラムの存在確認
  const sessionsColumns = db.pragma('table_info(sessions)') as Array<{ name: string }>;
  const hasUserIdColumn = sessionsColumns.some((col) => col.name === 'user_id');

  if (hasUserIdColumn) {
    console.log('   ✅ user_idカラムが追加されています');

    // 既存セッションがadminに紐付けられているか確認
    const sessionCount = db
      .prepare('SELECT COUNT(*) as count FROM sessions')
      .get() as { count: number };

    const linkedSessionCount = db
      .prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id IS NOT NULL')
      .get() as { count: number };

    console.log(`   📊 総セッション数: ${sessionCount.count}`);
    console.log(`   📊 紐付け済みセッション数: ${linkedSessionCount.count}`);

    if (sessionCount.count === linkedSessionCount.count) {
      console.log('   ✅ 全てのセッションがユーザーに紐付けられています');
    } else if (sessionCount.count === 0) {
      console.log('   ℹ️  セッションがまだ作成されていません（正常）');
    } else {
      console.log('   ⚠️  一部のセッションがユーザーに紐付けられていません');
    }
  } else {
    console.log('   ❌ user_idカラムが追加されていません');
    allPassed = false;
  }
} else {
  console.log('   ⚠️  sessionsテーブルが存在しません（まだCLIを使用していない場合は正常）');
}

console.log('');

// ========================================
// 4. 外部キー制約の確認
// ========================================
console.log('4️⃣ 外部キー制約の確認');

const foreignKeys = db.pragma('foreign_key_list(sessions)') as Array<{
  table: string;
  from: string;
  to: string;
}>;

// sessions.user_id -> users.id の外部キー
const userForeignKey = foreignKeys.find(
  (fk) => fk.table === 'users' && fk.from === 'user_id'
);

if (userForeignKey) {
  console.log('   ✅ sessions.user_id -> users.id の外部キー制約が設定されています');
} else {
  console.log(
    '   ⚠️  sessions.user_id -> users.id の外部キー制約が見つかりません（SQLiteの制限により、既存テーブルへの外部キー追加は制限されます）'
  );
}

const refreshTokenForeignKeys = db.pragma('foreign_key_list(refresh_tokens)') as Array<{
  table: string;
  from: string;
  to: string;
}>;

const refreshTokenUserForeignKey = refreshTokenForeignKeys.find(
  (fk) => fk.table === 'users' && fk.from === 'user_id'
);

if (refreshTokenUserForeignKey) {
  console.log(
    '   ✅ refresh_tokens.user_id -> users.id の外部キー制約が設定されています'
  );
} else {
  console.log(
    '   ❌ refresh_tokens.user_id -> users.id の外部キー制約が見つかりません'
  );
  allPassed = false;
}

console.log('');

// ========================================
// まとめ
// ========================================
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (allPassed) {
  console.log('✅ Phase 1 マイグレーション: 成功');
  console.log('');
  console.log('次のステップ:');
  console.log('1. .env ファイルを作成: cp .env.example .env');
  console.log('2. JWT_SECRET を設定: openssl rand -base64 32');
  console.log('3. Phase 2 の実装に進む');
} else {
  console.log('❌ Phase 1 マイグレーション: 問題が検出されました');
  console.log('');
  console.log('対処方法:');
  console.log('1. マイグレーションを再実行: npm run migrate:auth');
  console.log('2. 問題が解決しない場合は、データベースを削除して再実行:');
  console.log('   rm ~/.llamune_code/history.db && npm run migrate:auth');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

db.close();
process.exit(allPassed ? 0 : 1);
