/**
 * 既存の domain_prompts.system_prompt を暗号化するスクリプト
 * 
 * 使用方法:
 * npm run encrypt-domain-prompts
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { encrypt, isEncrypted } from '../src/utils/encryption';
import 'dotenv/config';

const DB_DIR = join(homedir(), '.llamune_code');
const DB_FILE = join(DB_DIR, 'history.db');

console.log('🔐 Encrypting domain_prompts.system_prompt...\n');

const db = Database(DB_FILE);

try {
  // すべての domain_prompts を取得
  const prompts = db.prepare('SELECT id, system_prompt FROM domain_prompts').all() as Array<{
    id: number;
    system_prompt: string | null;
  }>;

  console.log(`Found ${prompts.length} domain prompts\n`);

  let encryptedCount = 0;
  let skippedCount = 0;
  let alreadyEncryptedCount = 0;

  for (const prompt of prompts) {
    if (!prompt.system_prompt) {
      console.log(`Prompt ${prompt.id}: No system_prompt - skipped`);
      skippedCount++;
      continue;
    }

    // 既に暗号化されているかチェック
    if (isEncrypted(prompt.system_prompt)) {
      console.log(`Prompt ${prompt.id}: Already encrypted - skipped`);
      alreadyEncryptedCount++;
      continue;
    }

    try {
      // system_promptを暗号化
      const encrypted = encrypt(prompt.system_prompt);
      
      // データベースを更新
      db.prepare('UPDATE domain_prompts SET system_prompt = ? WHERE id = ?')
        .run(encrypted, prompt.id);

      console.log(`Prompt ${prompt.id}: ✅ Encrypted`);
      encryptedCount++;
    } catch (error) {
      console.error(`Prompt ${prompt.id}: ❌ Error:`, error instanceof Error ? error.message : error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`  ✅ Encrypted: ${encryptedCount}`);
  console.log(`  ⏭️  Already encrypted: ${alreadyEncryptedCount}`);
  console.log(`  ⏭️  Skipped (no prompt): ${skippedCount}`);
  console.log('='.repeat(60));

} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
} finally {
  db.close();
}

console.log('\n✨ Done!');
