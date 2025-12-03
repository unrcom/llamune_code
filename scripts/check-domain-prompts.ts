#!/usr/bin/env tsx

/**
 * ドメインプロンプトを確認するスクリプト
 */

import { initDatabase } from '../src/utils/database.js';

const db = initDatabase();

try {
  console.log('📋 登録済みドメインとプロンプト:');
  console.log('');

  const domains = db.prepare('SELECT * FROM domain_modes ORDER BY id ASC').all() as Array<{
    id: number;
    name: string;
    display_name: string;
    description: string;
    icon: string;
    enabled: number;
  }>;

  for (const domain of domains) {
    const enabledStatus = domain.enabled ? '有効' : '無効';
    console.log(`${domain.icon} ${domain.display_name} (${domain.name}) [${enabledStatus}]`);
    console.log(`   説明: ${domain.description}`);

    const prompts = db
      .prepare('SELECT * FROM domain_prompts WHERE domain_mode_id = ? ORDER BY id ASC')
      .all(domain.id) as Array<{
        id: number;
        name: string;
        display_name: string;
        description: string;
        system_prompt: string | null;
        recommended_model: string;
        is_default: number;
      }>;

    if (prompts.length === 0) {
      console.log('   ⚠️  プロンプトが登録されていません');
    } else {
      prompts.forEach((prompt) => {
        const defaultMark = prompt.is_default ? ' [デフォルト]' : '';
        console.log(`   - ${prompt.display_name} (${prompt.name})${defaultMark}`);
        console.log(`     説明: ${prompt.description}`);
        console.log(`     推奨モデル: ${prompt.recommended_model}`);
        if (prompt.system_prompt) {
          console.log(`     システムプロンプト: ${prompt.system_prompt.substring(0, 50)}...`);
        }
      });
    }

    console.log('');
  }
} catch (error) {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
} finally {
  db.close();
}
