#!/usr/bin/env tsx

/**
 * マイグレーション: domain_modes と domain_prompts テーブルを追加
 *
 * ドメイン特化モード機能のためのテーブルを作成します。
 */

import { initDatabase } from '../src/utils/database.js';

console.log('📂 データベースを初期化します...');
console.log('');

const db = initDatabase();

try {
  console.log('🔄 マイグレーションを実行します...');
  console.log('');

  // domain_modes テーブルが存在するか確認
  const domainModesExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='domain_modes'")
    .all() as Array<{ name: string }>;

  if (domainModesExists.length > 0) {
    console.log('✅ domain_modes テーブルは既に存在します');
  } else {
    // domain_modes テーブルを作成
    db.exec(`
      CREATE TABLE domain_modes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      )
    `);
    console.log('✅ domain_modes テーブルを作成しました');
  }

  // domain_prompts テーブルが存在するか確認
  const domainPromptsExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='domain_prompts'")
    .all() as Array<{ name: string }>;

  if (domainPromptsExists.length > 0) {
    console.log('✅ domain_prompts テーブルは既に存在します');
  } else {
    // domain_prompts テーブルを作成
    db.exec(`
      CREATE TABLE domain_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_mode_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT,
        system_prompt TEXT,
        recommended_model TEXT,
        preset_id INTEGER,
        is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (domain_mode_id) REFERENCES domain_modes(id),
        FOREIGN KEY (preset_id) REFERENCES parameter_presets(id)
      )
    `);
    console.log('✅ domain_prompts テーブルを作成しました');
  }

  console.log('');

  // sessions テーブルに domain_mode_id と domain_prompt_id カラムを追加
  const sessionsTableInfo = db.pragma('table_info(sessions)') as Array<{ name: string }>;
  const hasDomainModeId = sessionsTableInfo.some((col) => col.name === 'domain_mode_id');
  const hasDomainPromptId = sessionsTableInfo.some((col) => col.name === 'domain_prompt_id');

  if (!hasDomainModeId) {
    db.exec('ALTER TABLE sessions ADD COLUMN domain_mode_id INTEGER REFERENCES domain_modes(id)');
    console.log('✅ sessions テーブルに domain_mode_id カラムを追加しました');
  } else {
    console.log('✅ sessions テーブルの domain_mode_id カラムは既に存在します');
  }

  if (!hasDomainPromptId) {
    db.exec('ALTER TABLE sessions ADD COLUMN domain_prompt_id INTEGER REFERENCES domain_prompts(id)');
    console.log('✅ sessions テーブルに domain_prompt_id カラムを追加しました');
  } else {
    console.log('✅ sessions テーブルの domain_prompt_id カラムは既に存在します');
  }

  console.log('');

  // 初期データを投入
  const now = new Date().toISOString();

  // domain_modes に「汎用」ドメインを登録
  const existingDomain = db
    .prepare("SELECT id FROM domain_modes WHERE name = 'general'")
    .get() as { id: number } | undefined;

  let domainId: number;

  if (existingDomain) {
    console.log('✅ domain_modes: 汎用ドメインは既に登録されています');
    domainId = existingDomain.id;
  } else {
    const domainResult = db
      .prepare(`
        INSERT INTO domain_modes (name, display_name, description, icon, enabled, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run('general', '汎用', '一般的なタスク', '💼', 1, now);
    domainId = domainResult.lastInsertRowid as number;
    console.log('✅ domain_modes: 汎用ドメインを登録しました');
  }

  // domain_prompts に「チャット」プロンプトを登録
  const existingPrompt = db
    .prepare("SELECT id FROM domain_prompts WHERE domain_mode_id = ? AND name = 'chat'")
    .get(domainId) as { id: number } | undefined;

  if (existingPrompt) {
    console.log('✅ domain_prompts: チャットプロンプトは既に登録されています');
  } else {
    // デフォルトプリセットのIDを取得
    const defaultPreset = db
      .prepare("SELECT id FROM parameter_presets WHERE name = 'default'")
      .get() as { id: number } | undefined;

    const presetId = defaultPreset ? defaultPreset.id : null;

    db.prepare(`
      INSERT INTO domain_prompts
      (domain_mode_id, name, display_name, description, system_prompt, recommended_model, preset_id, is_default, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      domainId,
      'chat',
      'チャット',
      '対話的な会話',
      null,
      'gemma2:9b',
      presetId,
      1,
      now
    );
    console.log('✅ domain_prompts: チャットプロンプトを登録しました');
  }

  console.log('');

  // テーブル構造を表示
  console.log('📊 domain_modes テーブル構造:');
  const domainModesInfo = db.pragma('table_info(domain_modes)') as Array<{
    name: string;
    type: string;
  }>;
  domainModesInfo.forEach((col) => {
    console.log(`  ${col.name}: ${col.type}`);
  });
  console.log('');

  console.log('📊 domain_prompts テーブル構造:');
  const domainPromptsInfo = db.pragma('table_info(domain_prompts)') as Array<{
    name: string;
    type: string;
  }>;
  domainPromptsInfo.forEach((col) => {
    console.log(`  ${col.name}: ${col.type}`);
  });
  console.log('');

  // 登録されているデータを表示
  console.log('📋 登録済みドメインモード:');
  const registeredDomains = db
    .prepare('SELECT id, name, display_name, icon FROM domain_modes WHERE enabled = 1')
    .all() as Array<{ id: number; name: string; display_name: string; icon: string }>;

  registeredDomains.forEach((domain) => {
    console.log(`  ${domain.icon} ${domain.display_name} (${domain.name}) - ID: ${domain.id}`);
  });
  console.log('');

  console.log('📋 登録済みドメインプロンプト:');
  const registeredPrompts = db
    .prepare(`
      SELECT
        dp.id,
        dp.name,
        dp.display_name,
        dp.recommended_model,
        dp.is_default,
        dm.display_name as domain_name
      FROM domain_prompts dp
      JOIN domain_modes dm ON dp.domain_mode_id = dm.id
    `)
    .all() as Array<{
      id: number;
      name: string;
      display_name: string;
      recommended_model: string;
      is_default: number;
      domain_name: string;
    }>;

  registeredPrompts.forEach((prompt) => {
    const defaultMark = prompt.is_default ? ' [デフォルト]' : '';
    console.log(`  - ${prompt.display_name} (${prompt.name}) - ${prompt.domain_name}${defaultMark}`);
    console.log(`    推奨モデル: ${prompt.recommended_model}`);
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
