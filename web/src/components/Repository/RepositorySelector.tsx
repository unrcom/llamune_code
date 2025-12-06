import { useChatStore } from '../../store/chatStore';
import { useEffect, useState } from 'react';

interface Branch {
  name: string;
  current: boolean;
  remote: boolean;
}

export function RepositorySelector() {
  const repositories = useChatStore((state) => state.repositories);
  const currentRepositoryPath = useChatStore((state) => state.currentRepositoryPath);
  const currentBranch = useChatStore((state) => state.currentBranch);
  const setCurrentRepositoryPath = useChatStore((state) => state.setCurrentRepositoryPath);
  const setCurrentBranch = useChatStore((state) => state.setCurrentBranch);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // リポジトリが変更されたらブランチ一覧を取得
  useEffect(() => {
    if (!currentRepositoryPath) {
      setBranches([]);
      setCurrentBranch(null);
      return;
    }

    const fetchBranches = async () => {
      try {
        setLoadingBranches(true);

        // authStoreから直接トークンを取得
        const authStore = await import('../../store/authStore');
        const tokens = authStore.useAuthStore.getState().tokens;
        
        if (!tokens?.accessToken) {
          console.error('No access token available');
          setBranches([]);
          setLoadingBranches(false);
          return;
        }
        
        const response = await fetch(
          `/api/git-repos/branches?path=${encodeURIComponent(currentRepositoryPath)}`,
          {
            headers: {
              'Authorization': `Bearer ${tokens.accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch branches');
        }

        const data = await response.json();
        const localBranches = data.branches.filter((b: Branch) => !b.remote);
        setBranches(localBranches);

        // 現在のブランチが設定されていない場合、カレントブランチを設定
        if (!currentBranch) {
          const current = localBranches.find((b: Branch) => b.current);
          if (current) {
            setCurrentBranch(current.name);
          }
        }
      } catch (error) {
        console.error('Failed to fetch branches:', error);
        setBranches([]);
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, [currentRepositoryPath]);

  return (
    <div className="flex items-center gap-2">
      {/* リポジトリ選択 */}
      <select
        id="repository-select"
        value={currentRepositoryPath || ''}
        onChange={(e) => {
          setCurrentRepositoryPath(e.target.value || null);
          setCurrentBranch(null); // リポジトリ変更時はブランチをリセット
        }}
        className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">リポジトリなし</option>
        {repositories.map((repo) => (
          <option key={repo.local_path} value={repo.local_path}>
            {repo.name}
          </option>
        ))}
      </select>

      {/* ブランチ選択 */}
      {currentRepositoryPath && (
        <select
          id="branch-select"
          value={currentBranch || ''}
          onChange={(e) => setCurrentBranch(e.target.value || null)}
          disabled={loadingBranches || branches.length === 0}
          className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          title={loadingBranches ? '読み込み中...' : ''}
        >
          {loadingBranches ? (
            <option value="">読み込み中...</option>
          ) : branches.length === 0 ? (
            <option value="">ブランチなし</option>
          ) : (
            <>
              {branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name} {branch.current ? '(current)' : ''}
                </option>
              ))}
            </>
          )}
        </select>
      )}
    </div>
  );
}
