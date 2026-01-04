import type { Knex } from 'knex';
import crypto from 'crypto';

/**
 * システムプロンプトの暗号化を廃止
 * domain_prompts.system_prompt を復号化して平文で保存
 */

// 環境変数から暗号化キーを取得（マイグレーション実行時に必要）
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

/**
 * 復号化関数
 */
function decrypt(encryptedText: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is required for migration');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    // 既に平文の場合はそのまま返す
    return encryptedText;
  }

  try {
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedData = Buffer.from(parts[2], 'hex');
    const key = Buffer.from(ENCRYPTION_KEY, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    // 復号化に失敗した場合はそのまま返す（既に平文の可能性）
    console.warn(`Failed to decrypt, assuming plaintext: ${error}`);
    return encryptedText;
  }
}

/**
 * 暗号化関数（rollback用）
 */
function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is required for migration');
  }

  const key = Buffer.from(ENCRYPTION_KEY, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export async function up(knex: Knex): Promise<void> {
  console.log('📝 Decrypting system prompts in domain_prompts table...');

  // 全てのドメインプロンプトを取得
  const prompts = await knex('domain_prompts').select('id', 'system_prompt');

  for (const prompt of prompts) {
    if (!prompt.system_prompt) continue;

    // 復号化
    const decryptedPrompt = decrypt(prompt.system_prompt);

    // 平文で保存
    await knex('domain_prompts')
      .where('id', prompt.id)
      .update({ system_prompt: decryptedPrompt });

    console.log(`  ✅ Decrypted prompt ID: ${prompt.id}`);
  }

  console.log('✅ All system prompts decrypted successfully');
}

export async function down(knex: Knex): Promise<void> {
  console.log('📝 Re-encrypting system prompts in domain_prompts table...');

  // 全てのドメインプロンプトを取得
  const prompts = await knex('domain_prompts').select('id', 'system_prompt');

  for (const prompt of prompts) {
    if (!prompt.system_prompt) continue;

    // 暗号化
    const encryptedPrompt = encrypt(prompt.system_prompt);

    // 暗号化して保存
    await knex('domain_prompts')
      .where('id', prompt.id)
      .update({ system_prompt: encryptedPrompt });

    console.log(`  ✅ Encrypted prompt ID: ${prompt.id}`);
  }

  console.log('✅ All system prompts re-encrypted successfully');
}
