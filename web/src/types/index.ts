// メッセージ型
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  thinking?: string;
}

// セッション型
export interface Session {
  id: number;
  model: string;
  created_at: string;
  message_count: number;
  preview: string;
  title: string | null;
  project_path?: string | null;
}

// チャットパラメータ型
export interface ChatParameters {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repeat_penalty?: number;
  num_ctx?: number;
}

// パラメータプリセット型
export interface ParameterPreset {
  id: number;
  name: string;
  description: string;
  temperature: number | null;
  top_p: number | null;
  top_k: number | null;
  repeat_penalty: number | null;
  num_ctx: number | null;
}

// モデル型
export interface Model {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

// 推奨モデル型
export interface RecommendedModel {
  name: string;
  size: string;
  description: string;
  priority: number;
}

// システムスペック型
export interface SystemSpec {
  totalMemoryGB: number;
  cpuCores: number;
  platform: string;
  arch: string;
  gpu?: {
    vendor: string;
    model: string;
    vram?: number; // MB
  }[];
}

// ドメインモード型
export interface DomainMode {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  enabled: number;
  created_at: string;
}

// ドメインプロンプト型
export interface DomainPrompt {
  id: number;
  domain_mode_id: number;
  name: string;
  display_name: string;
  description: string | null;
  system_prompt: string | null;
  recommended_model: string | null;
  preset_id: number | null;
  is_default: number;
  created_at: string;
}

// APIリクエスト型
export interface SendMessageParams {
  sessionId?: number;
  content: string;
  modelName?: string;
  presetId?: number;
  history?: Message[];
  domainPromptId?: number; // ドメイン特化モード用
}

// APIレスポンス型
export interface ChatChunkResponse {
  content: string;
}

export interface ChatDoneResponse {
  sessionId: number;
  fullContent: string;
  model: string;
}

export interface SessionsResponse {
  sessions: Session[];
}

export interface SessionDetailResponse {
  session: {
    id: number;
    model: string;
    created_at: string;
    project_path?: string | null;
  };
  messages: Message[];
}

export interface ApiError {
  error: string;
  code: string;
  statusCode: number;
}

// 認証関連型
export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}
