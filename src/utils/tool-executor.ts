/**
 * ツール実行エンジン
 * LLMからのツール呼び出しを実際のリポジトリ操作に変換する
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  getFileContent,
  getFileTree,
  listBranches,
  getCurrentBranch,
  createBranch,
  getCommitHistory,
  getStatus,
  addFiles,
  commit,
  getDiff,
  GitError,
} from './git.js';
import { getRepositoryById } from './database.js';
import type { ToolCallResult } from './repository-tools.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * ツールを実行する
 */
export async function executeRepositoryTool(
  repositoryId: number,
  toolName: string,
  args: Record<string, any>
): Promise<ToolCallResult> {
  try {
    // リポジトリ情報を取得
    const repository = getRepositoryById(repositoryId);
    if (!repository) {
      return {
        success: false,
        error: 'Repository not found',
      };
    }

    const repoPath = repository.local_path;

    // ツールごとに処理を分岐
    switch (toolName) {
      case 'read_file':
        return await readFile(repoPath, args.path);

      case 'write_file':
        return await writeFile(repoPath, args.path, args.content);

      case 'list_files':
        return await listFiles(repoPath, args.directory, args.pattern);

      case 'search_code':
        return await searchCode(repoPath, args.query, args.file_pattern);

      case 'git_status':
        return await gitStatus(repoPath);

      case 'git_diff':
        return await gitDiff(repoPath, args.file, args.staged);

      case 'create_branch':
        return await createBranchTool(repoPath, args.branch_name, args.from_branch);

      case 'commit_changes':
        return await commitChanges(repoPath, args.message, args.files);

      case 'get_file_tree':
        return await getFileTreeTool(repoPath, args.max_depth);

      case 'get_recent_commits':
        return await getRecentCommits(repoPath, args.limit);

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Tool execution failed',
    };
  }
}

/**
 * ファイルを読み取る
 */
async function readFile(repoPath: string, filePath: string): Promise<ToolCallResult> {
  try {
    const content = getFileContent(repoPath, filePath);
    return {
      success: true,
      result: {
        path: filePath,
        content,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to read file: ${error.message}`,
    };
  }
}

/**
 * ファイルを書き込む
 */
async function writeFile(
  repoPath: string,
  filePath: string,
  content: string
): Promise<ToolCallResult> {
  try {
    const fullPath = join(repoPath, filePath);
    writeFileSync(fullPath, content, 'utf-8');

    return {
      success: true,
      result: {
        path: filePath,
        message: 'File written successfully',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to write file: ${error.message}`,
    };
  }
}

/**
 * ファイル一覧を取得
 */
async function listFiles(
  repoPath: string,
  directory: string,
  pattern?: string
): Promise<ToolCallResult> {
  try {
    const tree = await getFileTree(repoPath, directory || '');

    // パターンフィルタリング（簡易版）
    let files = flattenTree(tree);

    if (pattern) {
      const regex = globToRegex(pattern);
      files = files.filter((f) => regex.test(f.path));
    }

    return {
      success: true,
      result: {
        directory,
        files: files.map((f) => ({
          path: f.path,
          type: f.type,
        })),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to list files: ${error.message}`,
    };
  }
}

/**
 * コードを検索
 */
async function searchCode(
  repoPath: string,
  query: string,
  filePattern?: string
): Promise<ToolCallResult> {
  try {
    const globArg = filePattern ? `--glob "${filePattern}"` : '';
    const { stdout } = await execAsync(
      `cd "${repoPath}" && grep -rn "${query}" . --exclude-dir=node_modules --exclude-dir=.git ${globArg} || true`
    );

    const matches = stdout
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [file, ...rest] = line.split(':');
        return {
          file: file.replace('./', ''),
          line: rest.join(':'),
        };
      });

    return {
      success: true,
      result: {
        query,
        matches,
        count: matches.length,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to search code: ${error.message}`,
    };
  }
}

/**
 * Git status
 */
async function gitStatus(repoPath: string): Promise<ToolCallResult> {
  try {
    const status = await getStatus(repoPath);
    return {
      success: true,
      result: status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get git status: ${error.message}`,
    };
  }
}

/**
 * Git diff
 */
async function gitDiff(
  repoPath: string,
  file?: string,
  staged?: boolean
): Promise<ToolCallResult> {
  try {
    const diff = await getDiff(repoPath, file, staged || false);
    return {
      success: true,
      result: {
        diff,
        file,
        staged: staged || false,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get diff: ${error.message}`,
    };
  }
}

/**
 * ブランチ作成
 */
async function createBranchTool(
  repoPath: string,
  branchName: string,
  fromBranch?: string
): Promise<ToolCallResult> {
  try {
    await createBranch(repoPath, branchName, fromBranch);
    const currentBranch = await getCurrentBranch(repoPath);

    return {
      success: true,
      result: {
        branch: currentBranch,
        message: `Created and switched to branch: ${branchName}`,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to create branch: ${error.message}`,
    };
  }
}

/**
 * 変更をコミット
 */
async function commitChanges(
  repoPath: string,
  message: string,
  files?: string[]
): Promise<ToolCallResult> {
  try {
    // ファイルを追加
    if (files && files.length > 0) {
      await addFiles(repoPath, files);
    } else {
      // 全ての変更を追加
      await addFiles(repoPath, ['.']);
    }

    // コミット
    const result = await commit(repoPath, message);

    return {
      success: true,
      result: {
        message: 'Changes committed successfully',
        commit_message: message,
        output: result,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to commit: ${error.message}`,
    };
  }
}

/**
 * ファイルツリー取得
 */
async function getFileTreeTool(
  repoPath: string,
  maxDepth?: number
): Promise<ToolCallResult> {
  try {
    const tree = await getFileTree(repoPath, '');

    // 深さ制限（簡易版）
    const limitedTree = maxDepth ? limitTreeDepth(tree, maxDepth) : tree;

    return {
      success: true,
      result: {
        tree: limitedTree,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get file tree: ${error.message}`,
    };
  }
}

/**
 * 最近のコミットを取得
 */
async function getRecentCommits(
  repoPath: string,
  limit?: number
): Promise<ToolCallResult> {
  try {
    const commits = await getCommitHistory(repoPath, limit || 10);
    return {
      success: true,
      result: {
        commits,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get commits: ${error.message}`,
    };
  }
}

// ========================================
// ヘルパー関数
// ========================================

/**
 * ツリーをフラット化
 */
function flattenTree(tree: any[]): any[] {
  const result: any[] = [];

  function traverse(nodes: any[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return result;
}

/**
 * Globパターンを正規表現に変換（簡易版）
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

/**
 * ツリーの深さを制限
 */
function limitTreeDepth(tree: any[], maxDepth: number, currentDepth: number = 0): any[] {
  if (currentDepth >= maxDepth) {
    return [];
  }

  return tree.map((node) => {
    if (node.children && currentDepth < maxDepth - 1) {
      return {
        ...node,
        children: limitTreeDepth(node.children, maxDepth, currentDepth + 1),
      };
    }
    return {
      ...node,
      children: undefined,
    };
  });
}
