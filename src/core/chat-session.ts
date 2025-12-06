/**
 * チャットセッション管理（共通ビジネスロジック）
 */

import type { ChatMessage, ChatParameters } from '../utils/ollama.js';
import {
  chatWithModel,
  listModels,
} from '../utils/ollama.js';
import {
  saveConversation,
  getSession,
  appendMessagesToSession,
  logicalDeleteMessagesAfterTurn,
  getParameterPresetById,
  getAllParameterPresets,
  updateSessionModel,
} from '../utils/database.js';
import { repositoryTools, type OllamaTool } from '../utils/repository-tools.js';
import { executeRepositoryTool } from '../utils/tool-executor.js';

/**
 * チャットセッションクラス
 */
export class ChatSession {
  private messages: ChatMessage[];
  private sessionId: number | null;
  private model: string;
  private parameters?: ChatParameters;
  private userId?: number;
  private systemPrompt?: string;
  private repositoryPath?: string;
  private workingBranch?: string;
  private lastSavedMessageCount: number;

  constructor(
    model: string,
    sessionId?: number | null,
    messages?: ChatMessage[],
    parameters?: ChatParameters,
    userId?: number,
    systemPrompt?: string,
    repositoryPath?: string,
    workingBranch?: string
  ) {
    this.model = model;
    this.sessionId = sessionId || null;
    this.messages = messages || [];
    this.parameters = parameters;
    this.userId = userId;

    // systemPromptが未指定の場合、デフォルトで日本語指示を含むプロンプトを設定
    let baseSystemPrompt = systemPrompt || '**必ず日本語で応答してください。**\n\nあなたは親切なAIアシスタントです。ユーザーの質問に丁寧に答えてください。';
    
    // リポジトリツールを使用する場合、安全性のための制約を追加
    if (repositoryPath) {
      baseSystemPrompt += '\n\n' +
        '## 重要: ファイル操作の制限\n' +
        '- read_file, list_files, search_code, get_file_tree, git_status, git_diff, get_recent_commits ツールは自由に使用できます\n' +
        '- **write_file, commit_changes, create_branch ツールは、ユーザーが明示的に指示した場合のみ使用してください**\n' +
        '- ファイルを読んだだけで勝手に書き込まないでください\n' +
        '- ファイルを書き込む前に、必ずユーザーに確認を求めてください';
    }
    
    this.systemPrompt = baseSystemPrompt;
    this.repositoryPath = repositoryPath;
    this.workingBranch = workingBranch;

    // system promptが指定されていて、messagesが空またはsystem roleがない場合、先頭に追加
    if (this.systemPrompt && (this.messages.length === 0 || this.messages[0].role !== 'system')) {
      this.messages.unshift({
        role: 'system',
        content: this.systemPrompt,
      });
    }

    // 初期化時点のメッセージ数を記録（既存セッション復元時は既に保存済み）
    this.lastSavedMessageCount = this.messages.length;
  }

  /**
   * メッセージを送信してストリーミングレスポンスを取得
   */
  async *sendMessage(content: string): AsyncGenerator<string, string, unknown> {
    // ユーザーメッセージを追加
    this.messages.push({
      role: 'user',
      content,
    });

    let fullResponse = '';
    const OLLAMA_BASE_URL = 'http://localhost:11434';

    // ツール呼び出しループ（LLMがツールを使わなくなるまで繰り返す）
    let continueLoop = true;
    let loopCount = 0;
    const MAX_TOOL_LOOPS = 5; // 最大5回のツール呼び出しループ

    while (continueLoop && loopCount < MAX_TOOL_LOOPS) {
      loopCount++;

      if (process.env.DEBUG_TOOL_CALLING === 'true') {
        console.log(`[DEBUG] === Tool calling loop iteration ${loopCount}/${MAX_TOOL_LOOPS} ===`);
        console.log('[DEBUG] Messages count:', this.messages.length);
      }

      const request: any = {
        model: this.model,
        messages: this.messages,
        stream: true,
        options: this.parameters,
      };

      // リポジトリが紐付いている場合はツールを含める
      if (this.repositoryPath) {
        request.tools = repositoryTools;
        if (process.env.DEBUG_TOOL_CALLING === 'true') {
          console.log('[DEBUG] Tools enabled, repository path:', this.repositoryPath);
        }
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
          throw new Error(`Chat API error: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('レスポンスボディがありません');
        }

        // ストリーミングレスポンスを処理
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';
        let toolCalls: any[] = [];
        let contentBuffer = ''; // 1チャンク分のバッファ

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              // デバッグログ：Ollamaからの生データを出力
              if (process.env.DEBUG_TOOL_CALLING === 'true') {
                console.log('[DEBUG] Ollama chunk:', JSON.stringify(data, null, 2));
              }

              // ツール呼び出し検出
              if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
                toolCalls = data.message.tool_calls;
                if (process.env.DEBUG_TOOL_CALLING === 'true') {
                  console.log('[DEBUG] Tool calls detected:', JSON.stringify(toolCalls, null, 2));
                  console.log('[DEBUG] Discarding buffer and accumulated content');
                  console.log('[DEBUG] - contentBuffer:', contentBuffer);
                  console.log('[DEBUG] - assistantMessage:', assistantMessage);
                }
                // ツール呼び出しが検出されたら、バッファと蓄積されたcontentを破棄
                contentBuffer = '';
                assistantMessage = '';
                fullResponse = '';
              }

              // 通常のコンテンツ処理（バッファリング方式）
              if (data.message?.content && toolCalls.length === 0) {
                // 前回のバッファがあれば、それを今yieldする
                if (contentBuffer) {
                  assistantMessage += contentBuffer;
                  fullResponse = assistantMessage;
                  if (process.env.DEBUG_TOOL_CALLING === 'true') {
                    console.log('[DEBUG] Yielding buffered content:', contentBuffer);
                  }
                  yield fullResponse;
                }
                // 現在のcontentを次回用のバッファに保存（まだyieldしない）
                contentBuffer = data.message.content;
                if (process.env.DEBUG_TOOL_CALLING === 'true') {
                  console.log('[DEBUG] Buffering content for next iteration:', contentBuffer);
                }
              } else if (data.message?.content && toolCalls.length > 0) {
                // ツール呼び出しがある場合のcontentは表示しない
                if (process.env.DEBUG_TOOL_CALLING === 'true') {
                  console.log('[DEBUG] Skipping content (tool call present):', data.message.content);
                }
              }

              // ストリーム完了チェック
              if (data.done) {
                // ツール呼び出しがある場合
                if (toolCalls.length > 0) {
                  // アシスタントのツール呼び出しメッセージを追加
                  this.messages.push({
                    role: 'assistant',
                    content: assistantMessage || '',
                    tool_calls: toolCalls,
                  });

                  // 各ツールを実行してtoolメッセージを追加
                  for (const toolCall of toolCalls) {
                    const functionName = toolCall.function.name;
                    const args = toolCall.function.arguments;

                    if (process.env.DEBUG_TOOL_CALLING === 'true') {
                      console.log('[DEBUG] Executing tool:', functionName, 'with args:', args);
                    }

                    // ツールを実行（通知は内部処理のため非表示）
                    const result = await executeRepositoryTool(
                      this.repositoryPath!,
                      functionName,
                      args,
                      this.workingBranch
                    );

                    if (process.env.DEBUG_TOOL_CALLING === 'true') {
                      console.log('[DEBUG] Tool result:', JSON.stringify(result, null, 2));
                    }

                    // toolメッセージとして結果を追加
                    this.messages.push({
                      role: 'tool',
                      content: JSON.stringify(result),
                    });
                  }

                  // ツール実行後、再度LLMに問い合わせ（ループ継続）
                  continueLoop = true;
                  assistantMessage = '';
                  toolCalls = [];
                  contentBuffer = ''; // バッファもクリア
                } else {
                  // ツール呼び出しがない場合は終了
                  continueLoop = false;

                  // 残っているバッファがあればyield
                  if (contentBuffer) {
                    assistantMessage += contentBuffer;
                    fullResponse = assistantMessage;
                    if (process.env.DEBUG_TOOL_CALLING === 'true') {
                      console.log('[DEBUG] Yielding final buffered content:', contentBuffer);
                    }
                    yield fullResponse;
                    contentBuffer = ''; // バッファをクリア
                  }

                  // アシスタントの応答を追加
                  if (assistantMessage) {
                    this.messages.push({
                      role: 'assistant',
                      content: assistantMessage,
                      model: this.model,
                    });
                  }
                }
                break;
              }
            } catch {
              // JSON パースエラーは無視
            }
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Chat エラー: ${error.message}`);
        }
        throw new Error('不明なエラーが発生しました');
      }

      // ツールループを継続する場合はここで次のイテレーションへ
      if (!continueLoop) {
        break;
      }
    }

    // 最大ループ回数に達した場合の警告
    if (loopCount >= MAX_TOOL_LOOPS) {
      const warning = `\n\n⚠️ 最大ツール呼び出し回数(${MAX_TOOL_LOOPS})に達しました。処理を終了します。`;
      fullResponse += warning;
      yield fullResponse;
    }

    return fullResponse;
  }

  /**
   * リトライ: 別のモデル・プリセットで再実行
   */
  async *retry(
    modelName: string,
    presetId?: number
  ): AsyncGenerator<string, string, unknown> {
    // 最後のメッセージがアシスタントでない場合はエラー
    if (
      this.messages.length === 0 ||
      this.messages[this.messages.length - 1].role !== 'assistant'
    ) {
      throw new Error('No assistant message to retry');
    }

    // 最後のアシスタントの応答を削除
    this.messages.pop();

    // プリセットからパラメータを取得
    let parameters: ChatParameters | undefined;
    if (presetId) {
      const preset = getParameterPresetById(presetId);
      if (preset) {
        parameters = {};
        if (preset.temperature !== null)
          parameters.temperature = preset.temperature;
        if (preset.top_p !== null) parameters.top_p = preset.top_p;
        if (preset.top_k !== null) parameters.top_k = preset.top_k;
        if (preset.repeat_penalty !== null)
          parameters.repeat_penalty = preset.repeat_penalty;
        if (preset.num_ctx !== null) parameters.num_ctx = preset.num_ctx;
      }
    }

    let fullResponse = '';

    // Ollama API を直接呼び出してストリーミング
    const OLLAMA_BASE_URL = 'http://localhost:11434';
    const request = {
      model: modelName,
      messages: this.messages,
      stream: true,
      options: parameters,
    };

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('レスポンスボディがありません');
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
            const data = JSON.parse(line);
            if (data.message?.content) {
              fullResponse += data.message.content;
              yield fullResponse; // 累積的な内容を yield
            }
          } catch {
            // JSON パースエラーは無視
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Chat エラー: ${error.message}`);
      }
      throw new Error('不明なエラーが発生しました');
    }

    // 新しい応答を追加
    this.messages.push({
      role: 'assistant',
      content: fullResponse,
      model: modelName,
    });

    // モデルとパラメータを更新
    this.model = modelName;
    this.parameters = parameters;

    // セッションがある場合はデータベースも更新
    if (this.sessionId) {
      updateSessionModel(this.sessionId, modelName);
    }

    return fullResponse;
  }

  /**
   * 会話を巻き戻す
   */
  rewind(turnNumber: number): void {
    if (!this.sessionId) {
      // 新規会話の場合はメモリ上で巻き戻し
      const keepCount = turnNumber * 2;
      this.messages = this.messages.slice(0, keepCount);
    } else {
      // セッションがある場合はDBも更新
      logicalDeleteMessagesAfterTurn(this.sessionId, turnNumber);
      const keepCount = turnNumber * 2;
      this.messages = this.messages.slice(0, keepCount);
    }
  }

  /**
   * モデルを切り替える
   */
  switchModel(modelName: string): void {
    this.model = modelName;

    // セッションがある場合はデータベースも更新
    if (this.sessionId) {
      updateSessionModel(this.sessionId, modelName);
    }
  }

  /**
   * セッションを保存
   * @param isRetry リトライ後の保存の場合は true
   */
  save(isRetry: boolean = false): number {
    if (this.messages.length === 0) {
      if (this.sessionId) {
        return this.sessionId;
      }
      throw new Error('No messages to save');
    }

    console.log('[DEBUG save()] sessionId:', this.sessionId);
    console.log('[DEBUG save()] lastSavedMessageCount:', this.lastSavedMessageCount);
    console.log('[DEBUG save()] current messages.length:', this.messages.length);

    if (this.sessionId) {
      // 前回保存以降の新しいメッセージを取得
      const newMessages = this.messages.slice(this.lastSavedMessageCount);
      
      console.log('[DEBUG save()] newMessages count:', newMessages.length);
      console.log('[DEBUG save()] newMessages roles:', newMessages.map(m => m.role));
      
      if (newMessages.length > 0) {
        appendMessagesToSession(this.sessionId, newMessages);
        // 保存位置を更新
        this.lastSavedMessageCount = this.messages.length;
      }

      return this.sessionId;
    } else {
      // 新規セッション作成（リポジトリ情報も保存）
      this.sessionId = saveConversation(
        this.model,
        this.messages,
        this.userId,
        this.repositoryPath,
        this.workingBranch
      );
      
      // 新規作成時も保存位置を更新
      this.lastSavedMessageCount = this.messages.length;

      return this.sessionId;
    }
  }

  /**
   * リポジトリを設定
   */
  setRepository(repositoryPath: string, workingBranch?: string): void {
    this.repositoryPath = repositoryPath;
    this.workingBranch = workingBranch;
  }

  /**
   * リポジトリ情報を取得
   */
  getRepository(): { repositoryPath?: string; workingBranch?: string } {
    return {
      repositoryPath: this.repositoryPath,
      workingBranch: this.workingBranch,
    };
  }

  /**
   * セッションIDを取得
   */
  getSessionId(): number | null {
    return this.sessionId;
  }

  /**
   * メッセージ履歴を取得
   */
  getMessages(): ChatMessage[] {
    return this.messages;
  }

  /**
   * 現在のモデルを取得
   */
  getModel(): string {
    return this.model;
  }

  /**
   * セッションIDからセッションを復元
   */
  static fromSessionId(sessionId: number, userId?: number): ChatSession | null {
    const sessionData = getSession(sessionId, userId);
    if (!sessionData) {
      return null;
    }

    return new ChatSession(
      sessionData.session.model,
      sessionId,
      sessionData.messages,
      undefined,
      sessionData.session.user_id,
      undefined,
      sessionData.session.repository_path || undefined,
      sessionData.session.current_branch || undefined
    );
  }
}
