/**
 * Models API クライアントユーティリティ
 * CLI から API サーバーの models エンドポイントを呼び出す
 */

import { fetchWithAuth } from './auth-client.js';

const API_BASE_URL = process.env.LLAMUNE_API_URL || 'http://localhost:3000';

export interface ModelInfo {
  name: string;
  size: number;
  modified_at: string;
  digest: string;
  details?: {
    format: string;
    family: string;
    families: string[] | null;
    parameter_size: string;
    quantization_level: string;
  };
}

/**
 * モデル一覧を取得
 */
export async function listModelsApi(): Promise<ModelInfo[]> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/models`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to list models');
  }

  const data = await response.json();
  return data.models || [];
}

/**
 * モデルをダウンロード（プログレスコールバック付き）
 */
export async function pullModelApi(
  name: string,
  onProgress?: (progress: { status: string; completed?: number; total?: number }) => void
): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/models/pull`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modelName: name }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to pull model');
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (onProgress) {
          onProgress(data);
        }
      } catch {
        // JSON パースエラーは無視
      }
    }
  }
}

/**
 * モデルを削除
 */
export async function deleteModelApi(name: string): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/models`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modelName: name }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete model');
  }
}

/**
 * 推奨モデル一覧を取得
 */
export async function getRecommendedModelsApi(): Promise<any> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/models/recommended`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get recommended models');
  }

  return await response.json();
}

/**
 * システム情報を取得
 */
export async function getSystemSpecApi(): Promise<any> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/system/spec`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get system spec');
  }

  return await response.json();
}
