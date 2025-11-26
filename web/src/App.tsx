import { useEffect, useState } from 'react';
import { SessionList } from './components/Session/SessionList';
import { ChatWindow } from './components/Chat/ChatWindow';
import { ModelManager } from './components/Models/ModelManager';
import { Login } from './components/Auth/Login';
import { useChatStore } from './store/chatStore';
import { useAuthStore } from './store/authStore';
import { fetchModels, fetchPresets, fetchGitRepositories, getCurrentUser } from './utils/api';

function App() {
  const setModels = useChatStore((state) => state.setModels);
  const setPresets = useChatStore((state) => state.setPresets);
  const setRepositories = useChatStore((state) => state.setRepositories);
  const mobileView = useChatStore((state) => state.mobileView);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [isMobile, setIsMobile] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  // 起動時にトークンの有効性を検証
  useEffect(() => {
    const validateAuth = async () => {
      if (!isAuthenticated) {
        setIsValidating(false);
        return;
      }

      try {
        // トークンの有効性を確認
        await getCurrentUser();
        setIsValidating(false);
      } catch (error) {
        // トークンが無効な場合はログアウト
        console.warn('Invalid token detected, logging out...');
        clearAuth();
        setIsValidating(false);
      }
    };

    validateAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 認証済みかつ検証完了後のみデータを読み込む
    if (!isAuthenticated || isValidating) return;

    // モデル一覧を取得
    const loadModels = async () => {
      try {
        const { models } = await fetchModels();
        setModels(models);
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };

    // プリセット一覧を取得
    const loadPresets = async () => {
      try {
        const { presets } = await fetchPresets();
        setPresets(presets);
      } catch (error) {
        console.error('Failed to load presets:', error);
      }
    };

    // リポジトリ一覧を取得（ローカルgitリポジトリをスキャン）
    const loadRepositories = async () => {
      try {
        // セッションストレージからキャッシュを確認
        const cached = sessionStorage.getItem('gitRepositories');
        if (cached) {
          const repositories = JSON.parse(cached);
          setRepositories(repositories);
          return;
        }

        // キャッシュがない場合はスキャン
        const { repositories } = await fetchGitRepositories();

        // Repository型に変換（idとuser_idは仮の値）
        const repoList = repositories.map((repo, index) => ({
          id: index + 1,
          user_id: 1,
          name: repo.name,
          local_path: repo.path,
          description: null,
          default_branch: 'main',
          primary_language: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        // セッションストレージにキャッシュ
        sessionStorage.setItem('gitRepositories', JSON.stringify(repoList));

        setRepositories(repoList);
      } catch (error) {
        console.error('Failed to load repositories:', error);
      }
    };

    loadModels();
    loadPresets();
    loadRepositories();
  }, [isAuthenticated, isValidating, setModels, setPresets, setRepositories]);

  useEffect(() => {
    // モバイル判定
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 検証中はローディング画面を表示
  if (isValidating) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 未認証の場合はログイン画面を表示
  if (!isAuthenticated) {
    return <Login />;
  }

  // 認証済みの場合はメインアプリを表示
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Left Sidebar - デスクトップではSessionList/ModelManagerを切り替え、モバイルではビューに応じて表示 */}
      {isMobile ? (
        // モバイル：ビューに応じて表示切り替え
        <>
          {mobileView === 'list' && <SessionList />}
          {mobileView === 'models' && <ModelManager />}
        </>
      ) : (
        // デスクトップ：SessionListまたはModelManagerを左側に表示
        <>
          {mobileView === 'models' ? <ModelManager /> : <SessionList />}
        </>
      )}

      {/* Main Chat Area - デスクトップでは常に表示、モバイルではchatビューの時のみ表示 */}
      {(!isMobile || mobileView === 'chat') && (
        <div className="flex-1 flex flex-col">
          <ChatWindow />
        </div>
      )}
    </div>
  );
}

export default App;
