#!/usr/bin/env tsx
/**
 * データベーススキーマを確認するスクリプト
 */

import { initDatabase } from '../src/utils/database.js';

console.log('📋 Checking database schema...\n');

const db = initDatabase();

// sessionsテーブルの構造を確認
console.log('Sessions table columns:');
const sessionsInfo = db.pragma('table_info(sessions)');
console.table(sessionsInfo);

// user_repositoriesテーブルが存在するか確認
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_repositories'").all();
if (tables.length > 0) {
  console.log('\n✓ user_repositories table exists');
  const repoInfo = db.pragma('table_info(user_repositories)');
  console.table(repoInfo);
} else {
  console.log('\n❌ user_repositories table does NOT exist - migration needed!');
}

// domain_modesテーブルを確認
const domainTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='domain_modes'").all();
if (domainTables.length > 0) {
  console.log('\n✓ domain_modes table exists');
  const modes = db.prepare('SELECT * FROM domain_modes').all();
  console.table(modes);
} else {
  console.log('\n❌ domain_modes table does NOT exist - migration needed!');
}

// domain_promptsテーブルを確認
const promptTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='domain_prompts'").all();
if (promptTables.length > 0) {
  console.log('\n✓ domain_prompts table exists');
  const prompts = db.prepare('SELECT id, domain_mode_id, name, display_name FROM domain_prompts').all();
  console.table(prompts);
} else {
  console.log('\n❌ domain_prompts table does NOT exist - migration needed!');
}

db.close();
