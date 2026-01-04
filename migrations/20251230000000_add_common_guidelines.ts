import type { Knex } from 'knex';

/**
 * 共通ガイドラインテーブルを追加
 * 全てのドメインプロンプトで共有される回答ガイドラインを一元管理
 */
export async function up(knex: Knex): Promise<void> {
  // common_guidelines テーブルを作成
  await knex.schema.createTable('common_guidelines', (table) => {
    table.increments('id').primary();
    table.text('content').notNullable();
    table.text('description').nullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // 初期データを挿入
  await knex('common_guidelines').insert({
    content: `## 重要な回答ガイドライン

1. **簡潔性を重視**: 1つの回答は300〜1000文字以内に収めてください
2. **段階的な対話**: 長い説明や大規模な実装が必要な場合は、まず概要を説明し「詳細をお伝えしましょうか?」とユーザーに確認してください
3. **過剰な提案を避ける**: ユーザーが明示的に要求していない限り、以下のような詳細な提案は控えてください:
   - コード生成（コードレビュー時など、文脈上不適切な場合）
   - 開発ロードマップ
   - 予算試算
   - 関連機能の深掘り`,
    description: '全ドメインプロンプトで共有される回答ガイドライン',
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('common_guidelines');
}
