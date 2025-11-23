import { useEffect, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { fetchModels, fetchRecommendedModels, pullModel, deleteModel } from '../../utils/api';
import type { RecommendedModel, SystemSpec } from '../../types';

export function ModelManager() {
  const { models, setModels, setMobileView } = useChatStore();
  const [recommendedModels, setRecommendedModels] = useState<RecommendedModel[]>([]);
  const [systemSpec, setSystemSpec] = useState<SystemSpec | null>(null);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set());
  const [deletingModels, setDeletingModels] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 推奨モデルとシステムスペックを取得
      const recommendedData = await fetchRecommendedModels();
      setRecommendedModels(recommendedData.recommended);
      setSystemSpec(recommendedData.spec);

      // インストール済みモデルを取得
      const { models: installedModels } = await fetchModels();
      setModels(installedModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
      console.error('Failed to load model data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleModel = (modelName: string) => {
    const newSelected = new Set(selectedModels);
    if (newSelected.has(modelName)) {
      newSelected.delete(modelName);
    } else {
      if (newSelected.size < 3) {
        newSelected.add(modelName);
      }
    }
    setSelectedModels(newSelected);
  };

  const handleDownloadSelected = async () => {
    if (selectedModels.size === 0) return;

    setError(null);
    const downloading = new Set(selectedModels);
    setDownloadingModels(downloading);

    try {
      // 並列ダウンロード
      await Promise.all(
        Array.from(selectedModels).map(async (modelName) => {
          try {
            await pullModel(modelName);
          } catch (err) {
            console.error(`Failed to download ${modelName}:`, err);
            throw err;
          }
        })
      );

      // ダウンロード成功後、モデル一覧を再取得
      const { models: installedModels } = await fetchModels();
      setModels(installedModels);
      setSelectedModels(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download models');
    } finally {
      setDownloadingModels(new Set());
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    if (!confirm(`モデル "${modelName}" を削除しますか？`)) return;

    setError(null);
    setDeletingModels(new Set([modelName]));

    try {
      await deleteModel(modelName);

      // 削除成功後、モデル一覧を再取得
      const { models: installedModels } = await fetchModels();
      setModels(installedModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete model');
    } finally {
      setDeletingModels(new Set());
    }
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4">
        <div className="flex items-center justify-between">
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
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              モデル管理
            </h1>
          </div>
          <button
            onClick={handleBackToList}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            title="閉じる"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* System Spec */}
            {systemSpec && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">システムスペック</h2>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div>メモリ: {systemSpec.totalMemoryGB} GB</div>
                  <div>CPU: {systemSpec.cpuCores} コア</div>
                </div>
                {systemSpec.gpu && systemSpec.gpu.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GPU:</div>
                    {systemSpec.gpu.map((gpu, index) => (
                      <div key={index} className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                        {index + 1}. {gpu.vendor} {gpu.model}
                        {gpu.vram && ` (VRAM: ${(gpu.vram / 1024).toFixed(1)} GB)`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recommended Models */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  推奨モデル（最大3個まで選択可能）
                </h2>
                {selectedModels.size > 0 && (
                  <button
                    onClick={handleDownloadSelected}
                    disabled={downloadingModels.size > 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {downloadingModels.size > 0 ? 'ダウンロード中...' : `選択したモデルをダウンロード (${selectedModels.size})`}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {recommendedModels.map((model) => {
                  const isInstalled = models.some((m) => m.name === model.name);
                  const isSelected = selectedModels.has(model.name);
                  const isDownloading = downloadingModels.has(model.name);

                  return (
                    <div
                      key={model.name}
                      className={`border rounded-lg p-4 transition-colors ${
                        isInstalled
                          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                          : isSelected
                          ? 'border-blue-500 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                              {model.name}
                            </h3>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {model.size}
                            </span>
                            {isInstalled && (
                              <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                                インストール済み
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {model.description}
                          </p>
                        </div>
                        {!isInstalled && (
                          <button
                            onClick={() => handleToggleModel(model.name)}
                            disabled={isDownloading || (!isSelected && selectedModels.size >= 3)}
                            className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {isDownloading ? '...' : isSelected ? '選択解除' : '選択'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Installed Models */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                インストール済みモデル
              </h2>

              {models.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  インストール済みのモデルがありません
                </div>
              ) : (
                <div className="space-y-3">
                  {models.map((model) => {
                    const isDeleting = deletingModels.has(model.name);

                    return (
                      <div
                        key={model.name}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                {model.name}
                              </h3>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatBytes(model.size)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              更新日: {new Date(model.modified_at).toLocaleString('ja-JP')}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteModel(model.name)}
                            disabled={isDeleting}
                            className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                          >
                            {isDeleting ? '削除中...' : '削除'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
