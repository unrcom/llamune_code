import type { Knex } from 'knex';
import { homedir } from 'os';
import { join } from 'path';

const DB_DIR = join(homedir(), '.llamune_code');
const DB_FILE = join(DB_DIR, 'history.db');

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: DB_FILE,
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations',
      extension: 'ts',
      tableName: 'knex_migrations',
    },
  },

  production: {
    client: 'better-sqlite3',
    connection: {
      filename: DB_FILE,
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations',
      extension: 'ts',
      tableName: 'knex_migrations',
    },
  },
};

export default config;
