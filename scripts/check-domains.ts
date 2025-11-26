#!/usr/bin/env tsx
/**
 * ドメインモードとドメインプロンプトを確認するスクリプト
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const DB_FILE = join(homedir(), '.llamune_code', 'history.db');

console.log('📂 Database:', DB_FILE);
console.log('');

const db = new Database(DB_FILE);

try {
  // ドメインモード一覧
  const domainModes = db.prepare('SELECT * FROM domain_modes ORDER BY id').all() as Array<{
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    icon: string | null;
    enabled: number;
  }>;

  console.log('📋 ドメインモード一覧:');
  domainModes.forEach((mode) => {
    const status = mode.enabled ? '✅' : '❌';
    console.log(`  ${status} ${mode.display_name} (${mode.name})`);
    if (mode.description) {
      console.log(`     ${mode.description}`);
    }

    // このドメインモードのプロンプト一覧
    const prompts = db
      .prepare('SELECT * FROM domain_prompts WHERE domain_mode_id = ? ORDER BY id')
      .all(mode.id) as Array<{
      id: number;
      name: string;
      display_name: string;
      description: string | null;
      recommended_model: string | null;
      is_default: number;
    }>;

    if (prompts.length > 0) {
      console.log('     プロンプト:');
      prompts.forEach((prompt) => {
        const defaultMark = prompt.is_default ? ' [デフォルト]' : '';
        const model = prompt.recommended_model ? ` (推奨: ${prompt.recommended_model})` : '';
        console.log(`       - ${prompt.display_name}${defaultMark}${model}`);
        if (prompt.description) {
          console.log(`         ${prompt.description}`);
        }
      });
    }
    console.log('');
  });
} finally {
  db.close();
}
