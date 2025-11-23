/**
 * Git操作ユーティリティ
 * ローカルリポジトリに対するGitコマンドを実行
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * Git操作のエラー
 */
export class GitError extends Error {
  constructor(
    message: string,
    public code: string,
    public stderr?: string
  ) {
    super(message);
    this.name = 'GitError';
  }
}

/**
 * ブランチ情報
 */
export interface GitBranch {
  name: string;
  current: boolean;
  remote: boolean;
}

/**
 * コミット情報
 */
export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

/**
 * ファイル差分情報
 */
export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  patch: string;
}

/**
 * Git status情報
 */
export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

/**
 * ファイルツリーノード
 */
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

/**
 * リポジトリが有効なGitリポジトリかチェック
 */
export async function isGitRepository(repoPath: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: repoPath });
    return true;
  } catch {
    return false;
  }
}

/**
 * ブランチ一覧を取得
 */
export async function listBranches(repoPath: string): Promise<GitBranch[]> {
  try {
    const { stdout } = await execAsync('git branch -a', { cwd: repoPath });

    const branches: GitBranch[] = [];

    stdout.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const current = trimmed.startsWith('*');
      const name = trimmed.replace(/^\*\s+/, '').replace(/^remotes\//, '');
      const remote = line.includes('remotes/');

      // HEADは除外
      if (name.includes('HEAD ->')) return;

      branches.push({ name, current, remote });
    });

    return branches;
  } catch (error: any) {
    throw new GitError(
      'Failed to list branches',
      'LIST_BRANCHES_FAILED',
      error.stderr
    );
  }
}

/**
 * 現在のブランチを取得
 */
export async function getCurrentBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync('git branch --show-current', { cwd: repoPath });
    return stdout.trim();
  } catch (error: any) {
    throw new GitError(
      'Failed to get current branch',
      'GET_CURRENT_BRANCH_FAILED',
      error.stderr
    );
  }
}

/**
 * 新しいブランチを作成
 */
export async function createBranch(
  repoPath: string,
  branchName: string,
  fromBranch?: string
): Promise<void> {
  try {
    const baseCommand = fromBranch
      ? `git checkout -b ${branchName} ${fromBranch}`
      : `git checkout -b ${branchName}`;

    await execAsync(baseCommand, { cwd: repoPath });
  } catch (error: any) {
    throw new GitError(
      `Failed to create branch: ${branchName}`,
      'CREATE_BRANCH_FAILED',
      error.stderr
    );
  }
}

/**
 * ブランチを切り替え
 */
export async function checkoutBranch(
  repoPath: string,
  branchName: string
): Promise<void> {
  try {
    await execAsync(`git checkout ${branchName}`, { cwd: repoPath });
  } catch (error: any) {
    throw new GitError(
      `Failed to checkout branch: ${branchName}`,
      'CHECKOUT_BRANCH_FAILED',
      error.stderr
    );
  }
}

/**
 * コミット履歴を取得
 */
export async function getCommitHistory(
  repoPath: string,
  limit: number = 50
): Promise<GitCommit[]> {
  try {
    const { stdout } = await execAsync(
      `git log --pretty=format:"%H|%an|%ad|%s" --date=iso -n ${limit}`,
      { cwd: repoPath }
    );

    const commits: GitCommit[] = [];

    stdout.split('\n').forEach((line) => {
      if (!line.trim()) return;

      const [hash, author, date, message] = line.split('|');
      commits.push({ hash, author, date, message });
    });

    return commits;
  } catch (error: any) {
    throw new GitError(
      'Failed to get commit history',
      'GET_COMMIT_HISTORY_FAILED',
      error.stderr
    );
  }
}

/**
 * Git statusを取得
 */
export async function getStatus(repoPath: string): Promise<GitStatus> {
  try {
    const branch = await getCurrentBranch(repoPath);

    const { stdout } = await execAsync('git status --porcelain=v1 --branch', {
      cwd: repoPath,
    });

    const lines = stdout.split('\n');
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    let ahead = 0;
    let behind = 0;

    lines.forEach((line) => {
      if (line.startsWith('## ')) {
        // ブランチ情報
        const match = line.match(/\[ahead (\d+), behind (\d+)\]/);
        if (match) {
          ahead = parseInt(match[1], 10);
          behind = parseInt(match[2], 10);
        }
        return;
      }

      if (!line.trim()) return;

      const status = line.substring(0, 2);
      const file = line.substring(3);

      if (status[0] !== ' ' && status[0] !== '?') {
        staged.push(file);
      }
      if (status[1] !== ' ' && status[1] !== '?') {
        unstaged.push(file);
      }
      if (status === '??') {
        untracked.push(file);
      }
    });

    return { branch, ahead, behind, staged, unstaged, untracked };
  } catch (error: any) {
    throw new GitError('Failed to get status', 'GET_STATUS_FAILED', error.stderr);
  }
}

/**
 * ファイルをステージングエリアに追加
 */
export async function addFiles(repoPath: string, files: string[]): Promise<void> {
  try {
    const filesArg = files.map((f) => `"${f}"`).join(' ');
    await execAsync(`git add ${filesArg}`, { cwd: repoPath });
  } catch (error: any) {
    throw new GitError('Failed to add files', 'ADD_FILES_FAILED', error.stderr);
  }
}

/**
 * コミットを作成
 */
export async function commit(
  repoPath: string,
  message: string
): Promise<string> {
  try {
    const { stdout } = await execAsync(`git commit -m "${message}"`, {
      cwd: repoPath,
    });
    return stdout.trim();
  } catch (error: any) {
    throw new GitError('Failed to commit', 'COMMIT_FAILED', error.stderr);
  }
}

/**
 * 差分を取得
 */
export async function getDiff(
  repoPath: string,
  file?: string,
  staged: boolean = false
): Promise<string> {
  try {
    const stagedFlag = staged ? '--cached' : '';
    const fileArg = file ? `-- "${file}"` : '';
    const { stdout } = await execAsync(`git diff ${stagedFlag} ${fileArg}`, {
      cwd: repoPath,
    });
    return stdout;
  } catch (error: any) {
    throw new GitError('Failed to get diff', 'GET_DIFF_FAILED', error.stderr);
  }
}

/**
 * ファイルツリーを取得（.gitignoreを考慮）
 */
export async function getFileTree(
  repoPath: string,
  subPath: string = ''
): Promise<FileTreeNode[]> {
  const fullPath = join(repoPath, subPath);

  if (!existsSync(fullPath)) {
    throw new GitError('Path does not exist', 'PATH_NOT_FOUND');
  }

  const items = readdirSync(fullPath);
  const nodes: FileTreeNode[] = [];

  for (const item of items) {
    // .gitディレクトリとnode_modulesは除外
    if (item === '.git' || item === 'node_modules') continue;

    const itemPath = join(fullPath, item);
    const relativePath = join(subPath, item);
    const stat = statSync(itemPath);

    if (stat.isDirectory()) {
      nodes.push({
        name: item,
        path: relativePath,
        type: 'directory',
        children: await getFileTree(repoPath, relativePath),
      });
    } else {
      nodes.push({
        name: item,
        path: relativePath,
        type: 'file',
      });
    }
  }

  return nodes;
}

/**
 * ファイル内容を取得
 */
export function getFileContent(repoPath: string, filePath: string): string {
  const fullPath = join(repoPath, filePath);

  if (!existsSync(fullPath)) {
    throw new GitError('File does not exist', 'FILE_NOT_FOUND');
  }

  return readFileSync(fullPath, 'utf-8');
}

/**
 * リポジトリの言語を検出（簡易版）
 */
export async function detectPrimaryLanguage(repoPath: string): Promise<string | null> {
  try {
    // package.jsonがあればJavaScript/TypeScript
    if (existsSync(join(repoPath, 'package.json'))) {
      if (existsSync(join(repoPath, 'tsconfig.json'))) {
        return 'TypeScript';
      }
      return 'JavaScript';
    }

    // requirements.txtやsetup.pyがあればPython
    if (
      existsSync(join(repoPath, 'requirements.txt')) ||
      existsSync(join(repoPath, 'setup.py'))
    ) {
      return 'Python';
    }

    // pom.xmlやbuild.gradleがあればJava
    if (
      existsSync(join(repoPath, 'pom.xml')) ||
      existsSync(join(repoPath, 'build.gradle'))
    ) {
      return 'Java';
    }

    // Cargo.tomlがあればRust
    if (existsSync(join(repoPath, 'Cargo.toml'))) {
      return 'Rust';
    }

    // go.modがあればGo
    if (existsSync(join(repoPath, 'go.mod'))) {
      return 'Go';
    }

    return null;
  } catch {
    return null;
  }
}
