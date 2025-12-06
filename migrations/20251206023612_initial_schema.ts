import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. users テーブル
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('username').notNullable().unique();
    table.string('password_hash').notNullable();
    table.string('role').notNullable().defaultTo('user');
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    
    table.unique(['username'], { indexName: 'idx_users_username' });
  });

  // 2. refresh_tokens テーブル
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable();
    table.string('token').notNullable().unique();
    table.text('expires_at').notNullable();
    table.text('created_at').notNullable();
    
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.index('user_id', 'idx_refresh_tokens_user_id');
    table.unique(['token'], { indexName: 'idx_refresh_tokens_token' });
  });

  // 3. parameter_presets テーブル
  await knex.schema.createTable('parameter_presets', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.string('display_name').notNullable();
    table.text('description');
    table.float('temperature');
    table.float('top_p');
    table.integer('top_k');
    table.float('repeat_penalty');
    table.integer('num_ctx');
    table.text('created_at').notNullable();
  });

  // 4. domain_modes テーブル
  await knex.schema.createTable('domain_modes', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.string('display_name').notNullable();
    table.text('description');
    table.string('icon');
    table.integer('enabled').defaultTo(1);
    table.text('created_at').notNullable();
  });

  // 5. domain_prompts テーブル
  await knex.schema.createTable('domain_prompts', (table) => {
    table.increments('id').primary();
    table.integer('domain_mode_id').notNullable();
    table.string('name').notNullable();
    table.string('display_name').notNullable();
    table.text('description');
    table.text('system_prompt');
    table.string('recommended_model');
    table.integer('preset_id');
    table.integer('is_default').defaultTo(0);
    table.text('created_at').notNullable();
    
    table.foreign('domain_mode_id').references('domain_modes.id');
    table.foreign('preset_id').references('parameter_presets.id');
  });

  // 6. sessions テーブル
  await knex.schema.createTable('sessions', (table) => {
    table.increments('id').primary();
    table.string('model').notNullable();
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.string('title');
    table.integer('user_id');
    table.integer('domain_mode_id');
    table.integer('domain_prompt_id');
    table.text('repository_path');
    table.string('current_branch');
    table.integer('repository_id');
    table.string('working_branch');
    
    table.foreign('user_id').references('users.id');
    table.foreign('domain_mode_id').references('domain_modes.id');
    table.foreign('domain_prompt_id').references('domain_prompts.id');
    table.index('user_id', 'idx_sessions_user_id');
  });

  // 7. messages テーブル
  await knex.schema.createTable('messages', (table) => {
    table.increments('id').primary();
    table.integer('session_id').notNullable();
    table.string('role').notNullable();
    table.text('content').notNullable();
    table.text('created_at').notNullable();
    table.string('model');
    table.text('deleted_at');
    
    table.foreign('session_id').references('sessions.id');
  });

  // 8. recommended_models テーブル
  await knex.schema.createTable('recommended_models', (table) => {
    table.increments('id').primary();
    table.integer('min_memory_gb').notNullable();
    table.integer('max_memory_gb');
    table.string('model_name').notNullable();
    table.string('model_size').notNullable();
    table.text('description').notNullable();
    table.integer('priority').notNullable();
    table.text('created_at').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  // ロールバック時は逆順で削除
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('recommended_models');
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('domain_prompts');
  await knex.schema.dropTableIfExists('domain_modes');
  await knex.schema.dropTableIfExists('parameter_presets');
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('users');
}
