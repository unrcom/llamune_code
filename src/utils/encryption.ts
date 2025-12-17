/**
 * データベースフィールド暗号化/復号ユーティリティ
 * AES-256-GCM を使用した認証付き暗号化
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16バイト（128ビット）
const AUTH_TAG_LENGTH = 16; // 16バイト（128ビット）

/**
 * 暗号化キーを取得
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY is not set in environment variables. Run: npm run setup');
  }
  
  try {
    const keyBuffer = Buffer.from(key, 'base64');
    
    if (keyBuffer.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (256 bits)');
    }
    
    return keyBuffer;
  } catch (error) {
    throw new Error('Invalid ENCRYPTION_KEY format. It must be base64 encoded.');
  }
}

/**
 * テキストを暗号化
 * @param text 暗号化するテキスト
 * @returns 暗号化されたテキスト（フォーマット: iv:authTag:encryptedData）
 */
export function encrypt(text: string): string {
  if (!text) return text;
  
  try {
    const key = getEncryptionKey();
    
    // ランダムなIV（初期化ベクトル）を生成
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // 暗号化オブジェクトを作成
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // テキストを暗号化
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 認証タグを取得（改ざん検知用）
    const authTag = cipher.getAuthTag();
    
    // IV + authTag + 暗号化データを結合して返す
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * 暗号化されたテキストを復号
 * @param encryptedText 暗号化されたテキスト（フォーマット: iv:authTag:encryptedData）
 * @returns 復号されたテキスト
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  
  // 暗号化されていないテキストの場合はそのまま返す（後方互換性）
  if (!encryptedText.includes(':')) {
    return encryptedText;
  }
  
  try {
    const key = getEncryptionKey();
    
    // 暗号化データを分割
    const parts = encryptedText.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    // 復号オブジェクトを作成
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // データを復号
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * テキストが暗号化されているかチェック
 * @param text チェックするテキスト
 * @returns 暗号化されている場合 true
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  
  // フォーマットが「hex:hex:hex」の形式かチェック
  const parts = text.split(':');
  if (parts.length !== 3) return false;
  
  // 各パートが16進数文字列かチェック
  return parts.every(part => /^[0-9a-f]+$/i.test(part));
}
