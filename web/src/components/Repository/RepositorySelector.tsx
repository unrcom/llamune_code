import { useChatStore } from '../../store/chatStore';

export function RepositorySelector() {
  const repositories = useChatStore((state) => state.repositories);
  const currentRepositoryPath = useChatStore((state) => state.currentRepositoryPath);
  const setCurrentRepositoryPath = useChatStore((state) => state.setCurrentRepositoryPath);

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="repository-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        リポジトリ:
      </label>
      <select
        id="repository-select"
        value={currentRepositoryPath || ''}
        onChange={(e) => setCurrentRepositoryPath(e.target.value || null)}
        className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">なし</option>
        {repositories.map((repo) => (
          <option key={repo.local_path} value={repo.local_path}>
            {repo.name}
          </option>
        ))}
      </select>
    </div>
  );
}
