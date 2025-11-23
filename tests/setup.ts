import { readFileSync } from 'fs';
import { join } from 'path';

// Load API key from config file
function loadApiKey(): string {
  try {
    const configPath = join(process.cwd(), 'config/api-keys.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (config.keys && config.keys.length > 0) {
      return config.keys[0].key;
    }
  } catch (error) {
    console.error('Failed to load API key from config/api-keys.json:', error);
  }
  throw new Error('No API key found in config/api-keys.json');
}

export const TEST_API_BASE = 'http://localhost:3000';
export const TEST_API_KEY = loadApiKey();
