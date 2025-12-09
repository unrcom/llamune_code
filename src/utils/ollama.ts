/**
 * Ollama API クライアント
 * Ollama のローカル API と通信するためのユーティリティ
 */

import { spawn } from 'child_process';

// Ollama APIのベースURL
const OLLAMA_BASE_URL = 'http://localhost:11434';

/**
 * Ollama モデルの型定義
 */
export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

/**
 * モデル一覧レスポンスの型定義
 */
export interface OllamaModelsResponse {
  models: OllamaModel[];
}

/**
 * Ollama API エラー
 */
export class OllamaError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'OllamaError';
  }
}

/**
 * インストール済みモデル一覧を取得
 */
export async function listModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);

    if (!response.ok) {
      throw new OllamaError(
        `Ollama API error: ${response.statusText}`,
        response.status
      );
    }

    const data = (await response.json()) as OllamaModelsResponse;
    return data.models || [];
  } catch (error) {
    if (error instanceof OllamaError) {
      throw error;
    }

    // ネットワークエラーなど
    if (error instanceof Error) {
      throw new OllamaError(
        `Ollama に接続できませんでした: ${error.message}`
      );
    }

    throw new OllamaError('不明なエラーが発生しました');
  }
}

/**
 * Ollama が起動しているか確認
 */
export async function checkOllamaStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Ollama をバックグラウンドで起動
 */
export function startOllama(): void {
  const ollamaProcess = spawn('ollama', ['serve'], {
    detached: true,
    stdio: 'ignore',
  });

  // プロセスを切り離してバックグラウンド実行
  ollamaProcess.unref();
}

/**
 * Ollama の起動を待機
 * @param maxWaitSeconds 最大待機時間（秒）
 * @param intervalMs チェック間隔（ミリ秒）
 */
export async function waitForOllama(
  maxWaitSeconds = 30,
  intervalMs = 500
): Promise<boolean> {
  const maxAttempts = (maxWaitSeconds * 1000) / intervalMs;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const isRunning = await checkOllamaStatus();
    if (isRunning) {
      return true;
    }

    // 次のチェックまで待機
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;
  }

  return false;
}

/**
 * Ollama を確認し、必要に応じて起動
 * @returns 起動成功または既に起動している場合は true
 */
export async function ensureOllamaRunning(): Promise<boolean> {
  // まず起動状態を確認
  const isRunning = await checkOllamaStatus();
  if (isRunning) {
    return true;
  }

  // 起動していない場合は起動を試みる
  console.log('🚀 Ollama を起動しています...');
  startOllama();

  // 起動を待機
  const started = await waitForOllama();
  if (started) {
    console.log('✅ Ollama が起動しました');
    console.log('');
    return true;
  }

  return false;
}

/**
 * バイト数を人間が読みやすい形式に変換
 */
export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * パラメータサイズを抽出（例: "9B" から "9.0B params"）
 */
export function formatParams(model: OllamaModel): string {
  const paramSize = model.details?.parameter_size;
  if (paramSize) {
    return `${paramSize} params`;
  }
  return 'Unknown size';
}

/**
 * モデルをプル（ダウンロード）する
 * @param modelName モデル名（例: "gemma2:9b"）
 * @returns プル成功時は true
 */
export function pullModel(modelName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    console.log(`📥 ${modelName} をダウンロードしています...`);
    console.log('');

    const pullProcess = spawn('ollama', ['pull', modelName], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    // 標準出力をリアルタイム表示
    pullProcess.stdout?.on('data', (data) => {
      process.stdout.write(data.toString());
    });

    // エラー出力をリアルタイム表示
    pullProcess.stderr?.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    pullProcess.on('close', (code) => {
      console.log('');
      if (code === 0) {
        console.log(`✅ ${modelName} のダウンロードが完了しました`);
        resolve(true);
      } else {
        console.error(`❌ ${modelName} のダウンロードに失敗しました`);
        reject(new OllamaError(`プル失敗: 終了コード ${code}`));
      }
    });

    pullProcess.on('error', (error) => {
      console.error('❌ ollama コマンドの実行に失敗しました');
      reject(new OllamaError(`プル失敗: ${error.message}`));
    });
  });
}

/**
 * モデルを削除する
 * @param modelName モデル名（例: "gemma2:9b"）
 * @returns 削除成功時は true
 */
export async function deleteModel(modelName: string): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OllamaError(
        `モデル削除エラー: ${errorText || response.statusText}`,
        response.status
      );
    }

    return true;
  } catch (error) {
    if (error instanceof OllamaError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new OllamaError(`モデル削除エラー: ${error.message}`);
    }

    throw new OllamaError('不明なエラーが発生しました');
  }
}

/**
 * Chat メッセージの型定義
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  model?: string; // どのモデルが生成したメッセージか（assistantの場合）
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: Record<string, any>;
    };
  }>;
}

/**
 * Chat パラメータの型定義
 */
export interface ChatParameters {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repeat_penalty?: number;
  num_ctx?: number;
  seed?: number;
}

/**
 * Chat リクエストの型定義
 */
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  options?: ChatParameters;
}

/**
 * Chat レスポンスの型定義（ストリーミング）
 */
export interface ChatResponse {
  model: string;
  created_at: string;
  message: ChatMessage;
  done: boolean;
}

/**
 * モデルとチャット（ストリーミング）
 * @param modelName モデル名
 * @param messages 会話履歴
 * @param onChunk ストリーミングチャンクを受信したときのコールバック
 * @param parameters オプションのチャットパラメータ
 */
export async function chatWithModel(
  modelName: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  parameters?: ChatParameters
): Promise<void> {
  const request: ChatRequest = {
    model: modelName,
    messages,
    stream: true,
  };

  // パラメータが指定されている場合は追加
  if (parameters) {
    request.options = parameters;
  }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new OllamaError(
        `Chat API error: ${response.statusText}`,
        response.status
      );
    }

    if (!response.body) {
      throw new OllamaError('レスポンスボディがありません');
    }

    // ストリーミングレスポンスを処理
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line) as ChatResponse;
          if (data.message?.content) {
            onChunk(data.message.content);
          }
        } catch {
          // JSON パースエラーは無視
        }
      }
    }
  } catch (error) {
    if (error instanceof OllamaError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new OllamaError(`Chat エラー: ${error.message}`);
    }

    throw new OllamaError('不明なエラーが発生しました');
  }
}

/**
 * モデル名から推奨 num_ctx を取得
 */
export function getRecommendedNumCtx(modelName: string): number {
  // デフォルト値
  const DEFAULT_NUM_CTX = 8192;
  
  // モデル名の正規化（タグを除去）
  const baseName = modelName.split(':')[0];
  
  // 特定モデルの推奨値マッピング（実測値のみ）
  const contextMap: Record<string, number> = {
    'gpt-oss': 131072,        // 確認済み: 131072
    'gemma2': 8192,           // 確認済み: 8192
    'qwen2.5': 32768,         // 確認済み: 32768
  };
  
  // マッピングに存在すればその値、なければデフォルト
  return contextMap[baseName] ?? DEFAULT_NUM_CTX;
}
