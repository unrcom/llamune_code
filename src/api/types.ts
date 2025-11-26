/**
 * API型定義
 */

import type { ChatMessage, ChatParameters } from '../utils/ollama.js';

/**
 * APIキー設定
 */
export interface ApiKeyConfig {
  key: string;
  name: string;
  description?: string;
  createdAt: string;
}

/**
 * APIキー設定ファイル
 */
export interface ApiKeysConfig {
  enabled: boolean;
  keys: ApiKeyConfig[];
}

/**
 * APIエラーレスポンス
 */
export interface ApiError {
  error: string;
  code: string;
  statusCode: number;
}

/**
 * メッセージ送信リクエスト
 */
export interface ChatMessagesRequest {
  sessionId?: number | null;
  content: string;
  modelName?: string;
  presetId?: number;
  history?: ChatMessage[];
  domainPromptId?: number; // ドメイン特化モード用
  repositoryPath?: string; // リポジトリパス（ツール呼び出し用）
  workingBranch?: string; // 作業ブランチ
}

/**
 * チャンクレスポンス（SSE）
 */
export interface ChatChunkResponse {
  content: string;
}

/**
 * 完了レスポンス（SSE）
 */
export interface ChatDoneResponse {
  messageId?: number;
  sessionId: number | null;
  fullContent: string;
  model: string;
}

/**
 * リトライリクエスト
 */
export interface ChatRetryRequest {
  sessionId?: number | null;
  modelName: string;
  presetId: number;
  history: ChatMessage[];
}

/**
 * セッション一覧レスポンス
 */
export interface SessionsResponse {
  sessions: Array<{
    id: number;
    model: string;
    created_at: string;
    message_count: number;
    preview: string | null;
    title: string | null;
  }>;
}

/**
 * セッション詳細レスポンス
 */
export interface SessionDetailResponse {
  session: {
    id: number;
    model: string;
    created_at: string;
  };
  messages: ChatMessage[];
}

/**
 * 巻き戻しリクエスト
 */
export interface RewindRequest {
  sessionId: number;
  turnNumber: number;
}

/**
 * モデル切り替えリクエスト
 */
export interface SwitchModelRequest {
  sessionId: number;
  modelName: string;
}

/**
 * モデルダウンロードリクエスト
 */
export interface PullModelRequest {
  modelName: string;
}

/**
 * モデル削除リクエスト
 */
export interface DeleteModelRequest {
  modelName: string;
}

// ========================================
// 認証関連の型定義
// ========================================

/**
 * ユーザー登録リクエスト
 */
export interface RegisterRequest {
  username: string;
  password: string;
  role?: 'admin' | 'user';
}

/**
 * ログインリクエスト
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * ログインレスポンス
 */
export interface LoginResponse {
  user: {
    id: number;
    username: string;
    role: 'admin' | 'user';
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * トークンリフレッシュリクエスト
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * トークンリフレッシュレスポンス
 */
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * ログアウトリクエスト
 */
export interface LogoutRequest {
  refreshToken: string;
}

/**
 * ユーザー情報レスポンス
 */
export interface UserResponse {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

/**
 * パスワード変更リクエスト
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * JWTペイロード（Express Request に追加）
 */
export interface AuthenticatedUser {
  userId: number;
  username: string;
  role: 'admin' | 'user';
}
