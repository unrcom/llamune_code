/**
 * リポジトリ操作ツールの定義
 * LLMが自律的にファイルシステムとGitを操作するためのツール群
 */

/**
 * Ollamaツール定義の型
 */
export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

/**
 * リポジトリ操作用のツール定義
 */
export const repositoryTools: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file from the repository. Use this when you need to see the current implementation of a file.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path to the file from repository root (e.g., "src/index.ts", "package.json")',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write or update a file in the repository. Use this to create new files or modify existing ones.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path to the file from repository root',
          },
          content: {
            type: 'string',
            description: 'Complete content to write to the file',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files in a directory. Use this to explore the repository structure.',
      parameters: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory path relative to repository root. Use empty string or "." for root directory.',
          },
          pattern: {
            type: 'string',
            description: 'Optional glob pattern to filter files (e.g., "*.ts", "**/*.tsx")',
          },
        },
        required: ['directory'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description: 'Search for code patterns or text within the repository files. Use this to find specific functions, classes, or implementations.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query or regex pattern to find in code',
          },
          file_pattern: {
            type: 'string',
            description: 'Optional file pattern to limit search (e.g., "*.ts" for TypeScript files)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Get the current Git status showing staged, unstaged, and untracked files.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'View the diff of changes. Useful for reviewing what has changed.',
      parameters: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            description: 'Optional file path to see diff for specific file only',
          },
          staged: {
            type: 'boolean',
            description: 'If true, show diff of staged changes. If false, show unstaged changes.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_branch',
      description: 'Create a new Git branch. Use this when starting work on a new feature.',
      parameters: {
        type: 'object',
        properties: {
          branch_name: {
            type: 'string',
            description: 'Name for the new branch (e.g., "feature/user-profile", "fix/login-bug")',
          },
          from_branch: {
            type: 'string',
            description: 'Optional branch to create from. If not specified, creates from current branch.',
          },
        },
        required: ['branch_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'commit_changes',
      description: 'Commit changes to Git. Use this after writing or modifying files.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Commit message describing the changes',
          },
          files: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Array of file paths to commit. If empty, commits all changes.',
          },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_file_tree',
      description: 'Get the complete file tree structure of the repository. Use this to understand the project organization.',
      parameters: {
        type: 'object',
        properties: {
          max_depth: {
            type: 'number',
            description: 'Maximum depth to traverse (default: unlimited)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_commits',
      description: 'Get recent commit history. Useful for understanding recent changes.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of commits to retrieve (default: 10)',
          },
        },
        required: [],
      },
    },
  },
];

/**
 * ツール呼び出しの結果型
 */
export interface ToolCallResult {
  success: boolean;
  result?: any;
  error?: string;
}
