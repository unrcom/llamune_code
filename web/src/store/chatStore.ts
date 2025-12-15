import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Message, Session, ChatParameters, Model, ParameterPreset } from '../types';

interface ChatState {
  // 現在のセッション
  currentSessionId: number | null;
  currentModel: string;
  currentPresetId: number | null;
  currentDomainPromptId: number | null; // ドメイン特化モード用
  isProfessionalMode: boolean; // あなたの本職を支援するモード（app-development）かどうか
  projectPath: string | null; // プロジェクトディレクトリパス
  messages: Message[];

  // セッション一覧
  sessions: Session[];

  // モデル一覧
  models: Model[];

  // プリセット一覧
  presets: ParameterPreset[];

  // パラメータ
  parameters: ChatParameters;

  // UI状態
  isStreaming: boolean;
  error: string | null;
  isRetryPending: boolean;
  retryOriginalMessage: Message | null;
  mobileView: 'list' | 'chat' | 'models';
  cancelStreaming: (() => void) | null;
  inputValue: string;

  // アクション
  setCurrentSession: (sessionId: number | null) => void;
  setCurrentModel: (model: string) => void;
  setCurrentPresetId: (presetId: number | null) => void;
  setCurrentDomainPromptId: (domainPromptId: number | null) => void;
  setIsProfessionalMode: (isProfessional: boolean) => void;
  setProjectPath: (projectPath: string | null) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  removeLastAssistantMessage: () => Message | null;
  removeLastUserMessage: () => Message | null;
  setSessions: (sessions: Session[]) => void;
  setModels: (models: Model[]) => void;
  setPresets: (presets: ParameterPreset[]) => void;
  setParameters: (parameters: ChatParameters) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  setRetryPending: (isPending: boolean, originalMessage?: Message | null) => void;
  acceptRetry: () => void;
  rejectRetry: () => void;
  resetChat: () => void;
  setMobileView: (view: 'list' | 'chat' | 'models') => void;
  setCancelStreaming: (fn: (() => void) | null) => void;
  setInputValue: (value: string) => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set) => ({
      // 初期状態
      currentSessionId: null,
      currentModel: '',
      currentPresetId: null,
      currentDomainPromptId: null,
      isProfessionalMode: false,
      projectPath: null,
      messages: [],
  sessions: [],
  models: [],
  presets: [],
  parameters: {
    temperature: 0.8,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.1,
    num_ctx: 2048,
  },
  isStreaming: false,
  error: null,
  isRetryPending: false,
  retryOriginalMessage: null,
  mobileView: 'list',
  cancelStreaming: null,
  inputValue: '',

  // アクション
  setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),
  setCurrentModel: (model) => set({ currentModel: model }),
  setCurrentPresetId: (presetId) => set({ currentPresetId: presetId }),
  setCurrentDomainPromptId: (domainPromptId) => set({ currentDomainPromptId: domainPromptId }),
  setIsProfessionalMode: (isProfessional) => set({ isProfessionalMode: isProfessional }),
  setProjectPath: (projectPath) => set({ projectPath: projectPath }),
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  setMessages: (messages) => set({ messages }),
  removeLastAssistantMessage: () => {
    let removedMessage: Message | null = null;
    set((state) => {
      // 最後のアシスタントメッセージを削除
      const messages = [...state.messages];
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
          removedMessage = messages[i];
          messages.splice(i, 1);
          break;
        }
      }
      return { messages };
    });
    return removedMessage;
  },
  removeLastUserMessage: () => {
    let removedMessage: Message | null = null;
    set((state) => {
      // 最後のユーザーメッセージを削除
      const messages = [...state.messages];
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          removedMessage = messages[i];
          messages.splice(i, 1);
          break;
        }
      }
      return { messages };
    });
    return removedMessage;
  },
  setSessions: (sessions) => set({ sessions }),
  setModels: (models) => set((state) => ({
    models,
    // モデル一覧が設定されたときに、currentModel が空なら最初のモデルを設定
    currentModel: state.currentModel || (models.length > 0 ? models[0].name : ''),
  })),
  setPresets: (presets) => set({ presets }),
  setParameters: (parameters) => set({ parameters }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setError: (error) => set({ error }),
  setRetryPending: (isPending, originalMessage) => set({
    isRetryPending: isPending,
    retryOriginalMessage: originalMessage ?? null,
  }),
  acceptRetry: () => set({
    isRetryPending: false,
    retryOriginalMessage: null,
  }),
  rejectRetry: () => set((state) => {
    // 最後のメッセージを削除して元のメッセージを復元
    const messages = [...state.messages];
    messages.pop(); // 新しい回答を削除
    if (state.retryOriginalMessage) {
      messages.push(state.retryOriginalMessage); // 元の回答を復元
    }
    return {
      messages,
      isRetryPending: false,
      retryOriginalMessage: null,
    };
  }),
  resetChat: () => set({
    currentSessionId: null,
    currentDomainPromptId: null,
    isProfessionalMode: false,
    projectPath: null,
    messages: [],
    error: null,
    isRetryPending: false,
    retryOriginalMessage: null,
  }),
  setMobileView: (view) => set({ mobileView: view }),
  setCancelStreaming: (fn) => set({ cancelStreaming: fn }),
  setInputValue: (value) => set({ inputValue: value }),
}), { name: 'ChatStore' })
);
