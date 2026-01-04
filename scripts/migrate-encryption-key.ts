/**
 * 暗号化キーを移行（旧キー→新キー）
 * domain_promptsテーブルの全データを再暗号化
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

// 旧キーと新キー
const OLD_KEY = 'CdXUKrHX/Y3euKODrP56oB7vEGMCvPIQusaz7qAVkaE=';
const NEW_KEY = 'QGhf1T2Os7HpIfl02Ab8gAIz/nXtp5au9O05ZLpbkjg='; // "mop" のハッシュ

console.log('🔑 暗号化キーの移行を開始します...');
console.log(`📌 旧キー: ${OLD_KEY.substring(0, 20)}...`);
console.log(`📌 新キー: ${NEW_KEY.substring(0, 20)}... (パスフレーズ: "mop")\n`);

/**
 * 復号化（旧キー使用）
 */
function decrypt(encryptedText: string, key: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedData = Buffer.from(parts[2], 'hex');
  const keyBuffer = Buffer.from(key, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * 暗号化（新キー使用）
 */
function encrypt(text: string, key: string): string {
  const keyBuffer = Buffer.from(key, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

try {
  // バックアップの確認
  console.log('⚠️  重要: データベースのバックアップを取ることを強く推奨します');
  console.log('   実行前に以下のコマンドでバックアップしてください:');
  console.log('   cp ~/.llamune_code/history.db ~/.llamune_code/history.db.backup\n');
  
  // domain_promptsテーブルの全データを取得
  const prompts = db.prepare('SELECT id, name, display_name, system_prompt FROM domain_prompts').all() as any[];

  console.log(`📝 ${prompts.length}件のドメインプロンプトを再暗号化します...\n`);

  let successCount = 0;
  let errorCount = 0;

  // トランザクション開始
  db.prepare('BEGIN').run();

  for (const prompt of prompts) {
    try {
      console.log(`処理中: ID=${prompt.id}, ${prompt.display_name} (${prompt.name})`);

      // 旧キーで復号化
      const decryptedText = decrypt(prompt.system_prompt, OLD_KEY);
      console.log(`  ✅ 復号化成功 (${decryptedText.length}文字)`);

      // 新キーで暗号化
      const reencryptedText = encrypt(decryptedText, NEW_KEY);
      console.log(`  ✅ 再暗号化成功`);

      // データベース更新
      db.prepare('UPDATE domain_prompts SET system_prompt = ? WHERE id = ?').run(reencryptedText, prompt.id);
      console.log(`  ✅ データベース更新完了\n`);

      successCount++;

    } catch (error) {
      console.error(`  ❌ エラー: ${error}\n`);
      errorCount++;
      // エラーが発生したらロールバック
      db.prepare('ROLLBACK').run();
      throw error;
    }
  }

  // 全て成功したらコミット
  db.prepare('COMMIT').run();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 完了: ${successCount}件成功, ${errorCount}件エラー`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (errorCount === 0) {
    console.log('🎉 暗号化キーの移行が完了しました!');
    console.log('\n📝 次のステップ:');
    console.log('1. 環境変数を更新:');
    console.log('   export ENCRYPTION_KEY=QGhf1T2Os7HpIfl02Ab8gAIz/nXtp5au9O05ZLpbkjg=');
    console.log('');
    console.log('2. .env ファイルがある場合は更新:');
    console.log('   ENCRYPTION_KEY=QGhf1T2Os7HpIfl02Ab8gAIz/nXtp5au9O05ZLpbkjg=');
    console.log('');
    console.log('3. 確認:');
    console.log('   export ENCRYPTION_KEY=QGhf1T2Os7HpIfl02Ab8gAIz/nXtp5au9O05ZLpbkjg=');
    console.log('   npx tsx scripts/decrypt-domain-prompts.ts');
    console.log('');
    console.log('💡 パスフレーズ "mop" から生成したキーなので、忘れても再生成できます:');
    console.log('   echo -n "mop" | openssl dgst -sha256 -binary | base64');
  }

} catch (error) {
  console.error('\n❌ 致命的エラーが発生しました:', error);
  console.error('\n🔄 バックアップから復元してください:');
  console.error('   cp ~/.llamune_code/history.db.backup ~/.llamune_code/history.db');
  process.exit(1);
} finally {
  db.close();
}
