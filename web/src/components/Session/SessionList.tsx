import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { fetchSessions, fetchSession, updateSessionTitle, deleteSessionApi } from '../../utils/api';
import type { Session } from '../../types';
import { DomainSelector } from './DomainSelector';

export function SessionList() {
  const { currentSessionId, setCurrentSession, setMessages, resetChat, setSessions, setMobileView, setCurrentDomainPromptId } = useChatStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [sessions, setLocalSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showInfoId, setShowInfoId] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showDomainSelector, setShowDomainSelector] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [sessions, sortOrder]);

  const loadSessions = async () => {
    if (!isAuthenticated) return; // 認証されていない場合はスキップ

    try {
      setLoading(true);
      const response = await fetchSessions();
      setLocalSessions(response.sessions);
      setSessions(response.sessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSession = async (sessionId: number) => {
    try {
      const response = await fetchSession(sessionId);
      setCurrentSession(sessionId);
      setMessages(response.messages);
      setMobileView('chat'); // モバイルでチャット画面に切り替え
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // currentSessionIdが変更されたら（新しいセッションが作成されたら）一覧を更新
  useEffect(() => {
    if (currentSessionId) {
      loadSessions();
    }
  }, [currentSessionId]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleNewChat = () => {
    setShowDomainSelector(true);
  };

  const handleDomainSelect = (domainPromptId: number | null) => {
    resetChat();
    setCurrentDomainPromptId(domainPromptId);
    setMobileView('chat'); // モバイルでチャット画面に切り替え
  };

  const handleOpenModels = () => {
    setMobileView('models');
  };

  const startEditing = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditingTitle(session.title || session.preview || '');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const saveTitle = async () => {
    if (editingId === null) return;

    try {
      await updateSessionTitle(editingId, editingTitle);
      setLocalSessions(sessions.map(s =>
        s.id === editingId ? { ...s, title: editingTitle } : s
      ));
      setSessions(sessions.map(s =>
        s.id === editingId ? { ...s, title: editingTitle } : s
      ));
    } catch (error) {
      console.error('Failed to update title:', error);
    } finally {
      setEditingId(null);
      setEditingTitle('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const handleDelete = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('このセッションを削除しますか？')) return;

    try {
      await deleteSessionApi(sessionId);
      const newSessions = sessions.filter(s => s.id !== sessionId);
      setLocalSessions(newSessions);
      setSessions(newSessions);
      if (currentSessionId === sessionId) {
        resetChat();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const toggleInfo = (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInfoId(showInfoId === sessionId ? null : sessionId);
  };

  return (
    <div className={`${isMobile ? 'w-full' : 'w-64'} border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col h-full`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleNewChat}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + 新しいチャット
        </button>
        <button
          onClick={handleOpenModels}
          className="w-full mt-2 px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors flex items-center justify-center gap-1"
          title="モデル管理"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          モデル管理
        </button>
        <button
          onClick={toggleSortOrder}
          className="w-full mt-2 px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors flex items-center justify-center gap-1"
          title={sortOrder === 'desc' ? '新しい順' : '古い順'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {sortOrder === 'desc' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            )}
          </svg>
          {sortOrder === 'desc' ? '新しい順' : '古い順'}
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-8">
            セッションがありません
          </div>
        ) : (
          <div className="space-y-1">
            {sortedSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => editingId !== session.id && loadSession(session.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer group ${
                  currentSessionId === session.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                {editingId === session.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-1 text-sm font-medium bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 py-0.5 focus:outline-none"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); saveTitle(); }}
                      className="p-1 text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400"
                      title="保存"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); cancelEditing(); }}
                      className="p-1 text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
                      title="キャンセル"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium truncate flex-1">
                        {session.title || session.preview || 'New Chat'}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => toggleInfo(session.id, e)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="詳細"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => startEditing(session, e)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="タイトルを編集"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDelete(session.id, e)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="削除"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {showInfoId === session.id && (
                      <div className="mt-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 rounded px-2 py-1 border border-blue-200 dark:border-blue-800">
                        {session.model} • {session.message_count} messages
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Domain Selector Modal */}
      <DomainSelector
        isOpen={showDomainSelector}
        onClose={() => setShowDomainSelector(false)}
        onSelect={handleDomainSelect}
      />
    </div>
  );
}
