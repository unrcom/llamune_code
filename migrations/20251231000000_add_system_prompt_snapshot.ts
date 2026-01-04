import type { Knex } from 'knex';

/**
 * セッションにシステムプロンプトのスナップショットを保存
 * セッション作成時のシステムプロンプトを保存することで、
 * domain_promptsが変更されても過去のセッションは正しいプロンプトを表示できる
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sessions', (table) => {
    table.text('system_prompt_snapshot').nullable();
  });

  console.log('✅ Added system_prompt_snapshot column to sessions table');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sessions', (table) => {
    table.dropColumn('system_prompt_snapshot');
  });

  console.log('✅ Removed system_prompt_snapshot column from sessions table');
}
