import ReactMarkdown from 'react-markdown';
import type { Message } from '../../types';

interface MessageListProps {
  messages: Message[];
  streamingContent?: string;
  onRetry?: () => void;
  isStreaming?: boolean;
}

export function MessageList({ messages, streamingContent, onRetry, isStreaming }: MessageListProps) {
// userとassistantのメッセージのみをフィルター
  const displayMessages = messages.filter((message) => message.role === 'user' || message.role === 'assistant');
  
  // 最後のアシスタントメッセージのインデックスを取得（フィルター後）
  const lastAssistantIndex = displayMessages.reduceRight((acc, msg, idx) => {
    if (acc === -1 && msg.role === 'assistant') {
      return idx;
    }
    return acc;
  }, -1);
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {displayMessages.map((message, index) => {
        const isLastAssistant = message.role === 'assistant' && index === lastAssistantIndex;

        return (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className="flex flex-col gap-2">
              <div
                className={`max-w-3xl rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                }`}
              >
                {message.role === 'assistant' && message.model && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {message.model}
                  </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </div>
              {isLastAssistant && onRetry && (
                <button
                  onClick={onRetry}
                  disabled={isStreaming}
                  className="self-start px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  🔄 Retry
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* 生成中スピナー（ストリーミング開始前） */}
      {isStreaming && !streamingContent && (
        <div className="flex justify-start">
          <div className="max-w-3xl rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              <span className="text-sm">生成中...</span>
            </div>
          </div>
        </div>
      )}

      {/* ストリーミング中のコンテンツ */}
      {streamingContent && (
        <div className="flex justify-start">
          <div className="max-w-3xl rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{streamingContent}</ReactMarkdown>
            </div>
            <div className="mt-2 flex items-center text-xs text-gray-500">
              <div className="animate-pulse">▋</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
