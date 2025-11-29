#!/usr/bin/env tsx
/**
 * repositoryId バグの再現テスト
 */

import { ChatSession } from '../src/core/chat-session.js';

console.log('🐛 repositoryId バグの再現テスト\n');

// ChatSessionインスタンスを作成
const session = new ChatSession('gemma2:9b', null, [], undefined, 1);

console.log('1️⃣ セッション作成完了');

// リポジトリパスを設定
const testRepoPath = '/home/user/llamune_code';
session.setRepository(testRepoPath, 'main');

console.log('2️⃣ リポジトリパスを設定:', testRepoPath);

// セッションの内部状態を確認
console.log('\n📊 内部状態の確認:');
console.log('  - repositoryPath:', (session as any).repositoryPath);
console.log('  - repositoryId:', (session as any).repositoryId);
console.log('  - workingBranch:', (session as any).workingBranch);

// バグの判定
console.log('\n🔍 バグの判定:');
if ((session as any).repositoryPath && !(session as any).repositoryId) {
  console.log('  ❌ バグ確認: repositoryPath は設定されているが repositoryId は undefined');
  console.log('  💥 影響: ツール呼び出しが有効化されない（99行目の条件が false になる）');
  console.log('\n  📝 問題のコード (chat-session.ts:99):');
  console.log('     if (this.repositoryId) {  // ← undefined のため常に false');
  console.log('       request.tools = repositoryTools;');
  console.log('     }');
} else {
  console.log('  ✅ バグなし: repositoryId が正しく設定されています');
}

console.log('\n✅ テスト完了');
