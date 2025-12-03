import { useState, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useChat } from '../../hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { RetryModal } from './RetryModal';
import { RetryConfirmation } from './RetryConfirmation';
import { UserMenu } from '../Auth/UserMenu';
import { RepositorySelector } from '../Repository/RepositorySelector';

export function ChatWindow() {
  const { messages, currentModel, currentPresetId, currentDomainPromptId, models, presets, error, isRetryPending, setCurrentModel, acceptRetry, rejectRetry, setMobileView } = useChatStore();
  const { sendMessage, retryMessage, streamingContent, isStreaming } = useChat();
  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleBackToList = () => {
    setMobileView('list');
  };

  const handleRetry = (modelName: string, presetId: number | null) => {
    retryMessage(modelName, presetId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {isMobile && (
              <button
                onClick={handleBackToList}
                className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                title="戻る"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {models.length > 0 && (
              <select
                value={currentModel}
                onChange={(e) => setCurrentModel(e.target.value)}
                disabled={isStreaming || messages.length > 0}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title={messages.length > 0 ? "モデルを変更するには New Chat で新しい会話を開始してください" : ""}
              >
                {models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}
            <RepositorySelector />
          </div>
          <UserMenu />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-4 px-4 py-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        onRetry={!isRetryPending ? () => setIsRetryModalOpen(true) : undefined}
        isStreaming={isStreaming}
      />

      {/* Retry Confirmation */}
      {isRetryPending && (
        <RetryConfirmation
          onAccept={acceptRetry}
          onReject={rejectRetry}
        />
      )}

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={isStreaming || isRetryPending} />

      {/* Retry Modal */}
      <RetryModal
        isOpen={isRetryModalOpen}
        onClose={() => setIsRetryModalOpen(false)}
        models={models}
        presets={presets}
        currentModel={currentModel}
        currentPresetId={currentPresetId}
        onRetry={handleRetry}
      />
    </div>
  );
}
