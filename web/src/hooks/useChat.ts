import { useState, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { retryLastMessage, refreshAccessToken } from '../utils/api';
import type { Message } from '../types';

const API_BASE_URL = '/api';

// 認証ヘッダーを取得
function getAuthHeaders(): HeadersInit {
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.accessToken) {
    return {
      'Authorization': `Bearer ${tokens.accessToken}`,
    };
  }
  // フォールバック: 環境変数のAPIキー（後方互換性のため）
  if (import.meta.env.VITE_API_KEY) {
    return {
      'Authorization': `Bearer ${import.meta.env.VITE_API_KEY}`,
    };
  }
  return {};
}

// 認証付きfetchでストリーミングをサポート
async function authenticatedStreamingFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = {
    ...options.headers,
    ...getAuthHeaders(),
  };

  let response = await fetch(url, { ...options, headers });

  // 401エラーの場合、トークンをリフレッシュして再試行
  if (response.status === 401) {
    console.log('Access token expired, refreshing...');
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // リフレッシュ成功、新しいトークンで再試行
      const newHeaders = {
        ...options.headers,
        ...getAuthHeaders(),
      };
      response = await fetch(url, { ...options, headers: newHeaders });
      console.log('✅ Retried with new access token');
    } else {
      // リフレッシュ失敗、ログアウトする
      useAuthStore.getState().clearAuth();
    }
  }

  return response;
}

export function useChat() {
  const {
    currentSessionId,
    currentModel,
    currentDomainPromptId,
    projectPath,
    messages,
    addMessage,
    removeLastAssistantMessage,
    removeLastUserMessage,
    setCurrentSession,
    setIsStreaming,
    setError,
    setRetryPending,
    setCancelStreaming,
    setInputValue,
  } = useChatStore();

  const [streamingContent, setStreamingContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    // ユーザーメッセージを追加
    const userMessage: Message = {
      role: 'user',
      content,
    };
    addMessage(userMessage);
    setIsStreaming(true);
    setError(null);
    setStreamingContent('');

    // AbortControllerを作成
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // キャンセル関数をstoreに登録
    setCancelStreaming(() => {
      // 最後のユーザーメッセージを取得して削除
      const lastUserMessage = removeLastUserMessage();
      // 入力フィールドに戻す
      if (lastUserMessage) {
        setInputValue(lastUserMessage.content);
      }
      controller.abort();
      abortControllerRef.current = null;
    });

    try {
      const response = await authenticatedStreamingFetch(`${API_BASE_URL}/chat/messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: currentSessionId,
          content,
          modelName: currentModel,
          history: currentSessionId ? undefined : messages,
          domainPromptId: currentDomainPromptId,
          projectPath: projectPath,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;

            const data = line.slice(6);

            try {
              if (data === '[DONE]') break;

              const parsed = JSON.parse(data);

              if (parsed.content) {
                fullContent = parsed.content;
                setStreamingContent(fullContent);
              } else if (parsed.sessionId) {
                setCurrentSession(parsed.sessionId);
                fullContent = parsed.fullContent;
                console.log('✅ Done! Session:', parsed.sessionId, 'Full content length:', fullContent?.length);
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', e);
            }
          }
        }
      } catch (streamError) {
        // ストリーム読み取り中のAbortErrorはキャンセルとして扱う
        if (streamError instanceof Error && streamError.name === 'AbortError') {
          console.log('Stream cancelled by user');
          return;
        }
        throw streamError;
      }

      // アシスタントメッセージを追加
      console.log('💬 Adding assistant message, content length:', fullContent?.length);
      const assistantMessage: Message = {
        role: 'assistant',
        content: fullContent,
        model: currentModel,
      };
      addMessage(assistantMessage);
      setStreamingContent('');
    } catch (error) {
      console.error('Send message error:', error);
      // AbortErrorの場合は静かに終了（エラー表示しない）
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request cancelled by user');
        return;
      }
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsStreaming(false);
      setCancelStreaming(null);
      abortControllerRef.current = null;
    }
  };

  const retryMessage = async (retryModel?: string, retryPresetId?: number | null) => {
    // 最後のアシスタントメッセージを削除して保存
    const originalMessage = removeLastAssistantMessage();
    setIsStreaming(true);
    setError(null);
    setStreamingContent('');

    // AbortControllerを作成
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // キャンセル関数をstoreに登録
    setCancelStreaming(() => {
      controller.abort();
      abortControllerRef.current = null;
    });

    try {
      const modelToUse = retryModel || currentModel;
      const response = await retryLastMessage(
        currentSessionId,
        modelToUse,
        retryPresetId,
        currentSessionId ? undefined : messages,
        controller.signal
      );

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;

            const data = line.slice(6);

            try {
              if (data === '[DONE]') break;

              const parsed = JSON.parse(data);

              if (parsed.content) {
                fullContent = parsed.content;
                setStreamingContent(fullContent);
              } else if (parsed.sessionId) {
                setCurrentSession(parsed.sessionId);
                fullContent = parsed.fullContent;
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', e);
            }
          }
        }
      } catch (streamError) {
        // ストリーム読み取り中のAbortErrorはキャンセルとして扱う
        if (streamError instanceof Error && streamError.name === 'AbortError') {
          console.log('Retry stream cancelled by user');
          // 元のメッセージを復元
          if (originalMessage) {
            addMessage(originalMessage);
          }
          return;
        }
        throw streamError;
      }

      // アシスタントメッセージを追加
      const assistantMessage: Message = {
        role: 'assistant',
        content: fullContent,
        model: modelToUse,
      };
      addMessage(assistantMessage);
      setStreamingContent('');

      // Retry確認待ち状態にする（元のメッセージを保存）
      setRetryPending(true, originalMessage);
    } catch (error) {
      console.error('Retry message error:', error);
      // AbortErrorの場合は静かに終了（エラー表示しない）
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Retry cancelled by user');
        // 元のメッセージを復元
        if (originalMessage) {
          addMessage(originalMessage);
        }
        return;
      }
      setError(error instanceof Error ? error.message : 'Unknown error');
      // エラーの場合は元のメッセージを復元
      if (originalMessage) {
        addMessage(originalMessage);
      }
    } finally {
      setIsStreaming(false);
      setCancelStreaming(null);
      abortControllerRef.current = null;
    }
  };

  return {
    sendMessage,
    retryMessage,
    streamingContent,
    isStreaming: useChatStore((state) => state.isStreaming),
  };
}
