import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../types';

interface MessageListProps {
  messages: Message[];
  streamingContent?: string;
  onRetry?: () => void;
  isStreaming?: boolean;
}

export function MessageList({ messages, streamingContent, onRetry, isStreaming }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const lastScrollTop = useRef(0);

  // スクロール位置を監視して、ユーザーが最下部にいるかチェック
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const scrollDirection = scrollTop > lastScrollTop.current ? 'down' : 'up';
    lastScrollTop.current = scrollTop;

    // 最下部からの距離
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // ユーザーが上スクロールした場合は自動スクロールを無効化
    if (scrollDirection === 'up' && distanceFromBottom > 50) {
      setShouldAutoScroll(false);
    }
    // ユーザーが最下部（50px以内）に戻った場合のみ自動スクロールを再開
    else if (distanceFromBottom < 50) {
      setShouldAutoScroll(true);
    }
  };

  // メッセージが追加されたら、最下部にいる場合のみ自動スクロール
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent, shouldAutoScroll]);

  // userとassistantのメッセージのみをフィルター（空のメッセージも除外）
  const displayMessages = messages.filter(
    (message) => 
      (message.role === 'user' || message.role === 'assistant') && 
      message.content && 
      message.content.trim() !== ''
  );
  
  // 最後のアシスタントメッセージのインデックスを取得（フィルター後）
  const lastAssistantIndex = displayMessages.reduceRight((acc, msg, idx) => {
    if (acc === -1 && msg.role === 'assistant') {
      return idx;
    }
    return acc;
  }, -1);

  // 最後のユーザーメッセージのインデックスを取得
  const lastUserIndex = displayMessages.reduceRight((acc, msg, idx) => {
    if (acc === -1 && msg.role === 'user') {
      return idx;
    }
    return acc;
  }, -1);

  // 最後のメッセージがユーザーメッセージで、アシスタントメッセージがない場合
  const shouldShowRetryOnLastUser = lastUserIndex > lastAssistantIndex && lastUserIndex === displayMessages.length - 1;

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
    >
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
                
                {/* 思考過程の折りたたみ表示 */}
                {message.role === 'assistant' && message.thinking && (
                  <details className="mb-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-2">
                      <span>🧠</span>
                      <span>思考過程を表示</span>
                    </summary>
                    <div className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono border-t border-gray-200 dark:border-gray-700">
                      {message.thinking}
                    </div>
                  </details>
                )}
                
                <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
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
            <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
            </div>
            <div className="mt-2 flex items-center text-xs text-gray-500">
              <div className="animate-pulse">▋</div>
            </div>
          </div>
        </div>
      )}

      {/* 自動スクロール用の要素 */}
      <div ref={messagesEndRef} />
    </div>
  );
}
