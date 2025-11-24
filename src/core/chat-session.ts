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
  setSessionRepository,
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
  private repositoryId?: number;
  private workingBranch?: string;

  constructor(
    model: string,
    sessionId?: number | null,
    messages?: ChatMessage[],
    parameters?: ChatParameters,
    userId?: number,
    systemPrompt?: string,
    repositoryId?: number,
    workingBranch?: string
  ) {
    this.model = model;
    this.sessionId = sessionId || null;
    this.messages = messages || [];
    this.parameters = parameters;
    this.userId = userId;
    this.systemPrompt = systemPrompt;
    this.repositoryId = repositoryId;
    this.workingBranch = workingBranch;

    // system promptが指定されていて、messagesが空またはsystem roleがない場合、先頭に追加
    if (systemPrompt && (this.messages.length === 0 || this.messages[0].role !== 'system')) {
      this.messages.unshift({
        role: 'system',
        content: systemPrompt,
      });
    }
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
      const request: any = {
        model: this.model,
        messages: this.messages,
        stream: true,
        options: this.parameters,
      };

      // リポジトリが紐付いている場合はツールを含める
      if (this.repositoryId) {
        request.tools = repositoryTools;
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              // 通常のコンテンツ
              if (data.message?.content) {
                assistantMessage += data.message.content;
                fullResponse = assistantMessage;
                yield fullResponse;
              }

              // ツール呼び出し
              if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
                toolCalls = data.message.tool_calls;
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

                    // ユーザーにツール実行を通知
                    const toolNotification = `\n[🔧 Executing: ${functionName}(${JSON.stringify(args).substring(0, 50)}...)]\n`;
                    fullResponse += toolNotification;
                    yield fullResponse;

                    // ツールを実行
                    const result = await executeRepositoryTool(
                      this.repositoryId!,
                      functionName,
                      args
                    );

                    // toolメッセージとして結果を追加
                    this.messages.push({
                      role: 'tool',
                      content: JSON.stringify(result),
                    });

                    // 実行結果を通知
                    const resultNotification = `[✓ ${functionName}: ${result.success ? 'Success' : 'Failed'}]\n`;
                    fullResponse += resultNotification;
                    yield fullResponse;
                  }

                  // ツール実行後、再度LLMに問い合わせ（ループ継続）
                  continueLoop = true;
                  assistantMessage = '';
                  toolCalls = [];
                } else {
                  // ツール呼び出しがない場合は終了
                  continueLoop = false;

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

    if (this.sessionId) {
      // retryの場合は最後のassistantメッセージのみ、通常は最後の2つ（user + assistant）
      const newMessages = isRetry
        ? this.messages.slice(-1)  // assistantのみ
        : this.messages.slice(-2); // user + assistant
      appendMessagesToSession(this.sessionId, newMessages);

      // リポジトリ情報を保存
      if (this.repositoryId) {
        setSessionRepository(this.sessionId, this.repositoryId, this.workingBranch);
      }

      return this.sessionId;
    } else {
      // 新規セッション作成
      this.sessionId = saveConversation(this.model, this.messages, this.userId);

      // リポジトリ情報を保存
      if (this.repositoryId) {
        setSessionRepository(this.sessionId, this.repositoryId, this.workingBranch);
      }

      return this.sessionId;
    }
  }

  /**
   * リポジトリを設定
   */
  setRepository(repositoryId: number, workingBranch?: string): void {
    this.repositoryId = repositoryId;
    this.workingBranch = workingBranch;

    // 既存セッションの場合はDBも更新
    if (this.sessionId) {
      setSessionRepository(this.sessionId, repositoryId, workingBranch);
    }
  }

  /**
   * リポジトリ情報を取得
   */
  getRepository(): { repositoryId?: number; workingBranch?: string } {
    return {
      repositoryId: this.repositoryId,
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
      sessionData.session.repository_id || undefined,
      sessionData.session.working_branch || undefined
    );
  }
}
