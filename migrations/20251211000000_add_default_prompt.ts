import type { Knex } from 'knex';

/**
 * デフォルトプロンプトテーブルを追加
 * 推論モードで使用される汎用システムプロンプトをDBで管理
 */
export async function up(knex: Knex): Promise<void> {
  // default_prompt テーブルを作成
  await knex.schema.createTable('default_prompt', (table) => {
    table.increments('id').primary();
    table.text('system_prompt').notNullable();
    table.text('description').nullable(); // プロンプトの説明（任意）
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // 初期データを挿入
  await knex('default_prompt').insert({
    system_prompt: '**必ず日本語で応答してください。**\n\nあなたは親切なAIアシスタントです。ユーザーの質問に丁寧に答えてください。',
    description: '推論モード用のデフォルトシステムプロンプト',
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('default_prompt');
}
