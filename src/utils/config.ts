/**
 * 設定ファイル管理ユーティリティ
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';

/**
 * 設定ファイルの型定義
 */
export interface LlamuneConfig {
  defaultModel?: string;
  lastUsedModel?: string;
}

// 設定ファイルのパス
const CONFIG_DIR = join(homedir(), '.llamune_code');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * 設定ファイルを読み込む
 */
export function loadConfig(): LlamuneConfig {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return {};
    }

    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as LlamuneConfig;
  } catch {
    return {};
  }
}

/**
 * 設定ファイルに保存
 */
export function saveConfig(config: LlamuneConfig): void {
  try {
    // ディレクトリがなければ作成
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('設定ファイルの保存に失敗しました:', error);
  }
}

/**
 * 最後に使用したモデルを保存
 */
export function saveLastUsedModel(modelName: string): void {
  const config = loadConfig();
  config.lastUsedModel = modelName;
  saveConfig(config);
}

/**
 * 最後に使用したモデルを取得
 */
export function getLastUsedModel(): string | undefined {
  const config = loadConfig();
  return config.lastUsedModel;
}
