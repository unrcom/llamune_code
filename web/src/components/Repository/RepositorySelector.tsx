import { useChatStore } from '../../store/chatStore';

export function RepositorySelector() {
  const repositories = useChatStore((state) => state.repositories);
  const currentRepositoryId = useChatStore((state) => state.currentRepositoryId);
  const setCurrentRepositoryId = useChatStore((state) => state.setCurrentRepositoryId);

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="repository-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        リポジトリ:
      </label>
      <select
        id="repository-select"
        value={currentRepositoryId?.toString() || ''}
        onChange={(e) => setCurrentRepositoryId(e.target.value ? Number(e.target.value) : null)}
        className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">なし</option>
        {repositories.map((repo) => (
          <option key={repo.id} value={repo.id}>
            {repo.name}
          </option>
        ))}
      </select>
    </div>
  );
}
