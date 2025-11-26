#!/usr/bin/env tsx
import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const DB_FILE = join(homedir(), '.llamune_code', 'history.db');
const db = new Database(DB_FILE);

console.log('📋 sessions テーブルの構造:');
console.log('');

const tableInfo = db.pragma('table_info(sessions)') as Array<{
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}>;

tableInfo.forEach((col) => {
  console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
});

console.log('');
console.log('📋 CREATE TABLE 文:');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='sessions'").get() as { sql: string };
console.log(schema.sql);

db.close();
