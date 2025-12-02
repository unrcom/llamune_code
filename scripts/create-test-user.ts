/**
 * テストユーザーを作成するスクリプト
 */

import { createUser, getUserByUsername } from '../src/utils/database.js';
import { hashPassword } from '../src/utils/password.js';

async function main() {
  const username = process.argv[2] || 'testuser';
  const password = process.argv[3] || 'password123';
  const role = (process.argv[4] || 'user') as 'admin' | 'user';

  // 既存ユーザーチェック
  const existingUser = getUserByUsername(username);
  if (existingUser) {
    console.error(`❌ User "${username}" already exists`);
    process.exit(1);
  }

  // パスワードハッシュ化
  const passwordHash = await hashPassword(password);

  // ユーザー作成
  const userId = createUser(username, passwordHash, role);

  console.log('✅ User created successfully');
  console.log('');
  console.log(`👤 User ID: ${userId}`);
  console.log(`📧 Username: ${username}`);
  console.log(`🔐 Password: ${password}`);
  console.log(`👑 Role: ${role}`);
  console.log('');
  console.log('You can now login with these credentials.');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
