import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // messagesテーブルにthinkingカラムを追加
  await knex.schema.alterTable('messages', (table) => {
    table.text('thinking');
  });
}

export async function down(knex: Knex): Promise<void> {
  // ロールバック時はthinkingカラムを削除
  await knex.schema.alterTable('messages', (table) => {
    table.dropColumn('thinking');
  });
}
