import { useEffect, useState } from 'react';
import { fetchDomainModes, fetchDomainPrompts } from '../../utils/api';
import { useChatStore } from '../../store/chatStore';
import type { DomainMode, DomainPrompt } from '../../types';

interface DomainSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (domainPromptId: number | null, repositoryPath?: string | null) => void;
}

type Step = 'mode' | 'repository' | 'domain' | 'prompt';

export function DomainSelector({ isOpen, onClose, onSelect }: DomainSelectorProps) {
  const repositories = useChatStore((state) => state.repositories);
  const [step, setStep] = useState<Step>('mode');
  const [selectedMode, setSelectedMode] = useState<'reasoning' | 'domain' | null>(null);
  const [selectedRepositoryPath, setSelectedRepositoryPath] = useState<string | null>(null);
  const [domains, setDomains] = useState<DomainMode[]>([]);
  const [prompts, setPrompts] = useState<DomainPrompt[]>([]);
  const [loading, setLoading] = useState(false);

  // モーダルを開いたときに初期化
  useEffect(() => {
    if (isOpen) {
      setStep('mode');
      setSelectedMode(null);
      setSelectedRepositoryPath(null);
      setPrompts([]);
    }
  }, [isOpen]);

  // ドメイン一覧を取得
  const loadDomains = async () => {
    try {
      setLoading(true);
      const response = await fetchDomainModes();
      setDomains(response.domains.filter(d => d.enabled === 1));
    } catch (error) {
      console.error('Failed to load domains:', error);
    } finally {
      setLoading(false);
    }
  };

  // プロンプト一覧を取得
  const loadPrompts = async (domainId: number) => {
    try {
      setLoading(true);
      const response = await fetchDomainPrompts(domainId);
      setPrompts(response.prompts);
    } catch (error) {
      console.error('Failed to load prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  // 推論モードを選択
  const handleReasoningMode = () => {
    setSelectedMode('reasoning');
    setStep('repository');
  };

  // ドメイン特化モードを選択
  const handleDomainMode = () => {
    setSelectedMode('domain');
    setStep('repository');
  };

  // リポジトリを選択
  const handleSelectRepository = (repoPath: string | null) => {
    setSelectedRepositoryPath(repoPath);
    if (selectedMode === 'reasoning') {
      // 推論モードの場合、そのまま完了
      onSelect(null, repoPath);
      onClose();
    } else {
      // ドメイン特化モードの場合、ドメイン選択へ
      setStep('domain');
      loadDomains();
    }
  };

  // ドメインを選択
  const handleSelectDomain = async (domain: DomainMode) => {
    setStep('prompt');
    await loadPrompts(domain.id);
  };

  // プロンプトを選択
  const handleSelectPrompt = (prompt: DomainPrompt) => {
    onSelect(prompt.id, selectedRepositoryPath);
    onClose();
  };

  // 「あなたの本職を支援するモード」を選択（アプリケーション開発のデフォルトプロンプトを自動選択）
  const handleProfessionalMode = async () => {
    try {
      setLoading(true);

      // アプリケーション開発ドメインを探す
      const response = await fetchDomainModes();
      const appDevDomain = response.domains.find(d => d.name === 'app-development');

      if (appDevDomain) {
        // アプリケーション開発のプロンプトを取得
        const promptsResponse = await fetchDomainPrompts(appDevDomain.id);
        // デフォルトプロンプト（コード生成）を探す
        const defaultPrompt = promptsResponse.prompts.find(p => p.is_default === 1);

        if (defaultPrompt) {
          onSelect(defaultPrompt.id, selectedRepositoryPath);
          onClose();
        }
      }
    } catch (error) {
      console.error('Failed to select professional mode:', error);
    } finally {
      setLoading(false);
    }
  };

  // 戻る
  const handleBack = () => {
    if (step === 'prompt') {
      setStep('domain');
      setPrompts([]);
    } else if (step === 'domain') {
      setStep('repository');
      setDomains([]);
    } else if (step === 'repository') {
      setStep('mode');
      setSelectedRepositoryPath(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {step !== 'mode' && (
              <button
                onClick={handleBack}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← 戻る
              </button>
            )}
            <h2 className="text-xl font-bold text-white">
              {step === 'mode' && '新しいチャット'}
              {step === 'repository' && 'リポジトリを選択'}
              {step === 'domain' && 'ドメインを選択'}
              {step === 'prompt' && 'プロンプトを選択'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* コンテンツ */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center text-gray-400 py-8">読み込み中...</div>
          ) : (
            <>
              {/* Step 1: モード選択 */}
              {step === 'mode' && (
                <>
                  <button
                    onClick={handleReasoningMode}
                    className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🤔</span>
                      <div>
                        <div className="font-semibold text-white">推論モード</div>
                        <div className="text-sm text-gray-400">一般的な対話と推論</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={handleDomainMode}
                    className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎯</span>
                      <div>
                        <div className="font-semibold text-white">ドメイン特化モード</div>
                        <div className="text-sm text-gray-400">特定のドメインに最適化</div>
                      </div>
                    </div>
                  </button>
                </>
              )}

              {/* Step 2: リポジトリ選択 */}
              {step === 'repository' && (
                <>
                  <button
                    onClick={() => handleSelectRepository(null)}
                    className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⏭️</span>
                      <div>
                        <div className="font-semibold text-white">リポジトリなし</div>
                        <div className="text-sm text-gray-400">リポジトリを使用せずに続行</div>
                      </div>
                    </div>
                  </button>
                  {repositories.length === 0 ? (
                    <div className="text-center text-gray-400 py-4 text-sm">
                      利用可能なリポジトリがありません
                    </div>
                  ) : (
                    <>
                      {repositories.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => handleSelectRepository(repo.local_path)}
                          className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">📁</span>
                            <div>
                              <div className="font-semibold text-white">{repo.name}</div>
                              <div className="text-xs text-gray-500 mt-1 truncate">{repo.local_path}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}

              {/* Step 3: ドメイン選択 */}
              {step === 'domain' && (
                <>
                  {domains.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      利用可能なドメインがありません
                    </div>
                  ) : (
                    <>
                      {/* あなたの本職を支援するモード（クリック可能） */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProfessionalMode();
                        }}
                        className="w-full text-left p-4 bg-gradient-to-r from-blue-900/40 to-purple-900/40 hover:from-blue-900/60 hover:to-purple-900/60 rounded-lg border border-blue-700/50 hover:border-blue-600 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">💼</span>
                          <div>
                            <div className="font-semibold text-white">あなたの本職を支援するモード</div>
                            <div className="text-sm text-gray-300 mt-1">
                              コード生成の支援
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* その他のドメインリスト（アプリケーション開発以外） */}
                      {domains.filter(d => d.name !== 'app-development').map((domain) => (
                        <button
                          key={domain.id}
                          onClick={() => handleSelectDomain(domain)}
                          className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{domain.icon || '📦'}</span>
                            <div>
                              <div className="font-semibold text-white">{domain.display_name}</div>
                              {domain.description && (
                                <div className="text-sm text-gray-400">{domain.description}</div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}

              {/* Step 3: プロンプト選択 */}
              {step === 'prompt' && (
                <>
                  {prompts.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      利用可能なプロンプトがありません
                    </div>
                  ) : (
                    prompts.map((prompt) => (
                      <button
                        key={prompt.id}
                        onClick={() => handleSelectPrompt(prompt)}
                        className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            {prompt.display_name}
                            {prompt.is_default === 1 && (
                              <span className="text-xs bg-blue-600 px-2 py-0.5 rounded">デフォルト</span>
                            )}
                          </div>
                          {prompt.description && (
                            <div className="text-sm text-gray-400 mt-1">{prompt.description}</div>
                          )}
                          {prompt.recommended_model && (
                            <div className="text-xs text-gray-500 mt-2">
                              推奨モデル: {prompt.recommended_model}
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
