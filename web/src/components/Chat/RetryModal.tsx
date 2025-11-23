import type { Model, ParameterPreset } from '../../types';

interface RetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: Model[];
  presets: ParameterPreset[];
  currentModel: string;
  currentPresetId: number | null;
  onRetry: (modelName: string, presetId: number | null) => void;
}

export function RetryModal({
  isOpen,
  onClose,
  models,
  presets,
  currentModel,
  currentPresetId,
  onRetry,
}: RetryModalProps) {
  if (!isOpen) return null;

  // モデル×プリセットの組み合わせを生成
  const combinations: Array<{ model: Model; preset: ParameterPreset | null; index: number }> = [];
  let index = 1;

  models.forEach((model) => {
    // デフォルト（プリセットなし）
    combinations.push({ model, preset: null, index: index++ });

    // 最初のプリセットのみ
    if (presets.length > 0) {
      combinations.push({ model, preset: presets[0], index: index++ });
    }
  });

  const handleSelect = (modelName: string, presetId: number | null) => {
    onRetry(modelName, presetId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            モデルとプリセットの組み合わせ
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            {combinations.map(({ model, preset, index }) => {
              const isCurrent = model.name === currentModel &&
                               (preset?.id ?? null) === currentPresetId;

              return (
                <button
                  key={`${model.name}-${preset?.id ?? 'default'}`}
                  onClick={() => handleSelect(model.name, preset?.id ?? null)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400 text-sm w-8">
                      {isCurrent && '⭐'} {index}.
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {model.name}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      ({preset ? 'creative' : 'default'})
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
