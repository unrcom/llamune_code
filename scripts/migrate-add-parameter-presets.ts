#!/usr/bin/env tsx

/**
 * マイグレーション: parameter_presetsテーブルを追加
 *
 * パラメータプリセット機能のためのテーブルを作成します。
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const configDir = join(homedir(), '.llamune_code');
const dbPath = join(configDir, 'history.db');

// ディレクトリが存在しない場合は作成
if (!existsSync(configDir)) {
  mkdirSync(configDir, { recursive: true });
}

console.log('📂 Database:', dbPath);
console.log('');

const db = new Database(dbPath);

try {
  console.log('🔄 マイグレーションを実行します...');
  console.log('');

  // parameter_presets テーブルが存在するか確認
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='parameter_presets'")
    .all() as Array<{ name: string }>;

  if (tables.length > 0) {
    console.log('✅ parameter_presets テーブルは既に存在します');
    console.log('');
  } else {
    // parameter_presets テーブルを作成
    db.exec(`
      CREATE TABLE parameter_presets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        description TEXT,
        temperature REAL,
        top_p REAL,
        top_k INTEGER,
        repeat_penalty REAL,
        num_ctx INTEGER,
        created_at TEXT NOT NULL
      )
    `);
    console.log('✅ parameter_presets テーブルを作成しました');
    console.log('');

    // デフォルトプリセットを登録
    const now = new Date().toISOString();
    const presets = [
      {
        name: 'default',
        display_name: 'デフォルト',
        description: 'バランスの取れた標準設定',
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        repeat_penalty: 1.1,
        num_ctx: 2048,
      },
      {
        name: 'creative',
        display_name: '高感度',
        description: '創造的で多様な回答',
        temperature: 1.0,
        top_p: 0.95,
        top_k: 50,
        repeat_penalty: 1.05,
        num_ctx: 2048,
      },
      {
        name: 'precise',
        display_name: '事務的',
        description: '正確で決定的な回答',
        temperature: 0.3,
        top_p: 0.8,
        top_k: 20,
        repeat_penalty: 1.2,
        num_ctx: 2048,
      },
    ];

    const insert = db.prepare(`
      INSERT INTO parameter_presets
      (name, display_name, description, temperature, top_p, top_k, repeat_penalty, num_ctx, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const preset of presets) {
      insert.run(
        preset.name,
        preset.display_name,
        preset.description,
        preset.temperature,
        preset.top_p,
        preset.top_k,
        preset.repeat_penalty,
        preset.num_ctx,
        now
      );
    }

    console.log('✅ デフォルトプリセットを登録しました');
    console.log('');
  }

  // テーブル構造を表示
  console.log('📊 parameter_presets テーブル構造:');
  const tableInfo = db.pragma('table_info(parameter_presets)') as Array<{
    name: string;
    type: string;
  }>;
  tableInfo.forEach((col) => {
    console.log(`  ${col.name}: ${col.type}`);
  });
  console.log('');

  // 登録されているプリセットを表示
  const registeredPresets = db
    .prepare('SELECT name, display_name, temperature, top_p FROM parameter_presets')
    .all() as Array<{ name: string; display_name: string; temperature: number; top_p: number }>;

  console.log('📋 登録済みプリセット:');
  registeredPresets.forEach((preset) => {
    console.log(`  - ${preset.display_name} (${preset.name}): temp=${preset.temperature}, top_p=${preset.top_p}`);
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
