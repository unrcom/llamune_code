import type { Knex } from 'knex';

/**
 * プロジェクトディレクトリ機能のためのマイグレーション
 * 
 * シンプルなアプローチ：
 * - project_path カラムを追加（既存のrepository_pathは残す）
 * - 既存データをコピー
 * 
 * 注意: repository_pathやGit関連カラムは削除しません（SQLiteの外部キー制約の問題を回避）
 */
export async function up(knex: Knex): Promise<void> {
  // project_path カラムが存在しない場合のみ追加
  const hasProjectPath = await knex.schema.hasColumn('sessions', 'project_path');
  if (!hasProjectPath) {
    await knex.schema.alterTable('sessions', (table) => {
      table.text('project_path').nullable();
    });

    // 既存の repository_path データを project_path にコピー
    const hasRepositoryPath = await knex.schema.hasColumn('sessions', 'repository_path');
    if (hasRepositoryPath) {
      await knex.raw(`
        UPDATE sessions 
        SET project_path = repository_path 
        WHERE repository_path IS NOT NULL
      `);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // ロールバック: project_path カラムを削除
  const hasProjectPath = await knex.schema.hasColumn('sessions', 'project_path');
  if (hasProjectPath) {
    await knex.schema.alterTable('sessions', (table) => {
      table.dropColumn('project_path');
    });
  }
}
