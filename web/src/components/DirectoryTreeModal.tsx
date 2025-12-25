/**
 * ディレクトリツリービューコンポーネント
 * ローカルファイルシステムのディレクトリを選択できる
 */

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

interface DirectoryNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: DirectoryNode[];
}

interface DirectoryTreeProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

interface DirectoryItemProps {
  node: DirectoryNode;
  onExpand: (path: string) => void;
  onSelect: (path: string) => void;
  selectedPath: string | null;
  expandedPaths: Set<string>;
}

function DirectoryItem({ node, onExpand, onSelect, selectedPath, expandedPaths }: DirectoryItemProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    if (isExpanded) {
      // 既に展開されている場合は選択のみ
      onSelect(node.path);
    } else {
      // 展開されていない場合は展開
      onExpand(node.path);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 ${
          isSelected ? 'bg-blue-100' : ''
        }`}
        onClick={handleClick}
      >
        <span className="mr-1">
          {isExpanded ? '📂' : '📁'}
        </span>
        <span className="text-sm">{node.name}</span>
      </div>
      {isExpanded && node.children && node.children.length > 0 && (
        <div className="ml-4">
          {node.children.map((child) => (
            <DirectoryItem
              key={child.path}
              node={child}
              onExpand={onExpand}
              onSelect={onSelect}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DirectoryTreeModal({ onSelect, onClose }: DirectoryTreeProps) {
  const [rootNode, setRootNode] = useState<DirectoryNode | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初期ロード（ホームディレクトリ）
  useEffect(() => {
    loadDirectory();
  }, []);

  const loadDirectory = async (path?: string) => {
    try {
      setLoading(true);
      setError(null);

      const url = path
        ? `/api/filesystem/tree?path=${encodeURIComponent(path)}`
        : '/api/filesystem/tree';

      const tokens = useAuthStore.getState().tokens;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load directory');
      }

      const data = await response.json();

      if (path) {
        // 既存ツリーに子ノードを追加
        setRootNode((prevRoot) => {
          if (!prevRoot) return data;
          return updateNodeChildren(prevRoot, path, data.children || []);
        });
      } else {
        // 初回ロード
        setRootNode(data);
        setExpandedPaths(new Set([data.path]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const updateNodeChildren = (
    node: DirectoryNode,
    targetPath: string,
    children: DirectoryNode[]
  ): DirectoryNode => {
    if (node.path === targetPath) {
      return { ...node, children };
    }

    if (node.children) {
      return {
        ...node,
        children: node.children.map((child) =>
          updateNodeChildren(child, targetPath, children)
        ),
      };
    }

    return node;
  };

  const handleExpand = async (path: string) => {
    const newExpandedPaths = new Set(expandedPaths);

    if (newExpandedPaths.has(path)) {
      // 折りたたみ
      newExpandedPaths.delete(path);
      setExpandedPaths(newExpandedPaths);
    } else {
      // 展開
      newExpandedPaths.add(path);
      setExpandedPaths(newExpandedPaths);

      // 子ノードをロード
      await loadDirectory(path);
    }
  };

  const handleSelect = (path: string) => {
    setSelectedPath(path);
  };

  const handleConfirm = () => {
    if (selectedPath) {
      onSelect(selectedPath);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">プロジェクトディレクトリを選択</h2>
        </div>

        {/* ツリービュー */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && !rootNode && (
            <div className="text-center py-8 text-gray-500">読み込み中...</div>
          )}

          {error && (
            <div className="text-center py-8 text-red-500">{error}</div>
          )}

          {rootNode && (
            <DirectoryItem
              node={rootNode}
              onExpand={handleExpand}
              onSelect={handleSelect}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
            />
          )}
        </div>

        {/* 選択中のパス表示 */}
        {selectedPath && (
          <div className="px-6 py-3 bg-gray-50 border-t border-b">
            <div className="text-sm text-gray-600">選択中:</div>
            <div className="text-sm font-mono truncate">{selectedPath}</div>
          </div>
        )}

        {/* フッター */}
        <div className="px-6 py-4 border-t flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedPath}
            className={`px-4 py-2 rounded-md ${
              selectedPath
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            選択
          </button>
        </div>
      </div>
    </div>
  );
}
