# Llamune 開発環境セットアップ

Llamune の開発環境を macOS にセットアップする手順です。

## 環境要件

- **ハードウェア**: Apple Silicon Mac (M1以降)
- **OS**: macOS 14.0以降
- **メモリ**: 16GB以上推奨

## 1. Command Line Tools のインストール
```bash
# バージョン確認（未インストールの場合、インストールダイアログが表示される）
git --version

# インストール
xcode-select --install
```

ダイアログで [インストール] をクリックし、完了を待ちます。

確認:
```bash
git --version
# git version 2.50.1 (Apple Git-155)
```

## 2. Homebrew のインストール
```bash
# Homebrewインストール
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# PATHを通す
(echo; echo 'eval "$(/opt/homebrew/bin/brew shellenv)"') >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

確認:
```bash
brew -v
# Homebrew 5.0.1
```

## 3. Chrome のインストール

**重要**: 開発中は Chrome ブラウザの使用を推奨します。

### Safari での問題

Safari ブラウザで https://claude.ai を開いてチャットを行うと、日本語入力中に `[return]` キーを押した際、文字変換の確定ではなく **Claude へのメッセージ送信** が実行されてしまいます。

**回避策**:
- Safari を使う場合: `[shift]` + `[return]` で変換確定
- Chrome を使う場合: `[return]` のみで通常通り日本語変換が可能

開発効率を考えると、早い段階で Chrome をインストールすることを推奨します。
```bash
brew install google-chrome
```

インストール後、Chrome で https://claude.ai を開いて作業を続けてください。

## 4. iTerm2 のインストール（推奨）
```bash
brew install iterm2
```

### プロンプトのカスタマイズ

Markdown での表示を考慮し、プロンプトを `m >` に設定します。
```bash
echo 'export PS1="m > "' >> ~/.zshrc
source ~/.zshrc
```

## 5. nvm と Node.js のインストール

### nvm のインストール
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.zshrc
```

確認:
```bash
nvm --version
# 0.39.0
```

### Node.js のインストール

**重要**: Node.js v22.x を使用します（v24/v25 では better-sqlite3 のビルドに失敗します）
```bash
nvm install 22
```

確認:
```bash
node --version
# v22.21.1

npm --version
# v11.6.2
```

## 6. ollama のインストール
```bash
brew install ollama
```

確認:
```bash
ollama --version
# Warning: could not connect to a running Ollama instance
# Warning: client version is 0.12.11
```

> **注**: ollama サーバーは起動する必要はありません。Llamune が必要に応じて自動起動します。

## 7. プロジェクトのセットアップ

### 作業ディレクトリの作成
```bash
mkdir -p ~/dev
cd ~/dev
```

### リポジトリのクローン
```bash
git clone https://github.com/unrcom/llamune.git
cd llamune
```

### 依存関係のインストール
```bash
npm install
```

成功すると以下のように表示されます:
```
added 301 packages, and audited 302 packages in 16s
```

## 8. 設定ファイルの確認

以下のファイルが作成されていることを確認:
```bash
ls -la
```

- `package.json` - プロジェクト設定
- `tsconfig.json` - TypeScript設定
- `.eslintrc.json` - ESLint設定
- `.prettierrc` - Prettier設定
- `.gitignore` - Git除外設定

ディレクトリ構造:
```
llamune/
├── bin/              # CLIエントリーポイント
├── src/              # ソースコード
├── docs/             # ドキュメント
├── node_modules/     # 依存パッケージ
└── 設定ファイル各種
```

## トラブルシューティング

### Node.js バージョンエラー

`better-sqlite3` のビルドエラーが発生する場合:
```bash
# Node.js v22 に切り替え
nvm install 22
nvm use 22

# クリーンインストール
rm -rf node_modules package-lock.json
npm install
```

### homebrew の PATH が通らない
```bash
# .zprofile に追加されているか確認
cat ~/.zprofile

# 手動で追加
(echo; echo 'eval "$(/opt/homebrew/bin/brew shellenv)"') >> ~/.zprofile
source ~/.zprofile
```

## 次のステップ

環境構築が完了したら、Week 1-2 のタスクに進みます:
- CLI基本構造の実装
- ink セットアップ
- ollama 連携

---

**作成日**: 2025-11-15  
**作成者**: mop  
**対象バージョン**: llamune v0.1.0
