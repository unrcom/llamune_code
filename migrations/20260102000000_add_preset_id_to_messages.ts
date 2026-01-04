import type { Knex } from 'knex';

/**
 * メッセージにpreset_idを追加
 * どのパラメータプリセットで生成されたかを記録
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('messages', (table) => {
    table.integer('preset_id').nullable();
  });

  console.log('✅ Added preset_id column to messages table');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('messages', (table) => {
    table.dropColumn('preset_id');
  });

  console.log('✅ Removed preset_id column from messages table');
}
