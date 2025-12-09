import { Router, Request, Response } from 'express';
import { ChatSession } from '../../core/chat-session.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Ollama サーバーのプロセスIDを取得
 */
async function getOllamaProcessId(): Promise<number | null> {
  try {
    const { stdout } = await execAsync("ps aux | grep 'ollama serve' | grep -v grep | awk '{print $2}'");
    const pid = parseInt(stdout.trim());
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

const router = Router();

/**
 * GET /api/health/memory-test - メモリ（履歴）テスト
 */
router.get('/memory-test', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const model = (req.query.model as string) || 'gpt-oss:20b';
  const testName = 'HealthTestUser';
  
  try {
    // テストセッション作成
    const session = new ChatSession(model, null, [], undefined, undefined, undefined);
    
    // メッセージ1: 名前を伝える
    let response1 = '';
    for await (const chunk of session.sendMessage(`私の名前は${testName}です`)) {
      response1 = chunk;
    }
    
    // メッセージ2: 名前を覚えているか確認
    let response2 = '';
    for await (const chunk of session.sendMessage('私の名前を覚えていますか？')) {
      response2 = chunk;
    }
    
    // 判定
    const passed = response2.includes(testName);
    const duration = Date.now() - startTime;
    
    const result = {
      status: passed ? 'ok' : 'error',
      model: model,
      timestamp: new Date().toISOString(),
      ollama_pid: await getOllamaProcessId(),
      test_result: {
        passed: passed,
        response_contains_name: passed,
        llm_response: response2,
        duration_ms: duration
      }
    };
    
    // ログに記録
    console.log(`[HEALTH CHECK] ${JSON.stringify(result)}`);
    
    res.json(result);
  } catch (error) {
    const result = {
      status: 'error',
      model: model,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    console.error(`[HEALTH CHECK] ${JSON.stringify(result)}`);
    res.status(500).json(result);
  }
});

export default router;
