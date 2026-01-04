/**
 * domain_promptsテーブルのシステムプロンプトを復号化して表示
 */
import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(homedir(), '.llamune_code', 'history.db');
const db = new Database(dbPath);

// 暗号化キーを環境変数から取得
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY環境変数が設定されていません');
  process.exit(1);
}

/**
 * AES-256-GCMで復号化
 */
function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedData = Buffer.from(parts[2], 'hex');
  const key = Buffer.from(ENCRYPTION_KEY, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

try {
  console.log('🔍 domain_promptsテーブルのシステムプロンプトを確認します...\n');

  // すべてのドメインプロンプトを取得
  const prompts = db.prepare(`
    SELECT id, name, display_name, description, system_prompt 
    FROM domain_prompts 
    ORDER BY id
  `).all() as any[];

  for (const prompt of prompts) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 ID: ${prompt.id}`);
    console.log(`🏷️  Name: ${prompt.name}`);
    console.log(`📌 表示名: ${prompt.display_name}`);
    console.log(`📝 説明: ${prompt.description}`);
    
    if (prompt.system_prompt) {
      try {
        const decryptedPrompt = decrypt(prompt.system_prompt);
        console.log(`\n💬 システムプロンプト:`);
        console.log('----------------------------------------');
        console.log(decryptedPrompt);
        console.log('----------------------------------------');
      } catch (error) {
        console.log(`⚠️  復号化エラー: ${error}`);
      }
    } else {
      console.log('⚠️  システムプロンプトが設定されていません');
    }
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

} catch (error) {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
} finally {
  db.close();
}
