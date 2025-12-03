#!/usr/bin/env tsx

import { initDatabase } from '../src/utils/database.js';

const db = initDatabase();

try {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as Array<{ name: string }>;

  console.log('📊 現在のデータベーステーブル一覧:\n');

  tables.forEach((table) => {
    console.log(`📋 ${table.name}`);

    const columns = db.pragma(`table_info(${table.name})`) as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
    }>;

    columns.forEach((col) => {
      const constraints = [];
      if (col.pk) constraints.push('PRIMARY KEY');
      if (col.notnull) constraints.push('NOT NULL');
      if (col.dflt_value !== null) constraints.push(`DEFAULT ${col.dflt_value}`);

      const constraintStr = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
      console.log(`   - ${col.name}: ${col.type}${constraintStr}`);
    });

    console.log('');
  });

  console.log(`✅ 合計 ${tables.length} テーブル\n`);
} catch (error) {
  console.error('❌ エラー:', error);
  process.exit(1);
} finally {
  db.close();
}
