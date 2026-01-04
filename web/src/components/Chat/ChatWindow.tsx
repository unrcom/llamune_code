import { useState, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useChat } from '../../hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { RetryModal } from './RetryModal';
import { RetryConfirmation } from './RetryConfirmation';
import { UserMenu } from '../Auth/UserMenu';

export function ChatWindow() {
  const {
    messages,
    currentModel,
    currentPresetId,
    currentSessionId,
    models,
    presets,
    error,
    isRetryPending,
    systemPrompt,
    setCurrentModel,
    acceptRetry,
    rejectRetry,
    setMobileView
  } = useChatStore();

  const { sendMessage, retryMessage, streamingContent, isStreaming } = useChat();
  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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

  const handleExport = async () => {
    if (!currentSessionId) return;
    
    setIsExporting(true);
    try {
      const response = await fetch(`/api/chat/sessions/${currentSessionId}/export`, {
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().tokens?.accessToken || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export session');
      }

      // レスポンスからファイル名を取得
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `llamune_chat_${currentSessionId}.json`;
      if (contentDisposition) {
        const matches = /filename="([^"]+)"/.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      // JSONをダウンロード
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポートに失敗しました');
    } finally {
      setIsExporting(false);
    }
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

            {/* モデル選択 */}
            <div className="flex items-center gap-2">
              {models.length > 0 ? (
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
              ) : (
                <div className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                  ⚠️ インストール済みのLLMがありません
                </div>
              )}
            </div>
          </div>
          
          {/* 右側のボタン群 */}
          <div className="flex items-center gap-2">
            {/* エクスポートボタン */}
            {currentSessionId && (
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                title="チャット履歴をJSONファイルとしてエクスポート"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {isExporting ? 'エクスポート中...' : 'エクスポート'}
              </button>
            )}
            
            <UserMenu />
          </div>
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
        systemPrompt={systemPrompt || undefined}
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
