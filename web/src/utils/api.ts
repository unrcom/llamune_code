import type {
  Message,
  SessionsResponse,
  SessionDetailResponse,
  Model,
  ParameterPreset,
  RecommendedModel,
  SystemSpec,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  User,
  DomainMode,
  DomainPrompt,
  RepositoriesResponse,
  Repository,
} from '../types';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = '/api';

// 認証ヘッダーを取得
function getAuthHeaders(): HeadersInit {
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.accessToken) {
    return {
      'Authorization': `Bearer ${tokens.accessToken}`,
    };
  }
  // フォールバック: 環境変数のAPIキー（後方互換性のため）
  if (import.meta.env.VITE_API_KEY) {
    return {
      'Authorization': `Bearer ${import.meta.env.VITE_API_KEY}`,
    };
  }
  return {};
}

// トークンリフレッシュ処理
async function refreshAccessToken(): Promise<boolean> {
  const tokens = useAuthStore.getState().tokens;
  if (!tokens?.refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      // リフレッシュトークンが無効な場合はログアウト
      useAuthStore.getState().clearAuth();
      return false;
    }

    const data: RefreshTokenResponse = await response.json();
    useAuthStore.getState().updateAccessToken(data.accessToken);
    return true;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return false;
  }
}

// 認証付きfetch（トークン期限切れ時は自動リフレッシュ）
async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = {
    ...options.headers,
    ...getAuthHeaders(),
  };

  let response = await fetch(url, { ...options, headers });

  // 401エラーの場合、トークンをリフレッシュして再試行
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // リフレッシュ成功、新しいトークンで再試行
      const newHeaders = {
        ...options.headers,
        ...getAuthHeaders(),
      };
      response = await fetch(url, { ...options, headers: newHeaders });
    }
  }

  return response;
}

// 認証API
export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password } as LoginRequest),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  return response.json();
}

export async function logout(): Promise<void> {
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.refreshToken) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
    } catch (error) {
      console.error('Logout API call failed:', error);
    }
  }
  useAuthStore.getState().clearAuth();
  // Zustand persist は state を空にしても localStorage キーを削除しないため、明示的に削除
  localStorage.removeItem('llamune-auth');
}

export async function getCurrentUser(): Promise<User> {
  const response = await authenticatedFetch(`${API_BASE_URL}/auth/me`);

  if (!response.ok) {
    throw new Error('Failed to fetch current user');
  }

  const data = await response.json();
  return data.user;
}

// セッション一覧を取得
export async function fetchSessions(): Promise<SessionsResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/chat/sessions`);

  if (!response.ok) {
    throw new Error('Failed to fetch sessions');
  }

  return response.json();
}

// セッション詳細を取得
export async function fetchSession(sessionId: number): Promise<SessionDetailResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/chat/sessions/${sessionId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch session');
  }

  return response.json();
}

// モデル一覧を取得
export async function fetchModels(): Promise<{ models: Model[] }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/models`);

  if (!response.ok) {
    throw new Error('Failed to fetch models');
  }

  return response.json();
}

// パラメータプリセット一覧を取得
export async function fetchPresets(): Promise<{ presets: ParameterPreset[] }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/presets`);

  if (!response.ok) {
    throw new Error('Failed to fetch presets');
  }

  return response.json();
}

// Retry - 最後のメッセージを再実行
export async function retryLastMessage(
  sessionId: number | null,
  modelName: string,
  presetId?: number | null,
  history?: Message[]
): Promise<Response> {
  const response = await authenticatedFetch(`${API_BASE_URL}/chat/retry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      modelName,
      presetId,
      history,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to retry message');
  }

  return response;
}

// Rewind - 指定したターンまで巻き戻し
export async function rewindSession(
  sessionId: number,
  turnNumber: number
): Promise<void> {
  const response = await authenticatedFetch(`${API_BASE_URL}/chat/sessions/${sessionId}/rewind`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ turnNumber }),
  });

  if (!response.ok) {
    throw new Error('Failed to rewind session');
  }
}

// セッションタイトルを更新
export async function updateSessionTitle(
  sessionId: number,
  title: string
): Promise<{ success: boolean; sessionId: number; title: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/chat/sessions/${sessionId}/title`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error('Failed to update session title');
  }

  return response.json();
}

// セッションを削除
export async function deleteSessionApi(
  sessionId: number
): Promise<{ success: boolean; sessionId: number }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/chat/sessions/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete session');
  }

  return response.json();
}

// 推奨モデル一覧を取得
export async function fetchRecommendedModels(): Promise<{
  spec: SystemSpec;
  recommended: RecommendedModel[];
}> {
  const response = await authenticatedFetch(`${API_BASE_URL}/models/recommended`);

  if (!response.ok) {
    throw new Error('Failed to fetch recommended models');
  }

  return response.json();
}

// モデルをダウンロード
export async function pullModel(modelName: string): Promise<{ success: boolean; modelName: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/models/pull`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modelName }),
  });

  if (!response.ok) {
    throw new Error('Failed to pull model');
  }

  return response.json();
}

// モデルを削除
export async function deleteModel(modelName: string): Promise<{ success: boolean; modelName: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/models`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modelName }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete model');
  }

  return response.json();
}

// ドメインモード一覧を取得
export async function fetchDomainModes(): Promise<{ domains: DomainMode[] }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/domains`);

  if (!response.ok) {
    throw new Error('Failed to fetch domain modes');
  }

  return response.json();
}

// 特定ドメインのプロンプト一覧を取得
export async function fetchDomainPrompts(domainId: number): Promise<{ prompts: DomainPrompt[] }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/domains/${domainId}/prompts`);

  if (!response.ok) {
    throw new Error('Failed to fetch domain prompts');
  }

  return response.json();
}

// リポジトリ一覧を取得（データベースから）
export async function fetchRepositories(): Promise<RepositoriesResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/repositories`);

  if (!response.ok) {
    throw new Error('Failed to fetch repositories');
  }

  return response.json();
}

// Gitリポジトリをスキャン（ローカルファイルシステムから）
export async function fetchGitRepositories(): Promise<{ repositories: Array<{ name: string; path: string }> }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/git-repos`);

  if (!response.ok) {
    throw new Error('Failed to scan git repositories');
  }

  return response.json();
}
