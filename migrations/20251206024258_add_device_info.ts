import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('refresh_tokens', (table) => {
    table.string('device_fingerprint').comment('デバイス識別用ハッシュ');
    table.string('device_type').comment('デバイスタイプ (desktop/mobile/tablet)');
    table.text('last_used_at').comment('最終使用日時');
    table.string('created_via').defaultTo('login').comment('作成元 (login/refresh)');
  });

  // 既存レコードのlast_used_atとcreated_viaを初期化
  await knex.raw(`
    UPDATE refresh_tokens 
    SET last_used_at = created_at,
        created_via = 'login'
    WHERE last_used_at IS NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('refresh_tokens', (table) => {
    table.dropColumn('device_fingerprint');
    table.dropColumn('device_type');
    table.dropColumn('last_used_at');
    table.dropColumn('created_via');
  });
}
