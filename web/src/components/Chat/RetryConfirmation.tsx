interface RetryConfirmationProps {
  onAccept: () => void;
  onReject: () => void;
}

export function RetryConfirmation({ onAccept, onReject }: RetryConfirmationProps) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">💡</span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            この回答を採用しますか？
          </span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            破棄 (元の回答を採用)
          </button>
          <button
            onClick={onAccept}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            採用
          </button>
        </div>
      </div>
    </div>
  );
}
