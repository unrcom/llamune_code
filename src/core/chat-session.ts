/**
 * チャットセッション管理（共通ビジネスロジック）
 */

import type { ChatMessage, ChatParameters } from '../utils/ollama.js';
import { getRecommendedNumCtx } from '../utils/ollama.js';
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
  getDefaultPrompt,
} from '../utils/database.js';
import {
  projectTools,
  generateFileTree,
  executeToolCall,
} from '../utils/project-tools.js';

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
  private lastSavedMessageCount: number;
  private projectPath?: string;

  constructor(
    model: string,
    sessionId?: number | null,
    messages?: ChatMessage[],
    parameters?: ChatParameters,
    userId?: number,
    systemPrompt?: string,
    projectPath?: string
  ) {
    this.model = model;
    this.sessionId = sessionId || null;
    this.messages = messages || [];
    this.parameters = parameters;
    this.userId = userId;
    this.projectPath = projectPath;

    // systemPromptが未指定の場合、DBからデフォルトプロンプトを取得
    if (!systemPrompt) {
      try {
        const defaultPrompt = getDefaultPrompt();
        this.systemPrompt = defaultPrompt?.system_prompt || 
          '**必ず日本語で応答してください。**\n\nあなたは親切なAIアシスタントです。ユーザーの質問に丁寧に答えてください。';
      } catch (error) {
        // DBエラー時はハードコードされたデフォルトを使用
        console.warn('Failed to get default prompt from DB, using fallback:', error);
        this.systemPrompt = '**必ず日本語で応答してください。**\n\nあなたは親切なAIアシスタントです。ユーザーの質問に丁寧に答えてください。';
      }
    } else {
      this.systemPrompt = systemPrompt;
    }

    // プロジェクトパスが指定されている場合、ファイルツリーをシステムプロンプトに追加
    if (this.projectPath) {
      const fileTree = generateFileTree(this.projectPath);
      this.systemPrompt += `\n\n## プロジェクト構造\n\nあなたは以下のプロジェクトディレクトリにアクセスできます：\n\`\`\`\n${fileTree}\n\`\`\`\n\nファイルを読み取る場合は read_file ツールを、ディレクトリ一覧を取得する場合は list_files ツールを使用してください。`;
    }

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
    // ツール呼び出し後の再実行でない場合のみユーザーメッセージを追加
    if (content && content.trim() !== '') {
      this.messages.push({
        role: 'user',
        content,
      });
    }

    let fullResponse = '';
    const OLLAMA_BASE_URL = 'http://localhost:11434';

    const request: any = {
      model: this.model,
      messages: this.messages,
      stream: true,
      options: {
        ...this.parameters,
        num_ctx: this.parameters?.num_ctx ?? getRecommendedNumCtx(this.model),
      },
    };

    // プロジェクトパスが指定されている場合、ツールを有効化
    if (this.projectPath) {
      request.tools = projectTools;
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

            // ツール呼び出しをチェック
            if (data.message?.tool_calls) {
              toolCalls = data.message.tool_calls;
            }

            // コンテンツ処理
            if (data.message?.content) {
              assistantMessage += data.message.content;
              fullResponse = assistantMessage;
              yield fullResponse;
            }

            // ストリーム完了チェック
            if (data.done) {
              // ツール呼び出しがある場合、実行して再度LLMを呼び出す
              if (toolCalls.length > 0 && this.projectPath) {
                // アシスタントメッセージ（ツール呼び出し含む）を追加
                this.messages.push({
                  role: 'assistant',
                  content: assistantMessage,
                  tool_calls: toolCalls,
                } as any);

                // ツールを実行
                for (const toolCall of toolCalls) {
                  const toolName = toolCall.function.name;
                  const toolArgs = toolCall.function.arguments;
                  const toolResult = executeToolCall(this.projectPath, toolName, toolArgs);

                  // ツール結果をメッセージに追加
                  this.messages.push({
                    role: 'tool',
                    content: toolResult,
                  } as any);
                }

                // ツール結果を含めて再度LLMを呼び出し（ストリーミング）
                yield* this.sendMessage('');
                return fullResponse;
              } else {
                // 通常のアシスタントメッセージを追加
                this.messages.push({
                  role: 'assistant',
                  content: assistantMessage,
                });
              }
            }
          } catch (error) {
            console.error('JSONパースエラー:', error);
          }
        }
      }
    } catch (error) {
      console.error('チャットエラー:', error);
      throw error;
    }

    return fullResponse;
  }

  /**
   * 最後のアシスタントメッセージを削除して再試行
   */
  async *retry(
    modelName?: string,
    presetId?: number | null
  ): AsyncGenerator<string, string, unknown> {
    // 最後のアシスタントメッセージを削除
    const lastAssistantIndex = this.messages.map((m, i) => (m.role === 'assistant' ? i : -1))
      .filter((i) => i !== -1)
      .pop();

    if (lastAssistantIndex === undefined || lastAssistantIndex === -1) {
      throw new Error('再試行するアシスタントメッセージがありません');
    }

    // メッセージを削除
    this.messages.splice(lastAssistantIndex, 1);

    // モデルを切り替える場合
    if (modelName && modelName !== this.model) {
      this.switchModel(modelName);
    }

    // プリセットを適用する場合
    if (presetId !== undefined && presetId !== null) {
      const preset = getParameterPresetById(presetId);
      if (preset) {
        this.parameters = {
          temperature: preset.temperature ?? undefined,
          top_p: preset.top_p ?? undefined,
          top_k: preset.top_k ?? undefined,
          repeat_penalty: preset.repeat_penalty ?? undefined,
          num_ctx: preset.num_ctx ?? undefined,
        };
      }
    }

    // 最後のユーザーメッセージを再送信
    const lastUserMessage = [...this.messages]
      .reverse()
      .find((m) => m.role === 'user');

    if (!lastUserMessage) {
      throw new Error('再試行するユーザーメッセージがありません');
    }

    // ユーザーメッセージを削除してから再送信
    const lastUserIndex = this.messages.map((m, i) => (m.role === 'user' ? i : -1))
      .filter((i) => i !== -1)
      .pop();

    if (lastUserIndex !== undefined && lastUserIndex !== -1) {
      this.messages.splice(lastUserIndex, 1);
    }

    // 再送信
    yield* this.sendMessage(lastUserMessage.content);

    return '';
  }

  /**
   * 指定したターン以降のメッセージを削除（巻き戻し）
   */
  rewind(turnNumber: number): void {
    const targetIndex = turnNumber * 2; // user + assistant のペア
    this.messages = this.messages.slice(0, targetIndex + 1);

    // DBにも反映
    if (this.sessionId) {
      logicalDeleteMessagesAfterTurn(this.sessionId, turnNumber);
    }
  }

  /**
   * モデルを切り替え
   */
  switchModel(modelName: string): void {
    this.model = modelName;

    // DBに保存されているセッションの場合、モデル情報を更新
    if (this.sessionId) {
      updateSessionModel(this.sessionId, modelName);
    }
  }

  /**
   * セッションを保存（新規またはメッセージ追記）
   */
  save(isRetry: boolean = false): number {
    const newMessages = this.messages.slice(this.lastSavedMessageCount);

    if (this.sessionId) {
      // 既存セッションにメッセージを追記
      if (newMessages.length > 0) {
        appendMessagesToSession(this.sessionId, newMessages);
        this.lastSavedMessageCount = this.messages.length;
      }
    } else {
      // 新規セッション作成
      this.sessionId = saveConversation(
        this.model,
        this.messages,
        this.userId,
        this.projectPath,
      );
      this.lastSavedMessageCount = this.messages.length;
    }

    return this.sessionId;
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
   * セッションIDから ChatSession を復元
   */
  static fromSessionId(sessionId: number, userId?: number): ChatSession | null {
    const sessionData = getSession(sessionId, userId);
    if (!sessionData) return null;

    return new ChatSession(
      sessionData.session.model,
      sessionData.session.id,
      sessionData.messages,
      undefined,
      userId,
      undefined,
      sessionData.session.project_path || undefined
    );
  }

  /**
   * 利用可能なモデル一覧を取得
   */
  static async getAvailableModels() {
    return await listModels();
  }

  /**
   * 利用可能なプリセット一覧を取得
   */
  static getAvailablePresets() {
    return getAllParameterPresets();
  }
}
