import { initDatabase } from '../src/utils/database.js';

const db = initDatabase();

console.log('🔄 Replacing general domain with specialized domains...');

try {
  db.exec('BEGIN TRANSACTION');

  // 既存のドメインとプロンプトを削除
  console.log('🗑️  Deleting existing general domain and prompts...');
  db.exec('DELETE FROM domain_prompts WHERE domain_mode_id = 1');
  db.exec('DELETE FROM domain_modes WHERE id = 1');

  // 新しい専門ドメインを追加
  console.log('➕ Adding specialized domains...');

  const now = new Date().toISOString();

  const domains = [
    { name: 'accounting', display_name: '会計・財務', description: '会計・財務業務の支援', icon: '💰' },
    { name: 'legal', display_name: '法律', description: '法律業務の支援', icon: '⚖️' },
    { name: 'healthcare', display_name: '医療・健康', description: '医療・健康分野の支援', icon: '🏥' },
    { name: 'marketing', display_name: 'マーケティング', description: 'マーケティング業務の支援', icon: '📊' },
    { name: 'engineering', display_name: 'エンジニアリング', description: 'エンジニアリング業務の支援', icon: '🔧' },
  ];

  const insertDomain = db.prepare(`
    INSERT INTO domain_modes (name, display_name, description, icon, enabled, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `);

  const insertPrompt = db.prepare(`
    INSERT INTO domain_prompts (
      domain_mode_id,
      name,
      display_name,
      description,
      system_prompt,
      recommended_model,
      preset_id,
      is_default,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  for (const domain of domains) {
    const result = insertDomain.run(
      domain.name,
      domain.display_name,
      domain.description,
      domain.icon,
      now
    );

    const domainId = result.lastInsertRowid;
    const systemPrompt = `あなたは${domain.display_name}ドメインの専門家です。ユーザーの業務を支援してください。`;

    insertPrompt.run(
      domainId,
      'chat',
      'チャット',
      '対話的な会話',
      systemPrompt,
      'gemma2:9b',
      1, // default preset
      now
    );

    console.log(`  ✅ ${domain.icon} ${domain.display_name}`);
  }

  db.exec('COMMIT');
  console.log('✅ Migration completed successfully!');
  console.log(`📊 Added ${domains.length} specialized domains with chat prompts`);

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Migration failed:', error);
  throw error;
}
