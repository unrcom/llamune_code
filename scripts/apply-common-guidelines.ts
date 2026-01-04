/**
 * 共通ガイドラインを全てのドメインプロンプトに適用
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
  console.error('使用方法: ENCRYPTION_KEY=your_key npx tsx scripts/apply-common-guidelines.ts');
  process.exit(1);
}

/**
 * AES-256-GCMで暗号化
 */
function encrypt(text: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
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
  console.log('🔄 共通ガイドラインを全ドメインプロンプトに適用します...\n');

  // 共通ガイドラインを取得
  const commonGuideline = db.prepare('SELECT content FROM common_guidelines WHERE id = 1').get() as any;
  
  if (!commonGuideline) {
    console.error('❌ 共通ガイドラインが見つかりません');
    console.error('先にマイグレーションを実行してください: npx knex migrate:latest');
    process.exit(1);
  }

  console.log('📋 共通ガイドライン:');
  console.log('----------------------------------------');
  console.log(commonGuideline.content);
  console.log('----------------------------------------\n');

  // 全てのドメインプロンプトを取得
  const prompts = db.prepare('SELECT id, name, display_name, system_prompt FROM domain_prompts').all() as any[];

  console.log(`📝 ${prompts.length}件のドメインプロンプトを更新します...\n`);

  let updatedCount = 0;
  let errorCount = 0;

  for (const prompt of prompts) {
    try {
      console.log(`処理中: ID=${prompt.id}, ${prompt.display_name} (${prompt.name})`);

      // システムプロンプトを復号化
      const decryptedPrompt = decrypt(prompt.system_prompt);
      
      // 既存の「**必ず日本語で応答してください。**」を削除
      let cleanedPrompt = decryptedPrompt.replace(/^\*\*必ず日本語で応答してください。\*\*\n\n/, '');
      
      // 新しいシステムプロンプトを構築
      const newPrompt = `**必ず日本語で応答してください。**

${commonGuideline.content}

---

${cleanedPrompt}`;

      // 暗号化
      const encryptedPrompt = encrypt(newPrompt);

      // データベースを更新
      db.prepare(`
        UPDATE domain_prompts 
        SET system_prompt = ?
        WHERE id = ?
      `).run(encryptedPrompt, prompt.id);

      console.log(`  ✅ 更新完了\n`);
      updatedCount++;

    } catch (error) {
      console.error(`  ❌ エラー: ${error}\n`);
      errorCount++;
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 完了: ${updatedCount}件更新, ${errorCount}件エラー`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (errorCount === 0) {
    console.log('🎉 すべてのドメインプロンプトに共通ガイドラインを適用しました!');
    console.log('\n💡 確認方法:');
    console.log('   ENCRYPTION_KEY=' + ENCRYPTION_KEY + ' npx tsx scripts/decrypt-domain-prompts.ts');
  }

} catch (error) {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
} finally {
  db.close();
}
