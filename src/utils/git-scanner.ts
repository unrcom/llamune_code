/**
 * Gitリポジトリスキャナー
 * ユーザーのホームディレクトリ配下のGitリポジトリを検出
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

export interface GitRepository {
  name: string;
  path: string;
  description?: string;
}

/**
 * ディレクトリがGitリポジトリかチェック
 */
function isGitRepository(dirPath: string): boolean {
  try {
    const gitDir = join(dirPath, '.git');
    return existsSync(gitDir) && statSync(gitDir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * ディレクトリをスキャンしてGitリポジトリを検出
 */
function scanDirectory(dirPath: string, maxDepth: number, currentDepth: number = 0): GitRepository[] {
  const repos: GitRepository[] = [];

  // 最大深さに達したら終了
  if (currentDepth > maxDepth) {
    return repos;
  }

  try {
    // このディレクトリがGitリポジトリなら追加
    if (isGitRepository(dirPath)) {
      repos.push({
        name: basename(dirPath),
        path: dirPath,
      });
      // Gitリポジトリの中は探索しない
      return repos;
    }

    // サブディレクトリをスキャン
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // 隠しディレクトリとnode_modulesはスキップ
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      if (entry.isDirectory()) {
        const subPath = join(dirPath, entry.name);
        try {
          const subRepos = scanDirectory(subPath, maxDepth, currentDepth + 1);
          repos.push(...subRepos);
        } catch {
          // アクセス権限がない場合などはスキップ
          continue;
        }
      }
    }
  } catch {
    // エラーが発生した場合はスキップ
  }

  return repos;
}

/**
 * ホームディレクトリ配下の特定フォルダをスキャン
 */
export function scanGitRepositories(): GitRepository[] {
  const home = homedir();
  const repos: GitRepository[] = [];

  // スキャン対象のディレクトリ（よく使われるフォルダ）
  const scanTargets = [
    join(home, 'dev'),
    join(home, 'projects'),
    join(home, 'workspace'),
    join(home, 'src'),
    join(home, 'code'),
    join(home, 'git'),
    join(home, 'repos'),
    join(home, 'Documents'),
    join(home, 'Desktop'),
    home, // ホームディレクトリ直下も浅くスキャン
  ];

  for (const target of scanTargets) {
    if (existsSync(target)) {
      try {
        // ホームディレクトリ直下は1階層のみ、それ以外は2階層
        const maxDepth = target === home ? 1 : 2;
        const foundRepos = scanDirectory(target, maxDepth);
        repos.push(...foundRepos);
      } catch {
        // エラーが発生したディレクトリはスキップ
        continue;
      }
    }
  }

  // 重複を削除（同じパスのリポジトリ）
  const uniqueRepos = repos.filter(
    (repo, index, self) => index === self.findIndex((r) => r.path === repo.path)
  );

  // パスでソート
  uniqueRepos.sort((a, b) => a.path.localeCompare(b.path));

  return uniqueRepos;
}
