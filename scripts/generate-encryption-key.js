#!/usr/bin/env node

/**
 * 暗号化キーを自動生成して .env ファイルに追加するスクリプト
 */

import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ENV_FILE = resolve(process.cwd(), '.env');

function generateEncryptionKey() {
  // 32バイト（256ビット）のランダムキーを生成
  const key = randomBytes(32).toString('base64');
  return key;
}

function setupEncryptionKey() {
  let envContent = '';
  
  // .envファイルが存在する場合は読み込む
  if (existsSync(ENV_FILE)) {
    envContent = readFileSync(ENV_FILE, 'utf8');
    
    // ENCRYPTION_KEYが既に存在するかチェック
    if (envContent.includes('ENCRYPTION_KEY=') && !envContent.match(/ENCRYPTION_KEY=\s*$/m)) {
      console.log('✅ ENCRYPTION_KEY already exists in .env');
      return;
    }
  }
  
  // 新しいキーを生成
  const newKey = generateEncryptionKey();
  
  // ENCRYPTION_KEY行を探して置き換えるか、追加
  if (envContent.includes('ENCRYPTION_KEY=')) {
    // 既存の空のENCRYPTION_KEY行を置き換え
    envContent = envContent.replace(/ENCRYPTION_KEY=.*$/m, `ENCRYPTION_KEY=${newKey}`);
  } else {
    // 新しく追加
    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n';
    }
    envContent += `\n# Encryption key for database fields\nENCRYPTION_KEY=${newKey}\n`;
  }
  
  // .envファイルに書き込み
  writeFileSync(ENV_FILE, envContent, 'utf8');
  console.log('🔐 Generated new ENCRYPTION_KEY and added to .env');
  console.log('⚠️  IMPORTANT: Keep this .env file safe and never commit it to Git!');
}

// 実行
try {
  setupEncryptionKey();
} catch (error) {
  console.error('❌ Error generating encryption key:', error);
  process.exit(1);
}
